# Converging T3 Code and Moatless

**Status:** design, not scheduled. No code written against it yet.
**Depends on:** [`docs/reference/client-server-contract.md`](../docs/reference/client-server-contract.md)
(what T3 promises) and [`docs/reference/moatless-concept-map.md`](../docs/reference/moatless-concept-map.md)
(what Moatless already has). Read the second one first; this document assumes its
vocabulary and does not repeat its findings.
**Relationship to [`moatless-adapter.md`](./moatless-adapter.md):** the adapter makes
Moatless *look like* a T3 server without changing either side. This document is the
opposite bet — change both sides so the adapter shrinks to a translation layer instead
of a simulation layer. The adapter is still the right first step, and nothing here
blocks it.

---

## 1. The proposal

Four moves. The point of writing them down together is that **they do not all run in
the same direction**, and picking the direction per surface is the whole design.

| # | Surface | Direction | In one line |
|---|---|---|---|
| 1 | Thread + environment + worktree | T3 adopts Moatless | Three T3 nouns collapse into **task + sandbox** |
| 2 | Streaming | **Moatless adopts T3** | Sequenced, resumable, per-thread subscriptions |
| 3 | Preview servers | T3 adopts Moatless | Declared servers with lifecycle, not port-scanned processes |
| 4 | Diagnostics | Rescope | Environment-scoped → sandbox-scoped (per pod) |

Move 2 runs against the others deliberately. Moatless's domain model is the better one
— it already knows about ephemeral per-task compute, desired state, and reconciliation.
T3's *streaming contract* is the better one — it already knows about sequences,
resumption, and gapless catch-up, which Moatless has no answer for. Converging on the
stronger side of each is the only version of this that is worth the disruption.

---

## 2. Move 1 — thread + environment + worktree → task + sandbox

### 2.1 What the three T3 nouns currently do

They are three independent axes today:

| Noun | Defined by | Cardinality |
|---|---|---|
| **Thread** | `OrchestrationThread` (`orchestration.ts:449`) | many per environment |
| **Environment** | `ExecutionEnvironmentDescriptor` (`environment.ts:57`) — `{environmentId, label, platform, serverVersion, capabilities}` | one server, one WebSocket |
| **Worktree** | `thread.worktreePath`, `vcs.createWorktree`, `bootstrap.prepareWorktree` | zero or one per thread |

Everything the client holds is already scoped by environment: `ScopedProjectRef` and
`ScopedThreadRef` are both `{environmentId, …}`, and `state/connections.ts` maintains an
environment catalog. That machinery is the reason this migration is tractable at all.

In Moatless the same three collapse: a **Task** owns exactly one **Sandbox**, and the
Sandbox owns the checkout. There is no third axis.

### 2.2 The decision that governs everything else

The contract hardcodes **one socket per environment** (`rpc/session.ts`). So "sandbox =
environment" is not a free renaming.

**Option A — a sandbox *is* an environment.** Faithful to the collapse. Rejected:

- 110 open tasks on the probed deployment ⇒ 110 WebSockets to render one sidebar.
- A stopped sandbox is a disconnected environment, but the shell snapshot must still
  list its thread. Archived threads would become unreachable by construction.
- `GET /.well-known/t3/environment` is per-environment discovery; it would have to be
  answered per task, before any task exists.

**Option B — the Moatless deployment is the environment; the sandbox is thread-scoped
state.** ✅ Recommended.

- One socket, one `environmentId` (the deployment), unchanged transport.
- Threads exist without sandboxes — which Moatless already models: *"absence of the
  record means no Sandbox was ever requested"* (`0092_sandboxes_table.sql`).
- Every method that is implicitly "the environment's" today gains a `threadId`.

Option B is what moves 3 and 4 already assume. **This choice is a prerequisite for
them, not a consequence.**

### 2.3 Contract changes

**Thread gains its sandbox.** Mirror the `sandboxes` table onto the thread rather than
inventing a parallel vocabulary:

