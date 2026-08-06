# Fork gaps

What is not done, on both sides of the seam this fork sits on: what the Moatless
backend does not serve yet, and what this repository owes independently of it.

This is the third of the three fork documents and the only forward-looking one.
[The inventory](./upstream-merge-inventory.md) records what the fork decided and
which deltas a merge must carry through; [the tracker](./upstream-merge-log.md)
records what a particular merge did. Neither has a place for _this is wrong and
nobody has fixed it_, so it kept ending up in commit messages and PR bodies
where the next person does not look.

It is a register, not a log: no dated sections, nothing appends. An entry is
edited where it sits and struck when it closes. How to write one is in the
[`fork-upstream-merge`](../../.agents/skills/fork-upstream-merge/SKILL.md)
skill, which reconciles this file against every merge.

## How a gap closes

Every Moatless gap below is held open on this side by something concrete — a
`FEATURES` flag, an `UnsupportedMethodError` union entry, a fork-only component.
Closing the backend half is not the end of the work: **the last commit of a
backend feature is the one that deletes what was standing in for it here.** A
flag left at `true` gates nothing and costs a merge conflict every time upstream
touches the code around it; a union entry for a method the backend now serves
declares a refusal that can never fire.

So each entry names its check. When the check passes, the gap and its
placeholder leave the tree in the same commit.

## Moatless

### Capabilities are not reported

The largest single gap, because it subsumes several below.

Upstream has a per-surface capability record on the wire —
`ExecutionEnvironmentCapabilities`, with `threadSettlement`, `threadSnooze` and
`threadPinning` as of 2026-08-06 — and it grows one boolean per thread-lifecycle
surface. A server that answers it decides what the client shows, and this fork's
entire `FEATURES` constant is a build-time stand-in for exactly that answer.

Moatless reports none of them, so every gated surface here is decided by a
constant compiled into the image rather than by the deployment it is talking to.
That is why turning a surface on is currently a code change and a rebuild.

- **Closes when:** the backend populates `ExecutionEnvironmentCapabilities` in
  its handshake.
- **Then here:** delete the matching `FEATURES` flags and their gates. See
  _Surface gating_ in the convergence watch list.

### Methods the backend does not dispatch

49 of the contract's 87 WebSocket methods declare `UnsupportedMethodError`.
Grouped by what a person loses:

- **Editing server settings** — `server.updateSettings`, `upsertKeybinding`,
  `removeKeybinding`, `updateProvider`. Reading is served (`server.getSettings`,
  `getConfig`), so Settings renders and nothing in it can be saved. Holds open
  `serverAdministration`, and the edit half of `projectScripts`.
- **Diagnostics** — `server.getTraceDiagnostics`, `getProcessDiagnostics`,
  `getProcessResourceHistory`, `getResourceTelemetryHistory`, `signalProcess`,
  `retryResourceTelemetry`, `subscribeResourceTelemetry`. Holds open
  `diagnostics`.
- **Project and repository management** — `project.create` / `project.delete`
  (commands, see below), `sourceControl.cloneRepository`, `lookupRepository`,
  `publishRepository`, `filesystem.browse`, `vcs.init`, `createRef`,
  `createWorktree`, `removeWorktree`, `pull`. Holds open `projectManagement`.
- **Content search** — `projects.searchContents`. Path search, read and list are
  all served, so "Go to file" works and "search in files" does not. Holds open
  `workspaceSearchContents`.
- **Per-turn diffs** — `orchestration.getTurnDiff`, `getFullThreadDiff`. The
  diff panel's working-tree and branch-range scopes work; "Latest turn" / "Turn"
  and the inline changed-files cards under each assistant turn do not. Holds
  open `turnDiffs`.
- **Review file contents** — `review.getDiffFileContents`, new upstream in the
  2026-08-06 merge. `review.getDiffPreview` is served, so a diff renders and the
  full file behind a hunk cannot be fetched.
- **Workflow scripts** — `orchestration.getWorkflowScript`, also new upstream.
- **Opening in an external editor** — `shell.openInEditor`. Holds open
  `workspaceOpenIn`. Unlikely ever to close: the browser is not on the machine
  the workspace is on, so this one is a candidate for deleting the surface
  rather than serving the method.
