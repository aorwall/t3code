# Fork gaps

What is not done, on both sides of the seam this fork sits on: what the Moatless
backend does not serve yet, and what this repository owes independently of it.

This is the third of the three fork documents and the only forward-looking one.
[The inventory](./inventory.json) records what the fork decided and
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

### Capabilities are reported, but not the ones the newer surfaces need

Upstream has a per-surface capability record on the wire —
`ExecutionEnvironmentCapabilities`, growing one boolean per thread-lifecycle
surface as upstream adds them.

Moatless does populate it: the descriptor reports `connectionProbe`,
`threadSettlement`, `threadSnooze` and `repositoryIdentity: false`, so a client
can tell it apart from a server that refuses settlement or snooze. What it does
not report is every boolean added since that handshake was written —
`threadPinning` (upstream, 2026-08-06), `threadPinReorder` (upstream,
2026-08-08), `threadTitleRegeneration`, `serverSelfUpdate`,
`serverSelfUpdateProgress` and `agentActivityPublishing` (upstream,
2026-08-16) — so each of those surfaces is
decided by the record's decoding default (absent → unsupported) rather than by a
statement from the deployment. That is correct for the ones the backend does not
implement and stale the day it does.

Two keys it reports are not in the contract at all — `userInputResponse` and
`sandboxDiagnostics`, both fork-invented in `crates/t3code/src/lib.rs`. They are
not in `packages/contracts/src/environment.ts`, so Effect Schema drops them on
decode and no client reads them: the backend is answering a question the wire
never asks. Either add them to `ExecutionEnvironmentCapabilities` (a fork delta
on an upstream contract file) or stop sending them; today they are dead weight
on the handshake.

The `FEATURES` constant is a separate mechanism, not a stand-in for this record.
The record mostly grows booleans for thread-lifecycle surfaces; the surfaces
`FEATURES` gates — `turnDiffs`, `diagnostics`, `workspaceSearchContents` and the
rest — have no boolean in it. Those stay a build-time constant because there is
nothing on the wire that would carry them.

Two have since crossed over. `workspaceScripts` is a capability on this record
that decides a surface, not a thread-lifecycle rule: it says the deployment can
run a project's script itself, and the control that runs one follows it rather
than a flag. The edit half followed the same road: whether a project's scripts
can be edited varies per workspace at runtime — a git-synced workspace owns them
in `.moatless/workspaces.json` and is read-only, a manual one is writable — so it
rides a per-project `scriptsEditable` field on the wire, not a build flag, and
`projectScriptEditing` left `FEATURES` when that field arrived. That is the
inventory's _prefer upstream's capability where one exists and delete the
matching flag_ played out twice over. Reach for a capability over a flag whenever
the answer varies by deployment; keep the flag when it cannot.

- **Closes when:** the backend reports each new thread-lifecycle boolean it comes
  to implement, and drops or contract-registers the two fork-invented keys.
- **Then here:** for a boolean that gates a `FEATURES` flag (pinning is the near
  one — see _Settlement rules Moatless owns_), delete the flag and its gates when
  the backend reports it true.

### Methods the backend does not dispatch

A minority of the contract's WebSocket methods declare `UnsupportedMethodError`.
Which ones, and whether that set still matches what Moatless dispatches, is
derived rather than remembered:

```bash
node .agents/skills/fork-upstream-merge/scripts/unsupported-methods.mjs
```

It reads both sides and reports in both directions — a method the backend has
started serving is a union entry to delete, not a no-op. The grouping below is
what a person loses, which is the part the derivation cannot tell you:

- **Editing server settings** — `server.updateSettings`, `upsertKeybinding`,
  `removeKeybinding`, `updateProvider`. Reading is served (`server.getSettings`,
  `getConfig`), so Settings renders and nothing in it can be saved. Holds open
  `serverAdministration`. A project's scripts are the exception: the backend
  dispatches `project.meta.update` for them — see _A script runs on the backend_
  below.
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
- **Pull requests** — the whole `pullRequests.*` group (list, detail, activity,
  diff, review, comment, reviewer requests), new upstream in the 2026-08-12
  merge and grown on 2026-08-16 by `pullRequests.update`, `updateComment` and
  `setReaction` — plus filters and qualifiers, all-server listing, update-branch,
  and sending a PR line request to the agent — with
  GitHub/GitLab/Bitbucket/Azure DevOps provider backends in
  `apps/server/src/pullRequest/`. Needs no fork gate: the client reads
  `capabilities.pullRequests`, which decodes to unsupported when a deployment's
  handshake omits it, so the whole surface (sidebar tab, right-panel surface,
  `/pull-requests` route) already stays off on Moatless. Closes when the backend
  reports `capabilities.pullRequests: true` and dispatches the group.