```
OrchestrationThread
└── sandbox: ThreadSandbox | null        ← null = never requested
    ├── desiredState: "running" | "stopped" | "removed"
    ├── status: "not-created" | "initializing" | "ready" | "stopped"
    │         | "removing" | "removed" | "error"      ← moatless SandboxStatus
    ├── stopReason: "user" | "idle-reaper" | "cleanup" | "system" | "error" | null
    ├── startedAt: IsoDateTime | null
    ├── idleTtlMinutes: NonNegativeInt
    ├── siteUrl: Url | null               ← the preview origin, see Move 3
    └── image: { current, latest, upToDate }
```

`desiredState` and `status` must both be on the wire. Moatless's lifecycle is a
reconciler — desired vs. observed — and flattening them into one field destroys the
"stopping…" and "start requested, not yet ready" states the UI needs.

**`worktreePath` survives, with a new referent.** Keep the field; it now names the
workspace directory *inside* the sandbox (`/opt/moatless/workspace/{mount}`). Retire
`vcs.createWorktree` / `vcs.removeWorktree`: provisioning the sandbox *is* creating the
worktree. This is the §6.4 point from the concept map — same problem, solved one layer
down — so it should be recorded as a relocation, not a feature deletion.

**The bootstrap seam already exists and already fits.** `thread.turn.start` carries:

```ts
bootstrap?: {
  createThread?:    { projectId, title, modelSelection, branch, worktreePath, … }
  prepareWorktree?: { projectCwd, baseBranch, branch?, startFromOrigin? }
  runSetupScript?:  boolean
}
```

That is lazy provisioning with a branch and a setup step — which is exactly what
`POST /api/v1/tasks` + sandbox provision + workspace setup commands do. **No new
command is needed for the common path.** `prepareWorktree` is reinterpreted as
"provision the sandbox on this branch"; `runSetupScript` as "run the workspace setup
commands".

**One new command for explicit lifecycle**, since the UI needs stop/restart/redeploy
independent of a turn:

```
thread.sandbox.set-desired-state  { threadId, desiredState, stopReason? }
thread.sandbox.redeploy           { threadId }
```

**New capability flags**, so a stock T3 server keeps working unchanged:
`sandboxLifecycle`, `declaredServers` (Move 3), `sandboxDiagnostics` (Move 4). All
`optionalKey`, absent ⇒ unsupported, per contract §4 rule 1.

### 2.4 What T3 gives up

Today two threads can share one checkout, or run directly in the project root with no
worktree at all. Under sandbox-per-task that is gone, and a throwaway "just ask a
question about this repo" thread costs a pod.

The mitigation is already in the model: **`sandbox: null` is a legal thread.** Reads
(shell snapshot, thread history, message list) must not require a sandbox; only turns
do. Provisioning stays lazy and turn-triggered. This is worth stating as a hard rule,
because it is easy to lose the moment someone wires the file browser to the sandbox and
makes every thread page load provision a pod.

### 2.5 Not solved by this move

A Moatless **Workspace** can compose several repositories. A T3 project is one repo,
and `repositoryIdentity` is singular. Move 1 does not fix this — a multi-repo workspace
still has no faithful T3 representation. Either T3 grows a workspace noun above project,
or multi-repo workspaces render as the primary repo and the others are invisible.
Flagged, not designed.

---

## 3. Move 2 — Moatless adopts T3's streaming contract

### 3.1 What has to be true

Contract §5, restated as requirements on Moatless:

1. A subscription is **per thread**, not a global firehose.
2. Every event carries a **monotonic `sequence`** within its scope.
3. `afterSequence` **replays from a cursor**, then emits `synchronized`, then goes live.
4. Absence is signalled by an **idle stream**, never an error.

### 3.2 What Moatless already has — more than the concept map implied

- **`task_events.id` is a `bigserial` primary key**, with `idx_task_events_task_id ON
  task_events (task_id, id)`. A monotonic per-task ordering already exists.
- **Postgres is the durable source of truth.** `sse/routes.rs` is explicit: Redis is
  trimmed by `MAXLEN` with a 72h TTL and is kept *only* for the live tail; history is
  served from `task_events`.