- **Preview automation** — `previewAutomation.connect`, `focusHost`, `respond`.
- **Desktop and host lifecycle** — `server.updateServer`,
  `updateServerWithProgress`, `getBackgroundPolicy`, `subscribeBackgroundPolicy`,
  `reportHostPowerState`, `cloud.installRelayClient`,
  `subscribeDiscoveredLocalServers`. These are upstream's self-hosted desktop
  product and are **not** fork targets — they are listed for completeness, not as
  work.

- **Check:** recompute both sides rather than reading this list. The procedure is
  in _Deriving the unsupported set_ in the inventory.
- **Then here:** drop the union entry in `packages/contracts/src/rpc.ts` and, if
  the method was the last one behind a flag, the flag too.

### A command cannot be refused

`orchestration.dispatchCommand` is one dispatched method carrying a union of 12
command types — `thread.create`, `thread.archive`, `thread.delete`,
`project.create`, `thread.pin`, `thread.settle`, `thread.snooze` and their
inverses. The backend dispatches the method, so `UnsupportedMethodError` cannot
say anything about the commands inside it: a client that sends `thread.delete`
to a backend that does not implement it gets a generic runtime failure, after
the user has already asked for the deletion.

This is the reason `threadDeletion` is a build flag and not a typed refusal, and
it will be the reason for the next one too.

- **Closes when:** either the backend reports which command types it accepts, or
  the contract splits the union into methods that can each be refused. The first
  is cheaper and fits the capability record above.
- **Then here:** delete `threadDeletion`, and the `projectManagement` gates that
  cover `project.create` / `project.delete`.

### A pull request is not the thread's own

Moatless reports, for a checkout, the oldest pull request the Task was ever
connected to — not one this thread produced. Upstream's `effectiveSettled` reads
that PR through `resolveThreadPr`, matched by branch name, and treats merged or
closed as settling the thread outright.

Against Moatless that is wrong in a way a user sees: a thread sitting on `main`
inherits a stranger's PR, and the day it merges the thread files itself under
Settled every time the agent goes idle. Confirmed on a live thread whose newest
message was minutes old.

- **Closes when:** the backend reports the change request for the checkout's own
  ref — `headRef` matching `refName`.
- **Then here:** delete `prThreadSettling` and both its gates, in `ChatView.tsx`
  and `SidebarV2.tsx`. Upstream's rule is correct once the PR is the thread's.

### A message does not say where it came from

The fork carries a `messageOrigin` field so the chat can mark a message that did
not come from the composer. Backend half is `soaplabs/moatless#269`, client half
is `#40`; they may land in either order, and until both are in this is fork-only
code on four upstream files.

- **Closes when:** the field is served, or upstream ships its own provenance
  field on `OrchestrationMessage` — in which case prefer upstream's shape.
- **Then here:** Message Origin Delta in the inventory.

### Settlement rules Moatless owns

Upstream added thread pinning in the 2026-08-06 merge along with a rule worth
copying: **a pinned thread never auto-settles.** Settlement is Moatless's to
decide here, so upstream's client-side rule does not reach it — the fork gets the
pin as a sort order and not as a settlement input.

Same shape as the two capabilities beside it: `threadSnooze` suppresses settling
for a period, `threadSettlement` is the explicit user override. Upstream treats
all three as one lifecycle and Moatless implements one of them.

- **Closes when:** the backend's settlement decision reads pin and snooze state.
- **Then here:** nothing to delete — this one is behaviour to reproduce, not a
  placeholder to remove.

## This fork

### Thirteen union entries are stale

`terminal.open`, `attach`, `write`, `resize`, `clear`, `restart`, `close`,
`subscribeTerminalEvents`, `subscribeTerminalMetadata`, `vcs.switchRef`,
`git.runStackedAction`, `git.resolvePullRequest` and
`git.preparePullRequestThread` all declare `UnsupportedMethodError` and are all
dispatched by the backend. The backend gained them after the unions were first
computed on 2026-08-01, and the 2026-08-06 merge deliberately did not drop them:
removing them narrows the contract against a deployment rather than against
`main`, which is its own change and wants a check that the deployed backend
actually serves them.