- **Usage summary** — `server.getUsageSummary`, new upstream in the 2026-08-12
  merge, reading local provider transcript directories in
  `apps/server/src/usage/`. The `/usage` route and its charts render against
  whatever the RPC returns and have no local fallback on Moatless.
- **Opening in an external editor** — `shell.openInEditor`. Holds open
  `workspaceOpenIn`. Unlikely ever to close: the browser is not on the machine
  the workspace is on, so this one is a candidate for deleting the surface
  rather than serving the method. Upstream answered the same problem on
  2026-08-16 for its own remote environments, by having the server return an
  SSH open target (`apps/server/src/environment/RemoteOpenTargets.ts`) that the
  _desktop_ shell hands to a local editor. That path needs an Electron shell, so
  it does not reach this fork's browser client — but the shape is the one to
  copy if the surface is ever kept rather than deleted.
- **Codex feedback** — `provider.uploadFeedback`, new upstream in the
  2026-08-26 merge. Backs the `/feedback` slash command that posts a Codex
  session's transcript to OpenAI (`ChatView.tsx`'s `submitCodexFeedback`).
  Needs no fork gate: the command is Codex-specific and independent of any
  capability, so it always resolves to `UnsupportedMethodError` and the
  composer shows "Could not send feedback to OpenAI" — a correct answer, not a
  broken button. Closes if Moatless ever wants to relay this itself, which is
  unlikely: the feedback is addressed to OpenAI, not to the workspace.
- **Preview automation** — `previewAutomation.connect`, `focusHost`, `respond`.
- **Desktop and host lifecycle** — `server.updateServer`,
  `updateServerWithProgress`, `commitDesktopUpdate`, `getBackgroundPolicy`,
  `subscribeBackgroundPolicy`, `reportHostPowerState`, `cloud.installRelayClient`,
  `subscribeDiscoveredLocalServers`. These are upstream's self-hosted desktop
  product and are **not** fork targets — they are listed for completeness, not as
  work. Holds open `FEATURES.serverUpdateBanner` (2026-08-11), which drops the
  composer's "Server update available" banner and its `npx t3` command: the
  Moatless server does not implement `server.updateServer`, so the offer would
  point at a command that cannot run.

- **Check:** run `unsupported-methods.mjs` rather than reading this list. Where
  the two sides come from is _Deriving the unsupported set_ in the inventory.
- **Then here:** drop the union entry in `packages/contracts/src/rpc.ts` and, if
  the method was the last one behind a flag, the flag too.

### A script runs on the backend, and only the backend can edit one

`scripts.run` is the first method that runs the derivation _backwards_: the
Moatless backend dispatches it and upstream's own server does not. Every other
union entry in `rpc.ts` records something Moatless cannot serve; this one records
something **T3's server** cannot, because running a project's script means
hosting it in a sandbox terminal and publishing the port it serves, and a server
running threads on the local machine owns no sandbox to do it in. It answers
`UnsupportedMethodError` from `apps/server/src/ws.ts`, beside the
`serversList` / `sandboxStatus` stubs.

That inversion is a trap for the next merge. `unsupported-methods.mjs` reads the
backend's dispatch and this contract, and knows nothing about which _server_
refuses: once the backend half is published, it will report `scripts.run` under
**DROP — the union entry can never fire**. Deleting it on that advice would strip
the only typed answer T3's own server has, and turn a clean refusal there into a
decode failure.

- **Keep the union entry** for as long as `apps/server` answers the method with
  `UnsupportedMethodError`, whatever the script says. This is the one documented
  exception to _drop what DROP lists_.
- **Closes when:** upstream's server grows a way to run a project's script off
  the local machine, or the method leaves the contract. Neither is near.