- **`list_events(task_id, types, limit, offset)`** already orders `id ASC`.
- **The gap-free seam is already understood.** The history handler documents loading
  history first, then opening the stream, and deduping by `eventId` across the overlap
  — structurally the same manoeuvre as T3's snapshot-then-`afterSequence`.

The foundation is there. This move is mostly plumbing an existing column onto the wire.

### 3.3 The five deltas

| # | Delta | Where | Size |
|---|---|---|---|
| 1 | `sequence` is not on the wire | `event_row_to_json` emits `eventId` but not `id` | one line + contract change |
| 2 | No cursor query | `list_events` takes `limit`/`offset` | add `after_sequence`, index already supports it |
| 3 | No per-task live stream | only `GET /api/v1/events/stream` (global, `?types=` only) | new route `GET /api/v1/tasks/{id}/events/stream?afterSequence=` |
| 4 | No snapshot frame, no `synchronized` marker | stream is events-only | emit `snapshot \| event \| synchronized` |
| 5 | **The content-carrying event is not persisted** | `EventType::Message` is *"assembled server-side and relayed to clients, never persisted to `task_events`"* | design work — see below |

### 3.4 Delta 5 is the real one

`agent.message` is persisted and content-free by deliberate policy (ADR-0003, migration
`0089`: content lives once, in `task_messages`). `message.upsert` carries the assembled
`UiMessage` — and is never written down.

So the event a client most needs to replay is precisely the one it cannot. Three ways
out, in increasing cost:

- **(a) Re-derive on replay.** When serving `afterSequence`, join `task_messages` for
  rows touched in that range and synthesize `message.upsert` frames. Respects ADR-0003
  — content still lives once — and needs no schema change. Requires a message→sequence
  correspondence, which `task_messages` does not have today. **Recommended.**
- **(b) Persist a message-pointer event.** Write a real `task_events` row for
  `message.upsert` containing only `{uuid, sequence}`, and let the client fetch content.
  Cheap, but reintroduces the re-fetch-per-message cost the concept map warns about.
- **(c) Persist the assembled message.** Directly contradicts ADR-0003. Not recommended
  without revisiting that decision on its own terms.

Note what already works: text blocks arrive intact on the live path, and
`strip_heavy_fields` exempts `ExitPlanMode` and `AskUserQuestion` so plan and question
UIs are complete without a fetch. Only `tool_input` previews (~100 chars),
`tool_result.content` (200 chars), and `typed_result`/`sdk_metadata` need a fetch.

### 3.5 The hazard: `bigserial` is not a safe cursor

A sequence assigned at `INSERT` but made visible at `COMMIT` can be **read out of
order**. Two concurrent writers take ids 100 and 101; 101 commits first; a reader
polling `id > 99` sees 101, advances its cursor to 101, and never sees 100.

T3's contract already names this class of bug from the other side — *"a server must
attach its live event buffer before querying the snapshot, or an event published
mid-query is lost"* (`ws.ts:1226`). Moatless needs the equivalent guard. Options:

- Serve the catch-up from the **live consumer's buffer** rather than a fresh `SELECT`,
  so the reader never straddles a commit boundary.
- Or hold the cursor below the oldest in-flight transaction (`pg_snapshot_xmin`),
  trading a little latency for correctness.
- Or allocate the sequence **inside the transaction** from a per-task counter, so
  ordering and visibility coincide.

This is the one genuinely hard part of Move 2 and it should be settled before anything
is built on the cursor.