- **Check:** `moat gh api repos/soaplabs/moatless/contents/crates/t3code/src/lib.rs`
  gives the dispatch on `main`. What is deployed is the question this needs
  answered before the entries come out.

### Two Effect rules are suppressed rather than satisfied

Both landed in `#58` and both failed a repo-wide typecheck before the 2026-08-06
merge, which is when anyone first ran one. They now carry a narrow
`@effect-diagnostics-next-line` with the reason, which unblocks verification and
is not a fix:

- `packages/moatless-api/src/customInstance.ts` — `globalFetch`. The generated
  orval client calls `fetch` directly. The rule wants `HttpClient`, which would
  put an Effect runtime and a layer between orval's generated call and the
  request.
- `apps/web/src/moatless/query.ts` — `globalErrorInEffectCatch`. The error
  channel is `Error`, not a tagged error. The two failures it can carry are
  already distinct classes and every reader renders `.message`.

Neither is hard to do properly; both are a refactor rather than a line.

### Nothing checks a pull request

Every inherited workflow is `disabled_manually`, including `ci.yml`. The one
active workflow, `build-moatless-t3-image.yml`, builds and pushes the image and
runs no typecheck, lint or test. So a fork PR is green when nothing has been
run, which is exactly how the two suppressions above reached `main`.

The disabling was deliberate — upstream's CI targets GitHub-hosted runners that
do not start in this fork, and re-enabling `ci.yml` as-is would fail on the
runner label alone. A fork-owned check job on `staging-runners-large` running
`pnpm typecheck`, `pnpm lint` and `pnpm test` is the missing piece, and it needs
the raised heap noted below.

### Three surfaces are decided out and still in the tree

Each has a tripwire in the inventory's _Deleted surfaces_ section, and each
tripwire currently matches — they exist to hold a count steady, not at zero:

- **Clerk / T3 Connect** — 4 `package.json` files.
- **Device pairing** — 73 files.
- **T3 backend session bootstrap** — 9 matches.

Removing them shrinks the merge surface permanently, which is the argument for
doing it. The argument against doing it piecemeal is that a half-removed auth
path is worse than an unused one, so this wants to be one change per surface.

Pairing is also the largest of the three and the one that leaks into docs — see
below.

### The `test-t3-app` skill describes the wrong product

`.agents/skills/test-t3-app/SKILL.md` still instructs an agent to start the
bundled T3 server and authenticate through a one-time pairing URL. This fork's
web client authenticates by Moatless cookie session against `/login`, and pairing
is decided out. An agent following the skill sets up the stack the fork does not
use. Flagged stale on 2026-07-30 and still stale.

`test-t3-mobile` inherits the same assumption through its pairing steps.

### Merges must be merge commits

The 2026-08-02 merge was applied as four cherry-picks. `git merge-base` never
advanced past `0ad91b6e`, so the 2026-08-06 merge replayed 63 commits where 59
were new, re-conflicted 17 files that were already identical to upstream, and
needed a hand reconciliation of the file counts before they made sense.

Nothing is broken now — the base is correct again as of the 2026-08-06 merge
commit. This is a rule, not a repair: **land upstream with a merge commit.** A
cherry-pick moves the code without moving the base, and every later merge pays
for it.

### The full suite needs a raised heap

`pnpm test` and `pnpm typecheck` OOM on an 8-core sandbox under `vp`'s default
concurrency. Exit code 137 from a package is the OOM killer and not a failure —
each one passes run on its own, and `nativeReviewDiffHighlighter` in
`apps/mobile` fails only under that pressure.

`NODE_OPTIONS="--max-old-space-size=12288"` is the workaround. Lowering the task
runner's concurrency in the repo rather than in each person's shell is the fix,
and it is a prerequisite for the CI job above.

### `T3CODE_ALLOWED_HOSTS` is an alias to retire

`apps/web/vite.config.ts` reads the fork's `T3CODE_ALLOWED_HOSTS` beside
upstream's `T3CODE_DEV_ALLOWED_HOSTS`. It stays until deployments inject
upstream's name, at which point it is one line out of Web Vite Delta.