The **edit** half is now served, but conditionally. The backend dispatches
`project.meta.update` carrying a `scripts` array and writes it through to the
Workspace run-config — but only for a workspace it owns. A git-synced workspace
keeps its scripts in `.moatless/workspaces.json`, so the backend refuses the
write and projects the scripts read-only. That "can this viewer edit these
scripts" answer varies per workspace at runtime, so it rides the wire as a
`scriptsEditable` field on the project (true for a manual workspace, false for a
git-synced one) rather than a build flag. `ProjectScriptsControl` and the project
settings page hide Add/Edit/Delete when it is false; `projectScriptEditing` is
gone from `FEATURES`. Running a script stays ungated — a read-only workspace can
still run what it declares.

The editor drops upstream's free-text "Preview URL" for a numeric **Port**: a
script in a remote sandbox has no localhost to point at, so the host publishes
the port and returns the real external URL when the script runs (see
`scripts.run` above). The port persists on the script's `port`; `previewUrl` /
`autoOpenPreview` stay on the contract for wire-compatibility but the fork's UI
no longer writes a URL.

- **Closed by:** the backend dispatching `project.meta.update` for a project's
  scripts and reporting `scriptsEditable` per project.
- **Watch on merge:** if upstream's editor grows a field the fork's port-only
  form dropped, decide per field whether to carry it; the port is the fork's, the
  URL is upstream's.

### A subtask is a Moatless concept, and only T3's own server refuses it

`subtasks.list` runs the derivation backwards for the same reason `scripts.run`
does, so it carries the same trap and the same standing instruction.

A Moatless thread has two kinds of child. A **subagent** is folded out of the
thread's own activities and is upstream's concept too. A **subtask** is a Task
another Task created, or a fork of one — a thread in its own right, with a route
to open it — and upstream has no task tree at all. So the backend dispatches the
method and `apps/server` answers `UnsupportedMethodError` unconditionally, beside
the `serversList` / `sandboxStatus` / `scriptsRun` stubs.

- **Keep the union entry** for as long as `apps/server` answers the method with
  `UnsupportedMethodError`, whatever `unsupported-methods.mjs` reports it under.
  The second documented exception to _drop what DROP lists_.
- **Closes when:** upstream grows a thread tree, or the method leaves the
  contract. Neither is near.

The client half is fork-only and self-gating rather than flagged: the section is
absent when the read comes back with a typed refusal, so a build pointed at
upstream's server shows the agents panel exactly as upstream does.

### A thread outside the listing is a Moatless idea, so upstream's server refuses it

`threads.getShell` runs the derivation backwards for the same reason
`subtasks.list` does, so it carries the same trap and the same instruction.

Upstream's client learns which threads exist from `orchestration.subscribeShell`
and nowhere else, and that is exact for `apps/server`: the listing is every
thread it has. A Moatless listing is the **open** work you **follow**, so three
ordinary things fall outside it — a closed thread (which lives in
`getArchivedShellSnapshot`), a thread someone else follows that you may read,
and a subtask you have not written to. Each opens by URL and arrives with a
transcript and no listing row, which is a title, a project and an archived
badge the client cannot show.

So the method answers with the listing's own row for one thread by id, and
`apps/server` answers `UnsupportedMethodError` unconditionally, beside the
`serversList` / `sandboxStatus` / `scriptsRun` / `subtasksList` stubs.

- **Keep the union entry** for as long as `apps/server` answers the method with
  `UnsupportedMethodError`, whatever `unsupported-methods.mjs` reports it under.
  The third documented exception to _drop what DROP lists_.
- **Closes when:** upstream's listing stops being the whole set of threads, or
  the method leaves the contract. Neither is near.

The client half is fork-only and degrades rather than breaking: with no row the
thread still renders from its subscription, which is what upstream's server
leaves it doing.

### A thread the listing does not carry used to redirect home

Two upstream rules meet badly against Moatless, and this is written down because
the second one looks correct in isolation and will be re-derived otherwise.

`resolveThreadRouteRenderState` treats "bootstrap done, no shell row, no detail"
as `missing`, and the route navigates to `/`. Upstream is right: absence from a
listing that holds every thread is proof the thread is gone. Here it is not
proof of anything, and because a thread's detail subscription only starts when
its route mounts, the first frame always looks like that — so every unlisted
thread bounced home before it could load. The fork adds
`serverThreadAwaitingFirstAnswer`, optional and defaulting to the old rule, so
`missing` needs the environment to have actually answered.