Two smaller notes: T3's `sequence` is `NonNegativeInt` (a JS number), while
`task_events.id` is `i64` — fine for a very long time, but a per-task counter would
also fix this. And today's SSE lag is *silent* — `sse/routes.rs` logs `SSE client
lagged, skipping events` and drops frames with no way for the client to know. **Adding
`sequence` alone makes that detectable**, which is a real win independent of the rest.

### 3.6 What T3's side needs

Almost nothing, which is the point of choosing this direction. The adapter maps
Moatless's per-task stream to `subscribeThread` and a repositories+tasks stream to
`subscribeShell`. `replayEvents` becomes implementable for the first time.

---

## 4. Move 3 — preview servers adopt the Moatless model

### 4.1 First, untangle the word

The concept map's §3.4 correction matters here. **T3's `preview.*` is the in-app browser
tab** — `PreviewSessionSnapshot` is `{threadId, tabId, navStatus, canGoBack,
canGoForward, viewport}`, driven by `apps/server/src/preview/Manager.ts`. It is not the
process.

T3's *process* side is a separate chain: a `ProjectScript` from `t3.json` runs in a
**terminal**, and `PortScanner.ts` finds the listener afterwards —
`DiscoveredLocalServer` is `{host, port, url, processName, pid, terminal: {threadId,
terminalId}}`.

Moatless declares servers in workspace config, runs them as sidecars, and exposes
status, logs, per-server restart, and start-command overrides.

**The move is: replace discovery with declaration.** `preview.*` (the browser) is not
touched; it just points at a declared server's URL instead of a scanned port.

### 4.2 `t3.json` is already most of a declaration

`T3ProjectFileScript` has `name`, `command`, `runOnWorktreeCreate`, `previewUrl`,
`autoOpenPreview`. A script with `previewUrl` *is* a declared server missing only its
port and env. Proposed addition:

```jsonc
{
  "servers": [
    {
      "name": "web",
      "command": "pnpm dev",
      "port": 5733,
      "env": { "NODE_ENV": "development" },
      "autoStart": true
    }
  ]
}
```

Scripts stay scripts (one-shot, terminal-hosted). Servers are the long-running,
supervised, restartable things. Today `runOnWorktreeCreate` + `previewUrl` conflates
the two.

### 4.3 New contract group

Replacing `subscribeDiscoveredLocalServers` — the one method in the preview group with
a genuine Moatless correspondence:

| Method | Payload | Moatless |
|---|---|---|
| `servers.list` | `{threadId}` → `ServerStatus[]` | `GET /api/sandbox/v1/tasks/{id}/server/status` |
| `servers.restart` | `{threadId, name}` | `POST .../servers/{name}/restart` |
| `servers.setOverride` | `{threadId, name, startCommand?, env?}` | `PATCH .../servers/{name}` (gRPC `ApplyServerConfig`) |
| `servers.clearOverride` | `{threadId, name}` | `DELETE .../servers/{name}/override` |
| `subscribeServerStatus` ◆ | `{threadId}` → status events | firehose `?types=server` |
| `servers.subscribeLogs` ◆ | `{threadId, name}` → log lines | `GET .../servers/{name}/logs` (SSE) |

Every one carries `threadId` — Option B from §2.2.

Note the override semantics, which are unusual and worth preserving verbatim: the
override is **complete state, never a delta**; the caller reads, merges, and writes the
whole thing. Applying it bumps a generation counter so the sidecar re-execs its child
*without recreating the container*. That is a better restart primitive than T3 has, and
the reason `preview.refresh` (reload the page) and `servers.restart` (re-exec the
process) must stay distinct operations.

### 4.4 The trade

**Gained:** deterministic startup, restart without pod recreation, per-server logs,
per-server overrides, a stable `siteUrl` instead of a guessed port.

**Lost:** a server the agent starts by hand in a terminal is no longer visible. This is
not hypothetical — it is the normal way an agent brings up a dev server today.
**Mitigation: keep the port scanner as a secondary source**, and mark its results
`origin: "discovered"` against `origin: "declared"`. Dropping discovery entirely would
be a regression sold as a cleanup.

---

## 5. Move 4 — diagnostics rescope from environment to sandbox

### 5.1 What is env-scoped today

`ServerProcessDiagnosticsResult` roots a process tree at **`serverPid`** — the T3
server's own pid — and walks descendants. `server.signalProcess` enforces that with
`ProcessDiagnosticsNotDescendantError`: you may only signal a descendant of the server
process.

That model has no meaning when the processes live in a pod on another machine.

### 5.2 The rescope

| Today | Becomes | Backed by |
|---|---|---|
| `server.getProcessDiagnostics` `{}` | `sandbox.getProcessDiagnostics` `{threadId}` | `SandboxStatusFullResponse.{backgroundProcesses, containerDiagnostics, scheduledJobs}` |
| `server.getProcessResourceHistory` `{windowMs, bucketMs}` | `sandbox.getProcessResourceHistory` `{threadId, windowMs, bucketMs}` | `resources` field + `Resources` events |
| `server.signalProcess` | `sandbox.signalProcess` `{threadId, …}` | lifecycle verbs / exec |
| `server.getTraceDiagnostics` | **stays env-scoped** | the backend's own trace file |

`getTraceDiagnostics` is the exception worth being deliberate about: it reads the
server's trace file, which under Option B is the Moatless backend's, not any sandbox's.
Leave it where it is rather than rescoping it reflexively.

### 5.3 Two shape changes

**The root is a container, not a pid.** `serverPid: PositiveInt` becomes
`roots: { containerName, pid }[]` — a pod has several containers (agent, server
sidecars) and no single root. Downstream, `ServerProcessDiagnosticsEntry.depth` and
`childPids` stay meaningful *within* a container.

**The descendant guard gets stronger, not weaker.**
`ProcessDiagnosticsNotDescendantError` — "this pid is not below the server" — becomes
"this pid is not in this sandbox", enforced by namespace rather than by walking
`ppid`. Keep the error tag; the containment check is now a property of the runtime
rather than a check the server performs.

**New fields worth surfacing** while the shape is open: `imageUpToDate`,
`currentSandboxImage`, `latestSandboxImage`, `sandboxError`, `runtimeEvents`. These
already exist in `SandboxStatusFullResponse` and have no T3 home.

---

## 6. Sequencing

Dependency-ordered, not value-ordered.

**Move 0 — decide Option B.** Half a page, no code. Moves 3 and 4 both assume
`threadId` on formerly env-scoped methods; building either before this is settled means
building it twice.

**Then Move 2 (streaming).** Independent of the other three, unblocks all of them, and
the first two deltas (`sequence` on the wire, `after_sequence` on the query) are small
enough to land on their own and immediately make SSE lag detectable. Settle §3.5 before
building on the cursor. Delta 5 can land later — a client can re-fetch in the interim.

**Then Move 4 (diagnostics).** The smallest of the three contract changes and the one
that proves the `threadId`-scoping pattern on a low-traffic surface, where being wrong
is cheap.

**Then Move 3 (servers).** Needs Move 2 for status events and Move 4's precedent for
scoping.

**Then Move 1 (domain).** Largest, most disruptive, and the one that benefits most from
the other three already being in place — by then `threadId`-scoped sandbox state is an
established pattern rather than a novelty.

---

## 7. Open questions

1. **Is ADR-0003 negotiable?** §3.4(a) works within it; if it is not load-bearing,
   (b) is simpler. Someone who knows why it was written should answer before that
   choice is made.
2. **Per-task sequence or global `bigserial`?** A per-task counter allocated in-txn
   fixes both the commit-ordering hazard and the `NonNegativeInt` range at the cost of
   a write-path change.
3. **What happens to threads with no sandbox in the UI?** The rule in §2.4 is clear;
   whether the UI can render a thread with no live compute without looking broken is a
   product question, not a contract one.
4. **Multi-repo workspaces** (§2.5) — grow a workspace noun, or accept lossy rendering?
5. **Does the port scanner survive?** §4.4 says yes as a secondary source. If it does
   not, agent-started servers become invisible and that should be an explicit decision.
6. **Terminal remains absent.** Nine RPC methods with nothing behind them, and this
   plan does not address it. Note that §4.4's fallback (agents starting servers in a
   terminal) presumes a terminal exists — under Moatless it does not, which makes
   declared servers load-bearing rather than merely preferable.

---

## 8. What this is not

Not a migration plan — there are no phases, estimates, or file lists here, because the
Option B decision in §2.2 and the cursor question in §3.5 both change what the work is.
Not a commitment to do any of it. And not a replacement for
[`moatless-adapter.md`](./moatless-adapter.md): the adapter needs none of this, and
every move above makes the adapter smaller rather than obsolete.
