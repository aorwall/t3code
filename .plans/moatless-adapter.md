# t3code → Moatless adapter

**Status:** M0a landed. M0b onward specified, not started.
**Supersedes:** the original "t3code → Moatless API adapter" plan (client-side seam
swap). See [What changed](#what-changed-and-why) for the delta and why.
**Evidence date:** all API facts in this document were measured against
`https://moatless.soaplabstest.com` on 2026-07-26 with a `mvk_` API key. Claims are
tagged **[verified]**, **[inferred]**, or **[unverified]**. Do not promote an
`[unverified]` line to a design decision without measuring it first.

---

## 1. The shape in one paragraph

t3code's web client already talks to exactly one server-shaped thing: an HTTP API of
four orchestration endpoints plus an Effect-RPC WebSocket of 70 methods. **We write a
new Node server that speaks that contract and answers it out of the Moatless REST
API.** The web client, `packages/client-runtime`, and `packages/contracts` are not
modified at all. The new server is `apps/moatless-adapter`; the pure mapping logic
lives beside it in `packages/moatless-api` so it is testable without a socket. The
Vite dev server keeps its M0a role — it proxies `/api`, `/attachments` and `/ws` to
whatever `T3CODE_PROXY_TARGET` names, which is now the adapter instead of Moatless
directly.

```
browser (preview origin, same-origin only)
   │  /api/orchestration/*, /api/auth/*, /ws        ← t3's own contract, unchanged
   ▼
vite dev server (apps/web)  ── proxy, T3CODE_PROXY_TARGET ──▶
   │
   ▼
apps/moatless-adapter  :13773        ← NEW. speaks t3 contract, holds MOATLESS_API_KEY
   │  /api/v1/tasks, /repositories, /messages, /events/stream
   ▼
https://moatless.soaplabstest.com    ← unchanged, consumed as-is
```

---

## 2. What changed, and why

The original plan swapped three `Context.Service` seams inside the browser
(`ShellSnapshotLoader`, `ThreadSnapshotLoader`, `RpcSessionFactory`) and trimmed
`packages/contracts` down to what Moatless can serve. That is still a coherent
design. We are not doing it, for four reasons:

| | Client-side seam swap (old) | Server-side adapter (this doc) |
|---|---|---|
| Changes to `apps/web` / `client-runtime` / `contracts` | Extensive; contract trim is irreversible | **None** |
| Effect-RPC WebSocket framing | Must be reimplemented client-side against a REST/SSE backend | Served by us, with `apps/server` as a working reference implementation |
| Pairing / auth | Connection layer collapse (Part B4 of the old plan) | Three endpoints answer "already authenticated" |
| Shareable deployment | Blocked — the API key lives in Vite dev middleware | Works — the key lives in a real server |

The cost is real and is stated plainly in [§6.3](#63-the-property-we-give-up).

Two parts of the old plan survive essentially unchanged and are the actual work:
the **message-model adapter** (old Part D, here [§8](#8-message-model)) and the
**shell/thread/dispatch mappers** (old Part C, here [§7](#7-adapter-internals)). They
do not care whether they run in a browser or in Node.

### Corrections to the old plan's factual claims

Measured, and each one changes a design decision:

| # | Old plan said | Measured | Consequence |
|---|---|---|---|
| 1 | `message.upsert` carries one assembled `UiMessage`, so streaming splits incrementally | `agent.message` payload is `{blockCount, message:{role}, toolNames, uuid}` — **no content** | The adapter must re-fetch on notify. [§9.3](#93-the-refetch-problem) |
| 2 | "`GET /api/v1/tasks` … two calls, not a fan-out — cheap" | **4,641 tasks**, `?status=open` → 110 | Unfiltered listing is not viable. [§7.1](#71-shell-snapshot) |
| 3 | Session status from `LiveStatus.agentStatus` | No `liveStatus` field and no live-status endpoint exists (`/status`, `/live`, `/session` → 404) | Status must be derived from the event log. [§7.4](#74-session-status) |
| 4 | `modelSelection.model ← task.model` | `TaskResponse` has **no** `model` field; messages carry `model` | Model comes from the newest message, else null. [§7.1](#71-shell-snapshot) |
| 5 | `instanceId ← agentType`, "two fixed instances: `claude-code`, `codex`" | Five observed: `codex`, `claude-code-cli`, `claude-code`, `claude-code-fable`, `claude-code-tui` | Provider instances are enumerated from data, not hardcoded |
| 6 | Task `status` is open/closed | Three values observed: `open`, `closed`, `error` | `error` must map somewhere; see [§5](#5-domain-mapping) |
| 7 | `usage` feeds `context-window.updated {used, total}` | `usage` = `{inputTokens, outputTokens, cacheCreationInputTokens, cacheReadInputTokens}` — no total | Total must come from a model table or the meter is omitted |
| 8 | `project.repositoryIdentity ← repository.remoteUrl` — "direct, no join" | `repositoryIdentity` is a **struct** (`{canonicalKey, locator:{source,remoteName,remoteUrl}, …}`), not a string | Needs construction, not assignment |

---

## 3. Repository layout

```
apps/moatless-adapter/          # NEW — @t3tools/moatless-adapter
  src/
    bin.ts                      # entrypoint; reads env, builds layers, listens
    config.ts                   # MOATLESS_BASE_URL, MOATLESS_API_KEY, PORT, HOST
    http/
      api.ts                    # EnvironmentHttpApi handlers (metadata/auth/orchestration/connect)
      auth.ts                   # the "already authenticated" session model (§6.2)
    ws/
      server.ts                 # RpcServer over /ws — framing copied from apps/server
      orchestration.ts          # dispatchCommand, subscribeShell, subscribeThread
      stubs.ts                  # the other ~60 methods, one table (§6.3)
    stream/
      moatlessEvents.ts         # SSE consumer → fan-out per task
      shellStream.ts            # → OrchestrationShellStreamItem
      threadStream.ts           # → OrchestrationThreadStreamItem

packages/moatless-api/          # NEW — @t3tools/moatless-api (pure, no I/O beyond fetch)
  src/
    generated/                  # orval output, client mode "fetch"
    openapi-specs.json          # vendored (§10.1)
    client.ts                   # Effect wrapper: fetch + error mapping
    ids.ts                      # ProjectId↔repositoryId, ThreadId↔taskId branding
    shell.ts                    # repositories + tasks → OrchestrationShellSnapshot
    thread.ts                   # task + messages → OrchestrationThreadDetailSnapshot
    messages.ts                 # UiMessage[] → {messages, activities, proposedPlans}
    dispatch.ts                 # ClientOrchestrationCommand → REST calls
    events.ts                   # Moatless event → t3 stream item
    __fixtures__/               # recorded API responses (§11)
```

Naming: the user-facing name for the host is `moatless-adapter` (an app you run);
`moatless-api` is the library it and the tests import. Keeping them separate is what
makes [§8](#8-message-model) testable with zero network.

**Not touched:** `apps/web`, `packages/client-runtime`, `packages/contracts`,
`apps/server`. `apps/server` stays in the tree as the reference implementation for WS
framing and as the upstream-comparison workspace.

**Port 13773.** The adapter deliberately takes the port `apps/server` uses, so the
existing workspace server config (`T3CODE_PROXY_TARGET=http://127.0.0.1:13773`) is
unchanged — you swap which process occupies the port, not the wiring.

---

## 4. What M0a already delivered

Landed in `apps/web/vite.config.ts`:

- `T3CODE_PROXY_TARGET` (alias `MOATLESS_BASE_URL`) selects the proxy target;
  falls back to the `VITE_WS_URL`-derived target so stock `pnpm dev` is unchanged.
- `VITE_WS_URL` / `VITE_HTTP_URL` blanked when the override is active, so the client
  resolves to `window.location.origin`. **[verified]** in the served module.
- `allowedHosts: true` — the sandbox preview hostname is not knowable ahead of time.
- `/ws` proxied with `ws: true`, alongside `/api`, `/attachments`, `/.well-known`.
- `Authorization: Bearer` injected and `cookie` stripped **only when the target is
  not loopback** — a Moatless key can never reach a local t3 server.
- Credential-shaped `VITE_*` values are deleted from `process.env` before Vite reads
  them, and a build-time assertion rejects any `define` value containing `mvk_`.

That last item closed a live leak: Vite inlines the whole `import.meta.env` object,
including every `VITE_*` entry of `process.env`, and Moatless sandboxes inject
`VITE_API_KEY=mvk_…`. **[verified]** — `VITE_REMOTE_API` (process-env-only, not in
`define`) still appears in `dist/assets/index-*.js`, and `VITE_API_KEY` no longer
does.

Nothing in M0a changes when the adapter lands. The proxy target moves from
`https://moatless.soaplabstest.com` to `http://127.0.0.1:13773`, which also means
the browser stops needing the key at all — the adapter holds it.

### 4.1 Three sandbox-specific changes made during M3

All three are in `apps/web/vite.config.ts` and all three exist because the hosted
sandbox owns the dev server's environment.

**`T3CODE_PROXY_TARGET_OVERRIDE`, read from repo env *files* only.** `loadRepoEnv`
lets the ambient environment win over `.env` / `.env.local`, which is right for
everything it resolves — except the proxy target. The sandbox injects
`T3CODE_PROXY_TARGET=http://127.0.0.1:13773` pointing at its own bundled t3 server,
and a checkout has to be able to say "no, use mine" without editing the deployment.
The override is file-only and, being explicitly an override, outranks the ambient
value. `.env.local` (gitignored) carries it; it holds no credential.

**Fast Refresh is turned off when `NODE_ENV=production`.**
`@vitejs/plugin-react` v6 enables the oxc Fast Refresh *transform* for every
`serve` run, but injects its runtime preamble only when the config resolves as
development (`skipFastRefresh = isProduction || command === "build" || …`). A
sandbox that exports `NODE_ENV=production` process-wide splits those two decisions:
modules come back full of `$RefreshReg$` calls with nothing to answer them and the
app dies on its first import with a blank page and no server-side error. A small
`enforce: "post"` plugin applies the plugin's own rule to the transform, so dev
degrades to full-reload HMR instead of breaking.

Forcing `NODE_ENV=development` instead is *not* the cheaper fix: with a development
dep cache, `react/compiler-runtime`'s `exports.c` sits inside a
`if (NODE_ENV !== "production")` block where cjs-module-lexer cannot see it, the
optimizer emits a default-only module, and the app dies on
`does not provide an export named 'c'`. Two bugs instead of one. **[verified]** —
reproduced with a clean isolated `cacheDir`.

**The HMR socket endpoint is no longer pinned when the bind address is a wildcard.**
Upstream pins `hmr: { protocol: "ws", host, clientPort: port }` so the socket
connects reliably inside Electron's `BrowserWindow`, where the window loads
`http://localhost:<port>` directly. The sandbox sets `HOST=0.0.0.0`, which turned
that into a literal `ws://0.0.0.0:5733/` in the served `/@vite/client` — an address
no browser can dial, and blocked as mixed content the moment the page is served
over the HTTPS preview hostname. Left unset, Vite's client derives the socket URL
from the page's own origin, which is correct for both a proxy and a plain local
run, so the pin now applies only when `HOST` names a dialable address. **[verified]**
— under a stand-in HTTPS gateway on a foreign hostname the client opens
`wss://<preview-host>/?token=…` with no mixed-content warning; previously it logged
one and fell back.

This was a real defect but *not* what §11.2 is about: the app rendered either way.

---

## 5. Domain mapping

| t3code | Moatless | Notes |
|---|---|---|
| Project | Repository | Sidebar top level. `GET /api/v1/repositories` **[verified]** |
| Thread | Task | `projectId = task.repositoryId` **[verified]**, required, always present |
| Turn | `turnNumber` (int) on messages **[verified]** | `turnId = String(turnNumber)`; see gap G3 |
| Session | derived, not a resource | No session object on the wire. [§7.4](#74-session-status) |
| `ProjectId` | `repository.id` (uuid) | Brand at the adapter boundary |
| `ThreadId` | `task.taskId` (uuid) | ditto |
| `thread.archivedAt` | `task.status === 'closed'` | No `closedAt` field exists; use `lastMessageAt` as the stamp |
| `thread.branch` | `task.branch` **[verified]** | Present on 143/200 sampled tasks; nullable |
| `thread.title` | `task.title` **[verified]** | Non-null on 200/200 sampled; fall back to `description` |
| `interactionMode` | message `agentMode` (`edit`\|`plan`) **[verified]** | `edit → 'default'`, `plan → 'plan'` |
| `modelSelection.instanceId` | `task.agentType` **[verified]** | 5 observed values, see correction #5 |
| `modelSelection.model` | newest message's `model` | **not** on `TaskResponse` (correction #4) |
| `project.repositoryIdentity` | constructed from `repository.remoteUrl` | struct, not a string (correction #8) |
| `project.workspaceRoot` | `/opt/moatless/workspace/{repo-name}` | **[verified]** from this sandbox's own layout |
| `project.scripts` | — | `[]` |
| `runtimeMode` | — | pinned `'full-access'` |
| `worktreePath`, `checkpoints`, `settledAt`, `snoozedUntil` | — | `null` / `[]`; affordances suppressed via capabilities where possible ([§6.3](#63-the-property-we-give-up)) |

**`task.status === 'error'`** has no t3 equivalent. Map it to a live thread whose
`session.status = 'error'` and `session.lastError` set from the newest
`agent`/`server` error event; do **not** archive it, or failed tasks vanish from the
sidebar.

**Dangling `projectId`.** A task whose `repositoryId` matches no readable repository
produces a thread under a nonexistent project and breaks
`getVisibleThreadsForProject`. Drop such tasks in the shell mapper and log once per
distinct id. Assert it with a fixture.

**Two Moatless repositories can share one git remote, and t3 merges them.** The
sidebar groups projects by `repositoryIdentity.canonicalKey`, so `saasocalypse` and
`saasocalypse-public` — distinct Moatless repositories, both pointing at
`github.com/soaplabs/saasocalypse` — render under a single header labelled with the
first project's title. **[verified]** in the browser: the second project's threads
still appear under that header, so nothing is lost but the `-public` label. This is
faithful mapping meeting t3's own grouping rule, not an adapter defect, and it is
left alone deliberately: synthesizing a distinct `canonicalKey` per Moatless
repository would misreport repository identity, which t3 also uses for worktree and
VCS association. If the label matters more than the identity, the fix belongs
upstream — one Moatless repository record per remote.

---

## 6. The contract the adapter must serve

### 6.1 HTTP — `EnvironmentHttpApi`

Four groups, 23 endpoints, defined in `packages/contracts/src/environmentHttp.ts`.

| Group | Endpoint | Adapter behaviour |
|---|---|---|
| metadata | `GET /.well-known/t3/environment` | **implement** — `ExecutionEnvironmentDescriptor` (§6.3) |
| auth | `GET /api/auth/session` | **implement** — always authenticated (§6.2) |
| auth | `POST /api/auth/browser-session` | **implement** — accept any credential, return authenticated |
| auth | `POST /api/auth/websocket-ticket` | **implement** — opaque ticket, short TTL |
| auth | `POST /oauth/token` | reject `invalid_request` |
| auth | `pairing-token`, `pairing-links`, `pairing-links/revoke` | reject `invalid_request` — nothing to pair |
| auth | `clients`, `clients/revoke`, `clients/revoke-others` | `clients` → `[]`; revokes reject |
| orchestration | `GET /api/orchestration/shell` | **implement** (§7.1) |
| orchestration | `GET /api/orchestration/threads/:threadId` | **implement** (§7.2) |
| orchestration | `POST /api/orchestration/dispatch` | **implement** (§7.3) |
| orchestration | `GET /api/orchestration/snapshot` | **implement** as shell + empty threads; the shell path does not use it |
| connect | all 8 (`/api/connect/*`, `/api/t3-connect/*`) | `EnvironmentCloudEndpointUnavailableError` — T3 Connect is out of scope |

Errors are the existing tagged errors: `EnvironmentRequestInvalidError` (400),
`EnvironmentAuthInvalidError` (401), `EnvironmentScopeRequiredError` (403),
`EnvironmentResourceNotFoundError` (404), `EnvironmentInternalError` (500). Moatless
failures map to `EnvironmentInternalError` with the nearest `reason` literal;
Moatless 404 on a task maps to `EnvironmentResourceNotFoundError{reason:
'thread_not_found'}`.

### 6.2 Auth and session

The adapter is a single-identity front end for one Moatless API key. It does not
authenticate its callers, and it must not pretend to.

- `GET /api/auth/session` → `{authenticated: true, auth: <descriptor>, scopes:
  AuthStandardClientScopes, sessionMethod: 'browser-session-cookie'}`.
- `POST /api/auth/websocket-ticket` → a random ticket with a short TTL, stored
  in-process and consumed once by the `/ws` upgrade.
- Every request is executed against Moatless as the key's owner. **[verified]**:
  `GET /api/v1/auth/me` through the M0a proxy returned the key owner's identity.

Consequences, which are the same as the old plan's and no better:

- Everything the prototype does is attributed to one user, and the sidebar shows
  only what that user can read.
- **The adapter must not be exposed beyond the sandbox.** It grants its Moatless
  identity to anyone who can reach the port. It binds `127.0.0.1` by default; binding
  `0.0.0.0` requires an explicit `MOATLESS_ADAPTER_BIND_ALL=1`, and the sandbox
  reaches it over pod-shared loopback so it never needs that.
- A Moatless `401` is a **configuration** error, not a user one. Surface it as a
  blocking "Moatless API key rejected" banner via `EnvironmentAuthInvalidError` on
  the orchestration endpoints. Do not render t3's pairing flow; it cannot fix a
  server-side env var.

### 6.3 WebSocket — `WsRpcGroup`, and the property we give up

`WsRpcGroup` has **70 members** (`packages/contracts/src/rpc.ts`). `RpcGroup`
requires a handler for every one, so TypeScript still hands us the exhaustive list —
what we lose relative to the old plan's contract trim is that an unsupported feature
becomes a **runtime** error in a UI we did not change, instead of a compile error at
the call site.

Three mitigations, in order of how much they actually help:

1. **`ExecutionEnvironmentCapabilities`** (in `packages/contracts/src/environment.ts`)
   is a real, existing negotiation channel and clients treat missing flags as
   unsupported. It covers `repositoryIdentity`, `connectionProbe`,
   `threadSettlement`, `threadSnooze`, `serverSelfUpdate` — so declaring
   `threadSettlement: false, threadSnooze: false` genuinely stops the client sending
   settle/snooze. **It does not cover terminal, preview, checkpoints, worktrees,
   approvals or source control.** Those affordances stay visible and fail on click.
2. **Empty streams, not errors,** for everything the client subscribes to eagerly.
   Erroring one of these can fault the whole connection.
3. **One `notSupported` table**, so the unsupported set is a single reviewable list
   rather than 60 scattered decisions.

Classification of all 70:

**Implement (10)**
`orchestration.dispatchCommand`, `orchestration.subscribeShell`,
`orchestration.subscribeThread`, `orchestration.getArchivedShellSnapshot`,
`server.probe`, `server.getConfig`, `server.getSettings`,
`subscribeServerConfig` (one frame then idle), `subscribeAuthAccess` (one frame then
idle), `assets.createUrl` (deferred to M6; until then `notSupported`).

**Empty stream — must never error (6)**
`subscribeServerLifecycle`, `subscribeVcsStatus`, `subscribeTerminalEvents`,
`subscribeTerminalMetadata`, `subscribePreviewEvents`,
`subscribeDiscoveredLocalServers`.

**Empty success (4)**
`orchestration.getTurnDiff`, `orchestration.getFullThreadDiff`,
`orchestration.replayEvents` (we hold no durable event cursor — see [§9.4](#94-no-durable-cursor)),
`server.refreshProviders`.

**Accept and discard (3)** — client-side preferences the UI writes on interaction;
erroring these produces visible failures for no benefit.
`server.upsertKeybinding`, `server.removeKeybinding`, `server.updateSettings`.

**`notSupported` (47)** — everything else:
`server.updateProvider`, `server.updateServer`, `server.discoverSourceControl`,
`server.getTraceDiagnostics`, `server.getProcessDiagnostics`,
`server.getProcessResourceHistory`, `server.signalProcess`,
`cloud.getRelayClientStatus`, `cloud.installRelayClient`,
`sourceControl.{lookup,clone,publish}Repository`,
`projects.{listEntries,readFile,searchEntries,writeFile}`,
`shell.openInEditor`, `filesystem.browse`, `vcs.{pull,refreshStatus,listRefs,createWorktree,removeWorktree,createRef,switchRef,init}`,
`git.{runStackedAction,resolvePullRequest,preparePullRequestThread}`,
`review.getDiffPreview`,
`terminal.{open,attach,write,resize,clear,restart,close}`,
`preview.{open,navigate,resize,refresh,close,list,reportStatus}`,
`previewAutomation.{connect,respond,focusHost}`.

10 + 6 + 4 + 3 + 47 = 70 **[verified]** against the resolved member list. Note
`projects.list`, `projects.add` and `projects.remove` exist as method tags in
`rpc.ts` but belong to a different group — only the four file-browsing `projects.*`
methods are `WsRpcGroup` members.

**The stub table is the specification.** Write it as one file with one entry per
method and a one-line reason; a reviewer should be able to read the whole
unsupported surface in 60 seconds.

### 6.4 Commands

`ClientOrchestrationCommand` has 20 variants. Eight have a Moatless call:

| Command | Moatless | Status |
|---|---|---|
| `thread.create` | `POST /api/v1/tasks` | **[unverified]** — not probed, it creates real state |
| `thread.turn.start` | `POST /api/v1/tasks/{id}/messages` | **[verified]** route exists (empty body → 422) |
| `thread.turn.interrupt` | `POST /api/v1/tasks/{id}/stop` | **[unverified]** |
| `thread.session.stop` | `POST /api/v1/tasks/{id}/stop` | **[unverified]** |
| `thread.archive` / `.unarchive` | `POST /api/v1/tasks/{id}/close` \| `/reopen` | **[unverified]** |
| `thread.meta.update` | `PATCH /api/v1/tasks/{id}` | **[verified]** route exists (empty body → 200) |
| `thread.delete` | `DELETE /api/v1/tasks/{id}` | **[unverified]** — do not implement before M6 |
| `thread.user-input.respond` | `POST /api/v1/tasks/{id}/messages` with tool response | **[unverified]** |

The write routes are unverified **on purpose**: probing them mutates a shared
environment. Verify each one against a task the prototype created itself, as the
first step of the milestone that needs it.

The other 12 (`project.*`, `thread.settle/unsettle/snooze/unsnooze`,
`thread.approval.respond`, `thread.checkpoint.revert`, `thread.runtime-mode.set`,
`thread.interaction-mode.set`) return `EnvironmentRequestInvalidError{reason:
'invalid_command'}`. `settle`/`snooze` are additionally suppressed by capabilities so
the client never sends them.

---

## 7. Adapter internals

### 7.1 Shell snapshot

```
GET /api/v1/repositories                      → 31 repos          [verified]
GET /api/v1/tasks?status=open&limit=…         → 110 open tasks    [verified]
```

**Do not list all tasks.** `GET /api/v1/tasks` reports `pagination.total = 4641`
**[verified]**; `?status=open` reports 110 **[verified]**. The shell loads open tasks
only. Archived threads are served on demand by
`orchestration.getArchivedShellSnapshot`, which is exactly the endpoint t3 provides
for this and which the old plan left unimplemented.

`?repositoryId=<uuid>` filters server-side **[verified]** and is the fallback if the
open-task count grows past a few hundred: fan out per repository and merge.

Pagination envelope is `{items, pagination:{limit, offset, total, hasMore}}`
**[verified]** — offset-based, so the adapter pages until `hasMore` is false.

| `OrchestrationProjectShell` | Source |
|---|---|
| `id` | `repository.id` |
| `title` | `repository.name` |
| `workspaceRoot` | `/opt/moatless/workspace/{repository.name}` |
| `repositoryIdentity` | `{canonicalKey: remoteUrl, locator:{source:'git-remote', remoteName:'origin', remoteUrl}, displayName: name, provider}` |
| `defaultModelSelection` | `null` |
| `scripts` | `[]` |
| `createdAt` / `updatedAt` | direct |

Repositories with no tasks render as empty project rows — that is t3's normal state
and needs no special handling.

| `OrchestrationThreadShell` | Source |
|---|---|
| `id` | `task.taskId` |
| `projectId` | `task.repositoryId` |
| `title` | `task.title` (non-null in 200/200 sampled) else truncated `description` |
| `modelSelection` | `{instanceId: task.agentType, model: <newest message model \| null>}` |
| `runtimeMode` | `'full-access'` |
| `interactionMode` | newest message `agentMode`: `plan → 'plan'`, else `'default'` |
| `branch` | `task.branch` |
| `worktreePath` | `null` |
| `latestTurn` | from `taskTurn.*` events (§7.4) |
| `createdAt` / `updatedAt` | `task.createdAt` / `task.lastMessageAt ?? createdAt` |
| `archivedAt` | `status === 'closed' ? (lastMessageAt ?? createdAt) : null` |
| `session` | derived (§7.4) |
| `latestUserMessageAt` | `task.lastMessageAt` |
| `hasPendingApprovals` | `false` |
| `hasPendingUserInput` | unresolved `AskUserQuestion` in the newest turn |
| `hasActionableProposedPlan` | unimplemented `ExitPlanMode` exists |

**`modelSelection` and `interactionMode` need a message read the sidebar does not
otherwise do.** For 110 threads that is 110 extra requests on cold open — not
acceptable. Resolution: default both (`model: null`, `interactionMode: 'default'`)
in the shell, and fill them in from the thread snapshot when a thread is opened.
`shellReducer` merges by id, so the sidebar corrects itself as threads are visited.
Record this as gap **G4**.

`snapshotSequence` is a monotonic counter the adapter maintains per connection.
Reducers use it for ordering only, never as a durable cursor.

### 7.2 Thread snapshot

```
GET /api/v1/tasks/{id}                → task metadata            [verified]
GET /api/v1/tasks/{id}/messages       → {messages, nextBeforeId, hasMore, totalCount}  [verified]
GET /api/v1/tasks/{id}/events?limit=  → event log for turn/session derivation  [verified]
```

Produces `OrchestrationThread` = the shell fields above, plus `messages`,
`activities`, `proposedPlans` from [§8](#8-message-model), `checkpoints: []`,
`deletedAt: null`.

The messages envelope is **[verified]** `{messages, nextBeforeId, hasMore,
totalCount}`. Paging is backward via `nextBeforeId`. **[verified]** `afterId`,
`sinceId`, `after` and `beforeId` are all ignored as query params on this deployment
(each returned the identical full set), and there is **no** single-message endpoint
(`GET .../messages/{uuid}` → 404). See [§9.3](#93-the-refetch-problem).

### 7.3 Dispatch

Implements `POST /api/orchestration/dispatch` and the identical
`orchestration.dispatchCommand` RPC against the table in [§6.4](#64-commands).
Returns `DispatchResult{sequence}` — the adapter's per-connection counter.

**Optimistic echo.** t3's UI expects a dispatched command to produce events.
`thread.turn.start` posts the message, then the adapter emits a synthetic
`thread.message-sent` on the thread stream so the user's text appears immediately;
the real message reconciles by id when the refetch lands. `threadReducer` already
merges upserts by id, so this is its normal path.

### 7.4 Session status

There is no session resource and no live-status endpoint. **[verified]**:
`/api/v1/tasks/{id}/status`, `/live`, `/live-status`, `/session`, `/state` all 404,
and `TaskResponse` carries no status object — only `sandboxDesiredState`,
`sandboxStartedAt`, `sandboxStopReason`.

Status is derived from `GET /api/v1/tasks/{id}/events`, whose vocabulary is
**[verified]** exhaustively over 500 events on a live task:

| type | subTypes observed | payload keys |
|---|---|---|
| `agent` | `scheduled`, `session_init`, `started`, `message`, `activity`, `completed`, `stopped` | `session_init:{session_id}`, `message:{blockCount,message:{role},toolNames,uuid}`, `activity:{detail}`, `stopped:{source}`, others `{}` |
| `taskTurn` | `active`, `completed`, `stopped` | `{}`, `stopped:{source}` |
| `sandbox` | `initializing`, `ready`, `stopped` | `{eventType,message,reason}` / `{lifecycleEvent,message,nodeName}` / `{initiator,lifecycleEvent,message}` |
| `server` | `starting`, `started`, `stopped`, `failed` | `{message,serverName,status}` |
| `task` | `open`, `metadata.updated` | `{}` / `{description,name}` |

Derivation:

| `OrchestrationSession.status` | Condition |
|---|---|
| `running` | latest `agent.*` is `started`/`message`/`activity`, or latest `taskTurn.*` is `active` |
| `starting` | latest `agent.*` is `scheduled`/`session_init`, or `sandbox` is `initializing` |
| `idle` | latest `agent.*` is `completed` and latest `taskTurn.*` is `completed` |
| `stopped` | latest `agent.stopped` / `taskTurn.stopped` / `sandbox.stopped` |
| `error` | `task.status === 'error'` or latest `server.failed` |

`providerName = task.agentType`. `activeTurnId` = `String(turnNumber)` of the newest
message while `running`, else `null`. `lastError` from the newest `isError: true`
event's `payload.message`.

`latestTurn` comes from the same log: `taskTurn.active` → `state:'running'` with
`requestedAt`/`startedAt` from its timestamp; `taskTurn.completed` → `'completed'`;
`taskTurn.stopped` → `'interrupted'`. `assistantMessageId` = newest assistant
message uuid in that turn.

**Cost.** This is one extra request per thread snapshot, which is fine, plus a scan
on the shell path, which is not. The shell uses the cheap approximation instead —
`status === 'error' → error`, `sandboxDesiredState` for running/stopped — and the
thread snapshot corrects it. Record as gap **G5**.

---

## 8. Message model

The one genuinely hard piece. Pure function, no I/O, exhaustive tests, written and
merged **before** any adapter wiring.

```ts
// packages/moatless-api/src/messages.ts
export function toOrchestrationThreadContent(input: {
  messages: readonly UiMessage[]
  isTaskRunning: boolean
}): {
  messages: OrchestrationMessage[]
  activities: OrchestrationThreadActivity[]
  proposedPlans: OrchestrationProposedPlan[]
}
```

### 8.1 Verified source shapes

Measured over a live task's message list:

```
UiMessage  = { uuid, messageId?, messageType, role, timestamp, sessionId,
               turnNumber: int, agentMode, model, content: UiContentBlock[],
               toolResults?: UiToolResult[], usage?, sentBy? }

UiContentBlock = { type: 'text'|'thinking'|'tool_use', showInUi?, text?,
                   toolUseId?, toolName?, toolInput? }

UiToolResult   = { toolUseId, content, isError }

usage          = { inputTokens, outputTokens,
                   cacheCreationInputTokens, cacheReadInputTokens }
```

**[verified]** — that is the complete observed key union; `messageType` ∈
`{user, assistant}` in the sample. **`showInUi` exists on content blocks and must be
honoured**: a block with `showInUi === false` produces neither a message row nor an
activity. The old plan did not mention it.

`subagentSummary` and `parentUuid` are described in the old plan but did **not**
appear in the sampled task **[unverified]**. Treat them as optional; capture a
fixture from a task that uses the `Task` tool before implementing the
`collab_agent_tool_call` row.

### 8.2 Target shapes

`OrchestrationMessage = {id, role, text, attachments?, turnId, streaming, createdAt,
updatedAt}` — flat. `OrchestrationThreadActivity = {id, tone, kind, summary, payload,
turnId, sequence?, createdAt}` — a parallel log. `deriveWorkLogEntries` (713 LOC in
`apps/web/src/session-logic.ts`) folds activities into rendered rows; we reuse it
verbatim rather than reimplementing it.

`deriveWorkLogEntries` skips `tool.started` entirely and merges `tool.updated` /
`tool.completed` by `collapseKey = "tool:" + payload.toolCallId`. So emit **exactly
one activity per `tool_use` block** — no lifecycle simulation.

### 8.3 Mapping

| Source | Target |
|---|---|
| `role:'user'` | `OrchestrationMessage{role:'user', text: joined text blocks, turnId, streaming:false}` |
| `role:'assistant'` with text | `OrchestrationMessage{role:'assistant', text, streaming: isLast && isTaskRunning}` |
| `role:'assistant'` no text | no message row; tool blocks still emit activities |
| `type:'thinking'` | activity `{kind:'task.progress', tone:'info', summary:'Thinking', payload:{text}}` |
| any block `showInUi === false` | **skipped entirely** |
| `tool_use` `Bash` | `{kind:'tool.completed', tone:'tool', payload:{itemType:'command_execution', command, toolCallId, result, status}}` |
| `tool_use` `Edit`/`Write`/`MultiEdit`/`NotebookEdit` | `itemType:'file_change'`, `payload.input.filePath` |
| `tool_use` `Read`/`Glob`/`Grep`/`LS` | `itemType:'dynamic_tool_call'` |
| `tool_use` `WebSearch`/`WebFetch` | `itemType:'web_search'` |
| `tool_use` `Task` | `itemType:'collab_agent_tool_call'` (summary source unverified, §8.1) |
| `tool_use` `mcp__*` | `itemType:'mcp_tool_call'`, `payload = toolInput` |
| `tool_use` `TodoWrite` | `{kind:'task.progress', tone:'info', payload:{todos}}` |
| `tool_use` `ExitPlanMode` | `OrchestrationProposedPlan{id: toolUseId, planMarkdown: input.plan, turnId, implementedAt:null}` — not an activity |
| `tool_use` `AskUserQuestion` | `{kind:'user-input.requested', tone:'approval', payload:{requestId: toolUseId, questions}}`; a later user message referencing the same `toolUseId` emits `user-input.resolved` |
| `tool_use` `codex.shell`/`.edit`/`.todo_list` | `command_execution` / `file_change` / info |
| matching `UiToolResult{isError:true}` | `payload.status = 'failed'` |
| matching `UiToolResult{isError:false}` | `payload.status = 'completed'` |
| no result **and** running | `kind:'tool.updated'`, `status:'inProgress'` |
| no result **and** not running | `kind:'tool.completed'`, `status:'stopped'` |
| `messageType:'error'` | `{kind:'task.completed', tone:'error', summary, payload}` |
| `usage` on the newest assistant message | **omitted** — no context-window total exists (correction #7) |
| `turnNumber` | `turnId = String(turnNumber)` |

`collectChangedFiles` in `session-logic.ts` walks payloads for `path` / `filePath` /
`relativePath` / `newPath` nested under `item`, `result`, `input`, `data`, `changes`,
`files`, `edits`, `patch`, `operations` — so emitting
`{itemType, command, input, result, status, toolCallId}` is sufficient.

**ID stability is a hard requirement.** `activity.id` must be stable across
re-renders or the virtualized timeline thrashes and scroll anchoring breaks. Use
`toolUseId` where present, else `${message.uuid}:${blockIndex}`. Message ids use
`message.uuid`.

### 8.4 Known fidelity gap

Moatless's dedicated renderers (`TodoWriteToolCall`, `ExitPlanModeToolCall`,
`AskUserQuestionToolCall`, codex cards, subagent cards) are richer than t3's generic
work rows. `ExitPlanMode` and `AskUserQuestion` map to first-class t3 concepts and
come out *better*; `TodoWrite` and the codex cards come out worse. M3 is an explicit
side-by-side comparison gate, not a checkbox — budget for extending t3's work-row
rendering where the loss is real.

---

## 9. Live updates

### 9.1 Transport

Moatless side: `GET /api/v1/events/stream`. **[verified]** the route exists — a
non-existent sibling returns 404 immediately, this one holds the connection open.
The adapter consumes it once per process and fans out per task.

t3 side: `orchestration.subscribeShell` → `OrchestrationShellStreamItem`
(`snapshot` | `synchronized` | `project-upserted` | `project-removed` |
`thread-upserted` | `thread-removed`), and `orchestration.subscribeThread` →
`OrchestrationThreadStreamItem` (`snapshot` | `event` | `synchronized`).

Both accept `afterSequence` and `requestCompletionMarker`. The adapter honours
`requestCompletionMarker` (emit `synchronized` after the initial frame) and
**ignores** `afterSequence`, always sending a full snapshot — see
[§9.4](#94-no-durable-cursor).

### 9.2 Event mapping

| Moatless | t3 |
|---|---|
| `agent.message` | refetch, then `thread.message-sent` / `thread.activity-appended` (§9.3) |
| `agent.activity` `{detail}` | `thread.activity-appended`, `tone:'info'` |
| `agent.started` / `completed` / `stopped` / `scheduled` / `session_init` | `thread.session-set` |
| `taskTurn.active` | `thread.turn-start-requested` |
| `taskTurn.completed` | `thread.turn-diff-completed` |
| `taskTurn.stopped` | `thread.turn-interrupt-requested` |
| `sandbox.*` / `server.*` | `thread.activity-appended`, `tone:'info'` (`error` when `isError`) |
| `task.metadata.updated` | `thread.meta-updated` + shell `thread-upserted` |
| `task.open` / task status change | shell `thread-upserted` |

### 9.3 The refetch problem

**This is the most important correction in this document.** The old plan assumed
`message.upsert` carries an assembled `UiMessage`, making the split incremental. It
does not. **[verified]** payload:

```json
{"blockCount": 1, "message": {"role": "assistant"},
 "toolNames": [], "uuid": "msg_011CdQFS3RSnZn1dgNMhS872"}
```

Only metadata. And **[verified]** there is no single-message endpoint and no forward
cursor on the list endpoint. So on every `agent.message` the adapter's only option is
`GET /api/v1/tasks/{id}/messages` — the whole list.

Mitigations, in the order to apply them:

1. **Only refetch for threads with a live subscriber.** No open chat, no refetch;
   the shell row updates from `lastMessageAt` alone.
2. **Coalesce.** A trailing debounce (250 ms suggested, tune at M4) collapses the
   burst of `agent.message` events during a streaming turn into one refetch.
3. **Diff and emit deltas.** Re-run §8 over the full list, diff against the previous
   result by id, and emit only changed messages/activities. `threadReducer` merges by
   id, so emitting a changed subset is its normal path.
4. **Bound it.** `?limit=` is honoured but its semantics are inconsistent in
   testing (`limit=3` returned 2 of 22 with `hasMore:true`, `totalCount:2`) —
   **[unverified]**, characterise before relying on it.

This makes the chat O(messages) per update instead of O(1). For a 22-message task
that is nothing; for a 500-message task during a fast streaming turn it is the first
thing that will hurt. **Measure at M4 and record the number.** The clean fix is a
backend change (gap G1) and is explicitly Phase 2.

### 9.4 No durable cursor

`subscribeShell`/`subscribeThread` accept `afterSequence` so a client can resume
without a full snapshot. The adapter's sequence is per-connection and per-process; it
has no durable relationship to anything in Moatless. Therefore:

- Ignore `afterSequence` and always send a snapshot.
- `orchestration.replayEvents` returns empty.
- On reconnect the client re-subscribes, takes a fresh snapshot, and the reducer
  reconciles by id.

Do not half-build durable resume. It needs a per-task sequence in Moatless's event
store and is out of scope.

### 9.5 Streaming is unverified end to end

**[unverified], and this is a scheduled risk, not an assumption.** On a quiet stream
the endpoint produced **no bytes at all within 27 s** — not even response headers
(`curl -D -` wrote nothing; `--max-time 8` reported `code=000`, versus an immediate
`404` for a nonexistent path). That is consistent with either "correct SSE, nothing
to say" or "response buffered somewhere". The two are indistinguishable from outside.

Consequences to design around:

- **Do not key `{kind:'synchronized'}` off stream-open.** Emit it after the initial
  snapshot is built from REST, which is under our control.
- **Verify explicitly at M4** with a task that is actively running: confirm rows
  appear incrementally rather than in one burst at turn end. Diagnose as a transport
  problem, not a message-adapter bug.
- The Vite proxy adds a hop, but from M0b the browser talks to the adapter, and the
  adapter talks to Moatless directly — so the proxy is not in the SSE path at all.
  It is the adapter→Moatless hop and the Moatless ingress that matter.

---

## 10. Getting a typed Moatless client

### 10.1 Spec source

`https://moatless.soaplabstest.com/openapi.json` is **not** served (returns the SPA
shell). The spec lives in the moatless-vibe repo as `openapi-specs.json`. **Vendor it
into `packages/moatless-api/src/openapi-specs.json`** with a refresh script, so the
fork builds without a moatless-vibe checkout. Pin the source commit in a header
comment.

Run orval in **client mode `fetch`, not `react-query`** — the adapter lives inside
Effect, in Node, not React.

### 10.2 Base URL and credential

`packages/moatless-api` takes both as constructor arguments and reads no environment
itself. `apps/moatless-adapter/src/config.ts` is the only place that reads
`MOATLESS_BASE_URL` and `MOATLESS_API_KEY`. Nothing in the library hardcodes a host.

`MOATLESS_API_KEY` is un-prefixed deliberately. In a Moatless sandbox it arrives as a
secret through `server.env`; M0a additionally salvages the platform-injected
`VITE_API_KEY` after stripping it from the client env, which makes the sandbox
zero-config. An explicit `MOATLESS_API_KEY` always wins.

---

## 11. Testing

**§8 message adapter — tier 1, exhaustive.** Pure function, so golden-file tests.
Capture real `UiMessage[]` from a Claude task and a Codex task via
`GET /api/v1/tasks/{id}/messages`, commit as fixtures under
`packages/moatless-api/src/__fixtures__/`, assert the output. Every row of the §8.3
table needs a case, plus `status` transitions (`inProgress → completed → failed`),
`showInUi:false` suppression, and the stable-id guarantee.

**Mappers ①②③ — tier 2.** MSW-mocked Moatless responses (`msw` is already a t3code
devDependency) → assert the produced objects **decode cleanly against the Effect
Schemas from `@t3tools/contracts`**. Schema decode *is* the assertion; a shape error
fails without hand-written field checks. This is the single highest-value test in the
project, because it is what proves an untouched client will accept our output.

**Stub table — tier 2.** One test that walks every `WsRpcGroup` member and asserts it
is classified, so adding an upstream method fails the suite instead of failing at
runtime.

**Fixtures include the failure cases:** a task whose `repositoryId` matches no
readable repository, a task with `status:'error'`, a message with an empty `content`
array, a `tool_use` with no matching `toolResult`.

**No credential in CI.** MSW intercepts at the fetch layer, so every unit and
integration test runs against mocks with no key. Only the manual E2E path needs
`MOATLESS_API_KEY`.

**Inherited t3 tests must stay green — all 1518 of them.** `threadReducer.test.ts`,
`threads-sync.test.ts`, `shell-sync.test.ts`, `Sidebar.logic.test.ts`,
`MessagesTimeline.logic.test.ts` cover the machinery we are keeping. Unlike the old
plan, **we change none of their inputs**, so any failure is a real regression rather
than an expected consequence of a contract trim. That is a strictly better regression
net.

Toolchain stays t3's: pnpm + vite-plus (`vp test`) + oxlint + tsgo.

### 11.1 M3 browser verification — what was actually checked

Unit tests prove the projections decode; they say nothing about whether an
untouched t3 client accepts them. That claim needs a browser, so M3 was gated on a
Playwright run against the live adapter — **21/21 checks green**, each assertion
cross-checked against `/api/orchestration/shell` and
`/api/orchestration/threads/{id}` rather than against hard-coded fixtures:

- boots with no uncaught page error, no pairing wall, no version-mismatch banner
- 33 sidebar rows render; every `thread-row-{id}` in the DOM is a thread from the
  snapshot, and every rendered title matches its Moatless task title
- all 7 distinct repository identities get a sidebar group, and the merged
  `saasocalypse` group still shows threads from both underlying projects (§5)
- the client's RPC socket opens on `/ws`, receives `server.getConfig`, and takes 12
  `kind:"snapshot"` frames from `orchestration.subscribeShell` — captured as raw
  frames off the page's own WebSocket, not inferred from the UI
- clicking a row opens that thread, renders its real message text, and raises no
  page error; back-navigation and a second thread are clean
- no thread present in the snapshot ever 404s

One 404 does occur, for a thread id the client kept in local state after the task
was closed upstream. It is absent from the snapshot and returns 404 from Moatless
too, so refusing it is correct; the check is written to distinguish that case from a
live thread failing.

The script lives outside the repo — landing it would mean adding Playwright as a
devDependency and CI wiring, which is a separate decision.

### 11.2 The preview URL 504s, and it is not this repo

The sandbox's preview URL returns `504 Gateway Timeout` while the same dev server
answers in ~4 ms locally. The cause is upstream of the workspace: **the gateway's
packets never reach the pod.**

What the evidence shows, in the order that narrows it:

- `curl http://127.0.0.1:5733/` → `200` in 4 ms; `http://<pod-ip>:5733/` → `200` in
  3.7 ms. Vite binds `0.0.0.0` and answers on the routable address.
- An unauthenticated request to the preview host gets a clean `401` JSON, so the
  gateway is up and its auth layer works. With a valid key the same request hangs
  for exactly 30 s and returns a 15-byte `Gateway Timeout`.
- A port with no preview route (`--9999`) returns `404 page not found` in 34 ms. So
  5733 *is* registered and the gateway is choosing to dial it — and the dial hangs.
- **`13773` fails identically.** That is the stock t3 server sidecar, untouched by
  this work. No change in this repo can explain both.
- Polling `/proc/net/tcp` for the whole 30 s of an external request shows **no
  socket on 5733 in any state** — not even `SYN_RECV`. A control that holds a
  connection open proves the watcher sees what it should
  (`local=10.30.1.181:5733 remote=10.30.1.181:58940 state=ESTABLISHED`).

The pod-side half is otherwise healthy: `allowedHosts: true` (a spoofed `Host`
header returns 200), no service worker, dep cache warm, all three containers
`running` with restart count 0. Reproducing the external shape locally — a
self-signed TLS proxy on a foreign hostname, resolved with
`--host-resolver-rules` — renders the app fully: 33 sidebar rows, 34 WebSocket
frames, `wss://` upgraded end to end.

**Root cause, read off `soaplabs/moatless`.** A preview URL is a Traefik
`IngressRoute` per declared server port: `create_task_ingress_routes` maps
`Host({task_id}--{port}.{proxy_domain})` through an auth middleware to the task's
ClusterIP Service, and `create_sandbox_service` opens that port on the Service.
Both are built from `build_servers_map(plan)` — the ports the *repository* declares.
But the NetworkPolicy that decides who may dial a sandbox is not: in
`k8s/helm/moatless-vibe/templates/sandbox-networkpolicy.yaml`, with
`restrictIngress: true`, the "Traefik → sandbox dev servers" rule takes its ports
from a fixed list in `values.yaml`:

```yaml
networkPolicy.sandbox.ingressFromTraefik.ports: [3000, 4000, 5000, 5173, 8000, 8080, 8888]
```

t3code's ports are **5733** and **13773**. Neither is on it, so the CNI drops
Traefik's SYN — no `REJECT`, so Traefik waits out its timeout and answers 504. That
accounts for every observation at once, including why the two allow-listed ports in
the *other* ingress rule (backend gRPC and 8001) keep working, which is why the
sandbox agent stays reachable while both preview ports are dark.

The route/Service half is dynamic and the policy half is static, so any repository
picking a port outside that list gets a preview URL that resolves, authenticates,
and then hangs.

**Which policy, in this cluster.** The chart's rule is not the one that mattered
here. It names `namespaceSelector: kubernetes.io/metadata.name: traefik`, and this
cluster has no `traefik` namespace — Traefik runs in `platform-ingress` and
`moatless` — so that rule can never match and patching it changed nothing. The live
gate was a second, ArgoCD-managed policy, `moatless-sandbox-preview-ingress`, which
selects the same pods, names both real Traefik namespaces, and carries a *copy* of
the same static port list. Removing its `ports:` block fixed it; the cluster accepts
an ingress rule with no ports (neither Kyverno nor the AWS VPC CNI controller
objects), so "all ports from Traefik" is expressible here.

**Fixed and verified**, from inside the sandbox, against the real preview host:

| Probe | Before | After |
|---|---|---|
| `GET /` through the gateway | 504 after 30 s | **200 in 42 ms** |
| `GET /api/orchestration/shell` | 504 | **200 in 54 ms** — 7 projects, 98 open threads |
| Traefik → pod on 5733 | no socket ever appears | `ESTABLISHED` from `10.30.10.53` |

The two upstream changes worth landing in the chart: drop the static `ports` list
(the per-task IngressRoutes already decide what is exposed, so enumerating ports a
second time duplicates a dynamic decision statically — which is the whole bug), and
make a `ingressFromTraefik.namespace` that names a non-existent namespace fail
loudly. Either one would have turned this into an error message instead of a
30-second black hole with nothing logged anywhere.

None of it is reachable from inside the checkout: the Kubernetes API and every
workspace ClusterIP are unreachable from the pod by the egress half of the same
policy, and the pod's AWS role is CodeArtifact-scoped with no EKS permissions.

---

## 12. Milestones

| M | Deliverable | Verification |
|---|---|---|
| **M0a** | ✅ **Done.** Vite proxy: `T3CODE_PROXY_TARGET`, key injection, `allowedHosts`, `/ws`, credential stripping | `/api/v1/repositories` → 31 real repos through the proxy; `grep -r mvk_ dist/` clean; typecheck, lint, fmt clean; 1518 tests green |
| **M1** | ⚠️ **Done differently.** No `packages/moatless-api`, no orval: `apps/moatless-adapter/src/moatless.ts` is a hand-written typed reader over Effect's `HttpClient` covering the five endpoints the read path needs | Reads live `soaplabstest` data; every non-2xx maps to `MoatlessRequestError` and then to the contract's error union at the handler |
| **M2** | ⚠️ **Partially done.** `threads.ts` implements the §8 adapter with unit tests (`threads.test.ts`) — but from hand-written cases, **not** committed golden fixtures from real Claude/Codex tasks | 15 tests green across `mapping.test.ts` + `threads.test.ts`. **Golden fixtures still owed**; do them before M4 |
| **M3** | ✅ **Done (read path).** `apps/moatless-adapter` boots; serves metadata + auth + `GET /shell` + `GET /threads/:id`; WS with the full 70-method table; **read-only sidebar and chat render real Moatless data** | 8 projects / 99 open threads in the sidebar; a thread opens with 41 messages and 90 activities, markdown and diffs rendering. **Side-by-side comparison gate vs. the Moatless UI still owed**; cold-open shell latency not yet recorded |
| **M4** | SSE → stream items; live updates during a running turn | Start a turn in the Moatless UI, watch it stream into t3. **Explicitly verify incremental delivery (§9.5) and record the refetch cost (§9.3)** |
| **M5** | Dispatch: send message, interrupt, create task, close. Verify each write route first (§6.4) | Send from t3, verify the turn runs and streams back |
| **M6** | `AskUserQuestion` → pending user input; `ExitPlanMode` → proposed plan cards; attachments via `assets.createUrl` | Plan-mode task end to end |
| **M7** | *(optional)* Native WebSocket on the Moatless backend, swapped in behind the same seam | Fan-out and resync on lag |

M2 before M3 was deliberate: the message adapter is the risky part and is fully
testable with zero infrastructure. In practice M3 ran ahead of a complete M2 — the
message adapter has unit tests but not the golden fixtures the milestone asked for.
That debt is real and is called out in the table rather than quietly closed.

---

## 13. API gaps

Numbered for reference from code comments. None is a Phase 1 blocker; each has a
client-side workaround in this document.

| # | Gap | Cost today | Breaking? |
|---|---|---|---|
| **G1** | Event payload for `agent.message` carries no content, and `/messages` has no forward cursor | Full message-list refetch per update (§9.3) | No — additive |
| **G2** | `TaskResponse.workspaceId` | Sidebar groups by repository, not workspace | No — additive |
| **G3** | `UiMessage.turnId: string` alongside `turnNumber` | Turn folding keys on a stringified int; breaks if numbering restarts | No — additive |
| **G4** | `TaskResponse.model` and `TaskResponse.agentMode` | Sidebar shows no model until a thread is opened (§7.1) | No — additive |
| **G5** | `TaskResponse.liveStatus` | Session status approximated on the shell path, exact only per thread (§7.4) | No — additive |
| **G6** | `TaskResponse.lastMessagePreview` | Sidebar rows show no preview | No — opt-in |
| **G7** | `usage` has no context-window total | Context meter omitted (§8.3) | No — additive |
| **G8** | Typed `UiContentBlock.toolInput` per known tool | §8 reads `Record<string, unknown>` and guards every field | No — refinement |
| **G9** | `GET /api/v1/tasks` caps a result set at 100 rows regardless of `limit`, while `pagination.total` reports 110 | 10 open tasks are unreachable by paging — the sidebar is silently short | No — fix is server-side |
| **G10** | `pagination.hasMore` is computed from the *requested* limit, not the delivered page | `limit=150` returns 100 rows and `hasMore:false`. The reader pages in fixed 100-row steps and stops on a short page instead of trusting the flag | No — fix is server-side |
| **G11** | `GET /api/v1/tasks/{id}/messages` reports `hasMore:true` even on a page that returned all `totalCount` rows | Termination has to key off `nextBeforeId` being absent, not `hasMore` | No — fix is server-side |

G9–G11 are measured against the deployed `soaplabstest` backend as of M3. G9 is the
only one that loses data; G10 and G11 are worked around in `moatless.ts` and are
noted here so the workaround can be deleted when the server is fixed.

**Not changing:** the server-side message assembly seam. `agent.message` staying
content-block shaped is a deliberate architecture decision (ADR-0002/0003); §8
absorbs the difference. G1 asks only that the *notification* carry the assembled
message it already has, or that the list endpoint grow a forward cursor.

---

## 14. Risks and open questions

| Risk | Mitigation |
|---|---|
| **Unsupported features fail at runtime, not compile time** — the price of leaving the client untouched | Capabilities negotiation where it exists (settle/snooze), empty streams for eager subscriptions, one reviewable `notSupported` table, and a test that fails when an upstream method is unclassified (§6.3) |
| **Terminal / preview / worktree / checkpoint buttons stay visible and break on click** — capabilities do not cover them | Accepted for the prototype and stated up front. If it makes demos unusable, the narrow fix is a capabilities extension in `contracts` — which is a *fork* change to a file we otherwise leave alone, so weigh it against §2 |
| **Refetch cost on every message event** (§9.3) | Subscriber-gated, debounced, diffed. Measure at M4; G1 is the real fix |
| **Streaming may be buffered and is unverified** (§9.5) | Explicit M4 gate, diagnosed as transport. `synchronized` never keys off stream-open |
| **4,641 tasks** | Shell loads `status=open` only (110); archived served on demand; per-repository fan-out as the fallback |
| **Message-model fidelity** — some tools render worse | M3 is a comparison gate, not a checkbox. Budget for extending t3's work rows |
| **The adapter grants its Moatless identity to anyone who can reach the port** | Binds loopback by default; `0.0.0.0` needs an explicit opt-in. Never expose it publicly (§6.2) |
| **The prototype writes to a shared, deployed environment.** From M5 it can create, close and delete real tasks; delete is not undoable | Mint the key under a dedicated prototype user with the narrowest scope that works. Read-only until M5. Verify each write route against a task the prototype created itself. Do not implement `thread.delete` before M6 |
| **API key leakage** | Un-prefixed env var; credential-shaped `VITE_*` stripped at config load; build-time assertion; `grep dist/` gate. Revoke via `DELETE /api/v1/auth/api-keys/{key_id}` when the prototype ends |
| **Hard fork, no upstream merges** | Accepted — but materially smaller than the old plan, since `contracts` and `client-runtime` are now untouched and *can* be re-synced |
| **Effect learning curve** | The adapter is written in Effect (Layers, Services, Streams, Schema, RpcServer). `apps/server` is a complete working reference for every one of those; `.repos/effect-smol/LLMS.md` for idiom |
| **Vite+ is a commercial toolchain** | Already required to build t3code. Confirm CI licensing before M3 |

**Open questions:**

1. **Which environment do the write milestones run against?** `soaplabstest` is
   shared and holds 4,641 real tasks; from M5 the prototype can create, close and
   delete them. Confirm that is acceptable, or point `MOATLESS_BASE_URL` at a local
   backend for M5–M6 — with the adapter that is a one-line config change. **Raise
   before starting M5.**
2. **Does `apps/server` stay in the tree?** This doc assumes yes, as the WS-framing
   reference and the upstream-comparison workspace. It is 474 files / 165,711 lines
   of dead weight in the fork otherwise. Decide after M3, when we know how much of
   its framing we actually copied.
3. **What happens to Moatless's own chat?** The prototype duplicates it. Fine while
   prototyping; a decision if it graduates.