Its counterpart is `apps/web/src/fork/adoptedThreadShells.ts`, which grafts a
fetched row into the snapshot the shell atoms read. Two consequences to keep:
the graft is decided against the **listing's** snapshot and never the grafted
one, or a supplied row reads as present and stops being supplied; and the
sidebar's own `archivedAt === null` filter is what keeps an adopted closed
thread out of it, so nothing here needs to know about archiving.

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

### A message does not say where it came from

The fork carries a `messageOrigin` field so the chat can mark a message that did
not come from the composer. Backend half is `soaplabs/moatless#269`, client half
is `#40`; they may land in either order, and until both are in this is fork-only
code on four upstream files.

- **Closes when:** the field is served, or upstream ships its own provenance
  field on `OrchestrationMessage` — in which case prefer upstream's shape.
- **Then here:** Message Origin Delta in the inventory.

### Subagents do not carry the identity the Agents surface folds on

Upstream's 2026-08-06 merge added the Agents surface (`#5219`): a right panel,
a chat spawn CTA, and a background-liveness banner, all folded from the thread's
`task.*` activities by `foldSubagentActivities`. That fold keys its roster by
`payload.taskId` and admits only rows stamped `payload.agentKind: "agent"` — an
unstamped row is background work that stays in the work log. Moatless already
reported a subagent call as a task rather than a tool, but carried neither
field, so the panel rendered "No agents yet" on every thread and the chat showed
no spawn row.

A backend change stamps both on the subagent row — `taskId` from the call's
`tool_use_id` (which the subagent's own Messages already carry as `parent_uuid`),
`agentKind: "agent"`, plus `role`, `title`, and `typedUsage` summed over
`task_message_usage`. It does not reach `backgroundLiveness` on the thread shell,
so the composer's background banner stays absent until the backend computes that
too.

- **Closes when:** the stamping change is deployed. Then the panel folds a real
  roster and the spawn CTA anchors in the chat.
- **Then here:** nothing to delete — the Agents surface is unconditionally shown
  (no `FEATURES` gate), so there is no placeholder, only an empty panel that
  fills once the fields arrive.

### Settlement rules Moatless owns

As of the 2026-09-02 merge, settlement is fully server-side: upstream removed the
client-side `effectiveSettled` computation (inactivity age, `autoSettleAfterDays`,
`autoSettleOnMerge`, and the branch-matched change-request read) and the client
now renders `thread.settledOverride === "settled"` straight from the server. This
closed the old _A pull request is not the thread's own_ gap outright — the client
no longer settles on any PR, so the `prThreadSettling` flag and its two gates were
deleted in the same merge. Moatless sets `settledOverride` only on explicit user
settle/unsettle (and clears it on new activity); it never auto-settles, so a
stranger's PR can no longer file a live thread under Settled.

One fork delta remains, in `Sidebar.tsx`'s partition: **a pinned thread never
classifies as settled** — the pin check runs before the `settledOverride` check,
reversing upstream's order, so the pin is a sort order and not a settlement input.

Same shape as the two capabilities beside it: `threadSnooze` suppresses settling
for a period, `threadSettlement` is the explicit user override. Upstream treats
all three as one lifecycle and Moatless implements the explicit override.

A decider rule Moatless would still benefit from reproducing arrived on
2026-08-16 in `apps/server/src/orchestration/decider.ts`: settling a snoozed
thread takes effect at once rather than waiting for the wake time.

- **Closes when:** the backend's settlement decision reads pin and snooze state,
  and settles a snoozed thread immediately.
- **Then here:** nothing to delete — this one is behaviour to reproduce, not a
  placeholder to remove.

## This fork

### Two union entries refuse conditionally; the other eleven were dropped

Eleven methods that declared `UnsupportedMethodError` and never refuse had it
removed once the deployed backend was confirmed to serve them: the seven
`terminal.*`, `subscribeTerminalEvents`, `subscribeTerminalMetadata`,
`git.runStackedAction` and `git.resolvePullRequest`. The check was the one this
entry used to ask for — deployed `serverVersion` is `0.0.31`, the same the
checkout implements; `main` dispatches all eleven with no `unsupported_exit` in
their arms; and terminals work in the deployed app, which is the live proof the
`terminal.*` half is served.

Two of the original thirteen kept the union member, because _dispatched_ is not
_never refuses_: their arm in `crates/t3code/src/lib.rs` still returns
`unsupported_exit` on a real branch, and a client that dropped the member would
fail to decode a refusal it will actually receive.

- `vcs.switchRef` — refuses when the thread already has a checkout. A branch is
  fixed at Task creation, so switching it on an existing thread is unsupported;
  only a draft thread's switch is served (it echoes the ref).
- `git.preparePullRequestThread` — refuses `WorktreeUnsupported`. This surface
  prepares a branch, never a worktree on disk.

- **Check before dropping either:** grep `unsupported_exit` in the method's arm.
  A method whose arm can still reach it keeps the union member; one whose arm
  never can, and which the deployment dispatches, drops it.

### Nothing checks a pull request

Every inherited workflow is `disabled_manually`, including `ci.yml`. The one
active workflow, `build-moatless-t3-image.yml`, builds and pushes the image and
runs no typecheck, lint or test. So a fork PR is green when nothing has been
run, which is how the two Effect-rule suppressions this fork carried reached
`main` unnoticed before they were fixed.

The disabling was deliberate — upstream's CI targets GitHub-hosted runners that
do not start in this fork, and re-enabling `ci.yml` as-is would fail on the
runner label alone. A fork-owned check job on `staging-runners-large` running
`pnpm typecheck`, `pnpm lint` and `pnpm test` is the missing piece, and it needs
the raised heap noted below.

### Annotating a framed preview depends on a package that is not on npm

The host half shipped 2026-08-07 (`apps/web/src/browser/framePreviewAnnotationBridge.ts`).
The guest half did not: the annotation runtime is injected into the previewed
app by `@moatless/inspector`, whose published `latest` is **0.2.1** — a release
from before the runtime existed. The version that has it, 0.3.0, exists only in
the Moatless tree and in the sandbox base image, which bakes a build to
`/opt/node_modules` (`docker/Dockerfile.sandbox-base`).

What it costs: in any previewed app that declares `@moatless/inspector` as a
dependency, npm's 0.2.1 shadows the baked copy on the module resolution walk, so
the guest never announces itself and the annotate button stays disabled with
"Preview inspector unavailable". `soap-frontend` hit exactly this and works
around it in its workspace `setupCommands`, by symlinking the baked copy over
the installed one after `bun install` — per-workspace, and invisible from here.

What holds it open on this side: nothing to delete. The gate is
`useFramePreviewAnnotationReady`, and it is honest — an app that has not loaded
the runtime genuinely cannot be annotated, so the disabled state is correct
behavior rather than a stand-in. This entry exists so the next person to find
the button greyed out looks at the previewed app's inspector version first.

The check that closes it: `npm view @moatless/inspector version` reports 0.3.0
or later. Then the per-workspace symlink workarounds come out, and previewed
apps pin the published version like any other dependency.

### Three surfaces are decided out and still in the tree

The three are **Clerk / T3 Connect**, **device pairing**, and **T3 backend
session bootstrap**. Each has a tripwire in `docs/fork/inventory.json`, and each
tripwire currently matches — they exist to hold a count steady, not at zero.

For the current sizes, which is the number that decides whether a surface is
worth removing:

```bash
node .agents/skills/fork-upstream-merge/scripts/tripwires.mjs
```

Removing them shrinks the merge surface permanently, which is the argument for
doing it. The argument against doing it piecemeal is that a half-removed auth
path is worse than an unused one, so this wants to be one change per surface.

Pairing is also the largest of the three and the one that leaks into docs — see
below.

### Mobile testing against Moatless is undocumented because it is unverified

`.agents/skills/test-moatless-web/SKILL.md` is the fork-owned procedure for the
web client: proxy target, single-origin mode, and Moatless cookie sign-in at
`/login`, each verified against a running backend. `test-t3-app` and
`test-t3-mobile` are upstream files kept byte-identical apart from a scope note
at the top routing Moatless web work to the new skill — a rewrite of either
would be a permanent conflict on a doc upstream still maintains, bought for
nothing the note does not already buy.

What stays open is mobile. `test-t3-mobile` pairs a device against the bundled
server, and whether this fork's mobile client can reach a Moatless backend at
all is unknown — so its scope note says the assumption is unverified rather
than substituting a procedure nobody has run. Answering that question is the
work; documenting it is the easy part that follows.

### Merges must be merge commits

The 2026-08-02 merge was applied as four cherry-picks. `git merge-base` never
advanced past `0ad91b6e`, so the 2026-08-06 merge replayed 63 commits where 59
were new, re-conflicted 17 files that were already identical to upstream, and
needed a hand reconciliation of the file counts before they made sense.

Nothing is broken now — the base is correct again as of the 2026-08-06 merge
commit. This is a rule, not a repair: **land upstream with a merge commit.** A
cherry-pick moves the code without moving the base, and every later merge pays
for it.

### `pnpm test` does not run the fork's product surface

`vp run -r test` picks up six packages — `moatless-api`, `contracts`,
`effect-codex-app-server`, `effect-acp`, `shared` and `oxlint-plugin-t3code`.
`apps/web` is not one of them, though it has a `test` script. So the command
`verify.mjs` runs, and the command a contributor runs before pushing, skips the
2 700-odd tests covering the client this fork actually ships.

What it costs: a merge or a change that breaks a web test is green until
someone runs `apps/web`'s suite by hand. The 2026-08-16 merge landed four
broken web tests that `verify.mjs` reported nothing about.

What holds it open: nothing fork-owned — root `package.json` has no fork delta,
so this is upstream's task graph, not a fork decision. Until it is fixed
upstream, run it explicitly:

```bash
cd apps/web && vp test run --project unit
```

- **Closes when:** `pnpm test` includes `apps/web`, or `verify.mjs` runs the web
  suite as a seventh check of its own.
- **Then here:** delete this entry and the manual step from the merge procedure.

### The auth bootstrap test suite does not run

`apps/web/src/authBootstrap.test.ts` fails twelve of its twenty-three tests —
the whole `resolveInitialServerAuthGateState` block — with
`connect ECONNREFUSED`. The HTTP mock `installEnvironmentHttpTest` installs is
not intercepting, so each test makes a real request and times out against
nothing. It fails the same way on Node 24 and Node 25, and on the tree before
the 2026-08-16 merge as well as after it, so it is neither a version nor a
merge problem.

What it costs: this is the fork's own test for its own most load-bearing
surface — the Moatless cookie session, the requires-login state, the dev-proxy
auth base. Eleven tests still pass, so the file is not obviously dead, and a
regression in the twelve is currently invisible.

What holds it open: nothing gates on it; the suite it lives in is not in
`pnpm test` either (see above), so nothing has been reporting it.

- **Check:** `cd apps/web && vp test run --project unit src/authBootstrap.test.ts`
  reports 23 passed.
- **Then here:** nothing to delete — this is a repair, not a stand-in.

### Node 25 breaks the prompt-stash tests

`apps/web/src/promptStashStore.test.ts` fails with
`TypeError: baseStashStorage.setItem is not a function` — eight tests, on a
file byte-identical to upstream and untouched by any merge. `resolveBaseStorage`
takes the `localStorage` branch because `typeof localStorage !== "undefined"`,
and on Node 25 that global exists as a stub until `--localstorage-file` is
given a valid path, which the runner does not do. The repo pins
`"node": "^24.13.1"`; the machine that hit this ran v25.6.0, and `pnpm` warns
about it on every command.

- **Check:** run the file on Node 24. It passes.
- **Then here:** nothing to delete — this is a version mismatch, not fork code.
  Listed so the next reader does not chase it as a merge regression.

### The full suite needs a raised heap

`pnpm test` and `pnpm typecheck` OOM on an 8-core sandbox under `vp`'s default
concurrency. Exit code 137 from a package is the OOM killer and not a failure —
each one passes run on its own, and `nativeReviewDiffHighlighter` in
`apps/mobile` fails only under that pressure.

`NODE_OPTIONS="--max-old-space-size=12288"` is the workaround, and it is a
prerequisite for the CI job above.

Lowering concurrency in the repo is the tempting fix and is not ours to make.
Root `package.json` has no fork delta at all, and upstream already caps
`typecheck` at `--concurrency-limit 2` while leaving `test` uncapped — so the
asymmetry is a choice upstream made with the flag in hand, not an oversight.
Capping `test` here would open a fresh delta on a hot upstream file to pay for
one machine size. Raise it upstream, or keep it in the environment.

### `T3CODE_ALLOWED_HOSTS` is an alias to retire

`apps/web/vite.config.ts` reads the fork's `T3CODE_ALLOWED_HOSTS` beside
upstream's `T3CODE_DEV_ALLOWED_HOSTS`. It stays until deployments inject
upstream's name, at which point it is one line out of Web Vite Delta.
