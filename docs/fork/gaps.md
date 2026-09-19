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

## Marking a package this register already explains

An entry about a workspace package whose test suite is expected to be red can
carry two more slots, and `verify.mjs` prints `known gap: <heading>` on that
package's failure line when it does:

- **Package:** the workspace package name, exactly as `package.json` spells it.
- **Open while:** one command, in backticks, that **exits nonzero while this gap
  is open**. That polarity is the whole contract of the slot.

The command is what makes the marker safe. Matching a failing package against
the heading above it would keep printing "known gap" long after the gap closed,
which excuses the next real regression in the same package — so the marker is
gated on something runnable that stops failing when the gap does.

Neither existing slot can hold that command. **Check:** means "what to run to
see the state" and its polarity varies between entries; **Closes when:** is
prose about backend state. Both keep their meanings.

An entry with neither slot is not consulted and its failure reads exactly as it
would with no register at all, so backfilling is incremental rather than a
precondition. The marker is a label on a red step, not an excuse: a known gap
still fails the run.

## Moatless

### Capabilities are reported, but not the ones the newer surfaces need

Upstream has a per-surface capability record on the wire —
`ExecutionEnvironmentCapabilities`, growing one boolean per thread-lifecycle
surface as upstream adds them.

Moatless does populate it: the descriptor reports `connectionProbe`,
`threadSettlement`, `threadSnooze`, `threadPullRequests` and
`repositoryIdentity: false`, so a client
can tell it apart from a server that refuses settlement or snooze. What it does
not report is every boolean added since that handshake was written —
`threadPinning` (upstream, 2026-08-06), `threadPinReorder` (upstream,
2026-08-08), `threadTitleRegeneration`, `serverSelfUpdate`,
`serverSelfUpdateProgress` and `agentActivityPublishing` (upstream,
2026-08-16), `questionAttachments` (upstream, 2026-09-08),
`projectSettingsOverrides` (upstream, 2026-09-09) and
`requiredWorktreeBootstrap`, `storageCleanup` and `projectWorktreeCleanup`
(upstream, 2026-09-18) — so each of those
surfaces is
decided by the record's decoding default (absent → unsupported) rather than by a
statement from the deployment. That is correct for the ones the backend does not
implement and stale the day it does.

The last two are the first pair where an absent capability hides a whole page
rather than one control, and they are worth knowing about because they are the
reason that page needed no fork gate. #11598 added automatic storage cleanup —
worktree and transcript retention rules, per machine and per project — with a
`/settings/storage` page and a server-side sweeper
(`apps/server/src/storageCleanup.ts`). `StorageSettings.tsx` reads
`capabilities.storageCleanup` and `capabilities.projectWorktreeCleanup` itself
and returns a `SettingsScopeNotice` when either is absent, so on Moatless the
nav item is present and the page explains that the connected environment does
not support cleanup. That is upstream's own mechanism reaching the outcome a
`FEATURES` flag would have bought, which is why `/settings/storage` is
deliberately absent from `FEATURE_BY_SETTINGS_PATH` — adding a flag there would
duplicate a decision the wire already makes, and would have to be deleted again
the day the capability is reported.

`projectSettingsOverrides` is the one to know about, because it is the first of
these the client degrades around rather than hides. Upstream's scoped-settings
work (#11176 for the wire, #10639 for the UI) made every scopable server setting
editable at a project scope by writing a patch into
`ServerSettings.projectSettingsOverrides`. The whole settings UI ships and the
scope selects render; what the absent capability changes is which environments a
write fans out to. `scopedSettingsWrites` in
`apps/web/src/components/settings/scopedSettings.ts` skips any environment whose
handshake does not report the boolean, and `ProjectActionsSettings.tsx` filters
the same way for a project's actions — an older server ignores the override
record, so a project edit there would report success and vanish. On Moatless
every environment is skipped at a project scope, which means the write never
leaves the client: a person edits a project override, gets no error (not even the
`server.updateSettings` refusal the environment scope would produce), and the
inherited value stays. A silent no-op is worse than a hidden control or an honest
refusal, and it is why reporting this one boolean matters more than the others
above — reported `true`, the same UI starts working with no client change.

`questionAttachments` is the newest and the cheapest to close: it gates only
whether a user may attach files to an answer to an agent's async question
(`apps/web/src/questionAttachments.ts`, read at `ChatView.tsx`'s
`attachmentEnvironmentConfig`, and `QuestionAttachments.tsx` on mobile). Absent,
the answer composer drops its attach control and the text-only answer path is
unchanged, so nothing breaks — a user simply cannot send a screenshot back to a
question that asked for one.

A sibling record has the same shape one level down. `ServerProvider` grew a
`reportsContextWindow` flag (upstream, 2026-09-08,
`apps/server/src/provider/providerSnapshot.ts`), which upstream's own Claude and
Codex providers set true so the composer footer reserves space for the
context-window meter instead of reflowing when the first reading arrives.
Moatless builds its own provider descriptors, so until it sets the flag the
footer keeps the pre-reservation layout — cosmetic, and fixed by one boolean per
provider that actually reports a context window.

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
  to implement, and drops or contract-registers the two fork-invented keys. Check
  by deriving the set rather than reading the list above:
  `git grep -oE '^  [a-zA-Z]+: Schema.optionalKey' packages/contracts/src/environment.ts`
  against what `crates/t3code/src/lib.rs` actually sends.
- **Then here:** for a boolean that gates a `FEATURES` flag (pinning is the near
  one — see _Settlement rules Moatless owns_), delete the flag and its gates when
  the backend reports it true. `threadPullRequests` is the worked example: the
  backend fills `thread.pullRequests` from the Task's bindings and reports the
  boolean, so every pull-request surface is upstream's.

### A pull request link is a listing change, not an event

Moatless derives `thread.pullRequests` from the Task's GitHub bindings, and a
binding write records a listing change
(`moatless_core::change_feed::listing::record_change`) so the shell row is
re-sent. It emits no `thread.pull-request-linked`, `-unlinked` or `-synced`
frame: the T3 event feed is built from `conversation_changes` rows alone, and a
binding writes none.

A sidebar row and a composer pill therefore update on the next shell, and a
thread detail already loaded keeps the set it was loaded with. One line in
`mergeEnvironmentThread`
(`packages/client-runtime/src/state/threadDetail.ts`) holds the gap open: the
shell speaks for `pullRequests`, where upstream's merge keeps the detail's.

- **Closes when:** the backend has a path from a domain event to the T3 event
  feed, and emits the three pull-request frames on it.
- **Then here:** delete the `pullRequests` line from `mergeEnvironmentThread`,
  and the two `entities.test.ts` cases that assert the shell wins.

### A pull request snapshot carries no update instant and no checks state

`ThreadPullRequestSnapshot` asks when GitHub last changed a pull request
(`updatedAt`) and how its checks stand (`checksState`). A Moatless binding
records neither: its status blob holds the title, the state, the two branches,
the review decision and the mergeability, plus the instant this deployment read
them, which the snapshot reports as `syncedAt`.

So a badge shows no relative time and no check tone, and reports the rest.
Nothing in the client is gated on the two — both are optional — so this closes
with a backend change alone.

- **Closes when:** the GitHub refresh stores the pull request's own `updated_at`
  and its checks rollup on the binding.
- **Then here:** nothing to delete.

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
  `serverAdministration` and `providerConfiguration`. `server.getSettings`
  answers `{}`, so an ungated control does not merely fail to save — it shows a
  contract default as though it were the server's configuration. A project's
  scripts are the exception: the backend dispatches `project.meta.update` for
  them — see _A script runs on the backend_ below. Everything upstream adds to
  `ServerSettings` inherits this: the
  2026-09-12 merge brought `defaultRuntimeMode` (upstream #11346, the permission
  mode a new thread starts in, decoding-defaulted to `full-access`) and the
  `projectSettingsOverrides` record (#11176, a per-project patch over seventeen
  scopable keys). Both read fine and neither can be saved, which is the same
  refusal one level deeper rather than a new gap — see _Capabilities are
  reported_ for the capability half. The 2026-09-17 merge added upstream #12175,
  which turns every keybinding command into a searchable row pointing at
  `/settings/keybindings`; `settingsPathEnabled` keeps the page out of the
  sidebar and `settings.tsx`'s `beforeLoad` redirects a typed URL, but the rows
  still match in settings search and land on that redirect. Left upstream on
  purpose, the same way the six `snap-shot-*` rows are — see _Window capture_.
  The fix that closes both at once is a `settingsPathEnabled(item.to)` filter in
  `filterAvailableSettingsSearchItems`, which is a behaviour change to make
  outside a merge.
- **Diagnostics** — `server.getTraceDiagnostics`, `getProcessDiagnostics`,
  `getProcessResourceHistory`, `getResourceTelemetryHistory`, `signalProcess`,
  `retryResourceTelemetry`, `subscribeResourceTelemetry`. Holds open
  `diagnostics`.
- **Project and repository management** — `project.create` / `project.delete`
  (commands, see below), `sourceControl.cloneRepository`, `lookupRepository`,
  `publishRepository`, `filesystem.browse`, `vcs.init`, `createRef`,
  `createWorktree`, `removeWorktree`, `pull`. Holds open `projectManagement`.
  Grown in the 2026-09-15 merge by **background repository cloning** (upstream
  #11762 web, #11774 mobile): `projectClone.start`, `.cancel`, `.retry` and the
  `subscribeProjectClones` push stream, which turn "add a project from a remote"
  into a tracked job — the project row appears immediately and the clone streams
  its progress into a toast (`ProjectCloneToastCoordinator.tsx`,
  `apps/web/src/state/projectClones.ts`) rather than blocking the palette.
  Nothing new is lost: the whole flow hangs off `action:add-project`, which
  `FEATURES.projectManagement` already drops, and the stream is additionally
  gated client-side on `capabilities.projectCloneTracking`, which a Moatless
  handshake omits — so the four union entries are the only stand-in, and they
  close with the rest of this bullet.
- **Preparing a worktree behind a progress stream** — `subscribeWorktreeSetup`
  and `worktreeSetup.cancel`, new upstream in this merge (#11372, grown by
  #11832). Upstream cuts a thread's worktree as a tracked setup with named
  stages — clone, checkout, setup script — that the transcript renders as a
  `WorktreeSetupCard` with a cancel button, an "open the terminal" action and a
  "work locally instead" fallback, and #11832's `async: false` lets a setup
  script block the agent until it finishes. A Moatless thread gets a sandbox
  rather than a worktree, so there is no setup to stage and nothing is lost —
  `FEATURES.worktreeSelection` keeps the composer out of `worktree` send mode,
  `baseBranchForWorktree` therefore stays null in `ChatView.tsx`, and the
  subscription is never opened. Holds open the two union entries and that flag,
  which is the same flag the Workspace picker already holds. Closes only if
  Moatless ever prepares a checkout in observable stages, which its sandbox
  model does not currently have a place for. The setup script half is the
  exception worth reading on its own — see _A script runs on the backend_ below,
  where `async: false` is recorded as backend behavior rather than a refusal.
  The 2026-09-18 merge widened what the flag holds back rather than what it
  refuses: #12179 lets one prompt start a thread per selected model, each in its
  own worktree, and the picker that chooses those models is the same
  `worktree` send-mode control the flag already gates, so on Moatless the
  multi-model fan-out is simply not offered. The same commit added a
  `requiredWorktreeBootstrap` capability for servers that reject a required
  worktree instead of falling back to the project checkout — absent here, and
  covered by _Capabilities are reported_ above. If Moatless ever runs several
  sandboxes from one prompt, this is the upstream surface to serve rather than
  a new one to design.
- **Content search** — `projects.searchContents`. Path search, read and list are
  all served, so "Go to file" works and "search in files" does not. Holds open
  `workspaceSearchContents`.
- **Agent session import** — `agentSessions.scan` and `agentSessions.import`,
  new upstream in the 2026-09-06 merge. They back the welcome wizard's "Your
  projects" step (`ImportStep` in `apps/web/src/components/onboarding/WelcomeWizard.tsx`,
  state in `apps/web/src/state/agentSessions.ts`): scan walks the machine's
  Claude Code and Codex home directories for existing project directories, and
  import creates a T3 project from a chosen one and carries over its recent
  thread history. Neither is fork-gated by a capability, so the step's own
  error handling is what a Moatless user sees: the scan query resolves with an
  error, `ImportStep` renders "Could not check this computer for projects."
  with Retry and Skip, and a user who did have Claude Code or Codex projects on
  disk gets no offer to bring them, or their history, into T3. Holds open no
  named flag — the step just always falls through to its own no-op path.
  Closes when the backend dispatches both methods.
- **Per-turn diffs** — `orchestration.getTurnDiff`, `getFullThreadDiff`. The
  diff panel's working-tree and branch-range scopes work; "Latest turn" / "Turn"
  and the inline changed-files cards under each assistant turn do not. Holds
  open `turnDiffs`.
- **Review file contents** — `review.getDiffFileContents`, new upstream in the
  2026-08-06 merge. `review.getDiffPreview` is served, so a diff renders and the
  full file behind a hunk cannot be fetched.
- **Workflow scripts** — `orchestration.getWorkflowScript`, also new upstream.
- **Pull requests** — the `pullRequests.*` group except `summary` (list, detail,
  activity, diff, review, comment, reviewer requests), new upstream in the
  2026-08-12 merge and grown on 2026-08-16 by `pullRequests.update`,
  `updateComment` and `setReaction` — plus filters and qualifiers, all-server
  listing, update-branch, and sending a PR line request to the agent — with
  GitHub/GitLab/Bitbucket/Azure DevOps provider backends in
  `apps/server/src/pullRequest/`. Grown again in the 2026-09-06 merge by
  `pullRequests.subscribeRefreshes`, a push stream that tells the client a PR's
  state changed on the host side (new commits, a review, a merge) so it can
  refetch rather than poll; `createLinkedPullRequestSummaryAtomFamily` in
  `packages/client-runtime/src/state/pullRequests.ts` wires it as the refresh
  trigger for a thread's linked PR summary. The client reads
  `capabilities.pullRequests`, which decodes to unsupported when a deployment's
  handshake omits it, so the sidebar tab, the `/pull-requests` route, the
  push-refresh path and a PR link in the transcript — which falls back to
  opening the host — all stay off on Moatless without a fork gate. The launcher
  is the exception, because an unavailable surface stays on screen there with a
  one-line reason, and upstream's reads "No pull request on this branch yet": a
  wait that never ends here. `FEATURES.pullRequestSurface` on
  `pullRequestSurfaceAvailable` in `ChatView.tsx` drops that row, and holds open
  no more than it. `pullRequests.summary` is the exception and is served, because it is
  the fallback for a bound reference whose state and title the thread row could
  not carry: a binding records those on its first refresh, and until then a link
  in `thread.pullRequests` carries a null `snapshot` and every surface that
  names it resolves one through this call, which is also what performs that
  refresh. The
  capability stays absent regardless, since answering one method out of the
  group is not the group. Grown once more in this merge by per-project and
  last-used **merge-method defaults** (upstream, 2026-09-08): a
  `pullRequestMergeMethodOverrides` client setting plus a project-level default
  that preselect merge/squash/rebase in the PR detail panel's merge control
  (`apps/web/src/components/pullRequest/PullRequestDetailPanel.tsx`, the
  project field now in `ProjectDefaultsSettings.tsx`, which upstream's
  scoped-settings work moved it to on 2026-09-09). The setting is client-side and
  survives, but it preselects a control on a panel the capability already keeps
  off, so it changes nothing on Moatless until the group is served. Grown again
  in the 2026-09-14 merge by **cross-account routing** (upstream #11367):
  `pullRequests.routing` and `pullRequests.routingIdentity`, which answer which
  GitHub account an environment is authenticated as and pick the environment
  whose account can act on a given pull request
  (`packages/client-runtime/src/state/pullRequestRouting.ts`,
  `connection/githubRoutingPermissions.ts`, `apps/server/src/pullRequest/`).
  Both declare `PullRequestRpcError`, so they arrived already refusing and the
  derivation reports no entry to add. Its settings UI mounts inside
  `ConnectionsSettings.tsx`, so `FEATURES.connections` hides it too. Routing
  means nothing before the group underneath it is served, so it closes with the
  rest and not separately. Grown once more in the 2026-09-18 merge by
  **per-file viewed state** (upstream #7721): `pullRequests.filesViewed` and
  `pullRequests.setFilesViewed` record which files in a PR a reviewer has
  checked off, persisted server-side so the marks survive a reload and follow the
  reviewer between clients. Both declare `PullRequestRpcError` and so arrived
  already refusing, which is why the derivation reported nothing to add. Same
  conclusion as routing: it is a refinement of a panel the capability keeps off.
  Closes when
  the backend reports `capabilities.pullRequests: true` and dispatches the rest.
- **Usage writes** — `server.refreshUsageRates` (#9146-era usage-pricing work,
  `apps/server/src/usage/usagePricing.ts`), which re-fetches provider price
  tables on the machine the server runs on, and `provider.consumeResetCredit`,
  new upstream in the 2026-09-07 merge, which redeems a provider's usage-limit
  reset credit through that provider's CLI. Reading is served — the backend
  dispatches `server.getUsageSummary`, so the `/usage` route and its charts
  render — and both writes resolve to a refusal. `useResetCredit` in
  `apps/web/src/components/usage/UsageLimits.tsx` catches it and shows "Could
  not use the reset credit." Closes if Moatless ever drives a provider CLI on
  the client's behalf, which is the same condition as _Provider setup_ below.
- **Host resource sampling** — `server.getHostResources`, new upstream in the
  2026-09-07 merge, which samples a machine's CPU and memory
  (`apps/server/src/resourceTelemetry/HostResources.ts`) so a client can route a
  draft to the least loaded of several. `useLoadBalancedEnvironment` only mounts
  for an unresolved automatic draft, so nothing polls until a user picks
  automatic routing; on Moatless the read fails, `chooseLoadBalancedEnvironment`
  selects nothing and the composer's control reads "Auto balance unavailable" —
  a correct answer, not a broken button. Needs no fork gate. Closes when the
  backend reports its sandbox host's CPU and memory, which is only worth doing
  if a deployment ever offers a choice of machines.
- **Provider setup** — the redesigned provider editor's authenticate-and-install
  flow: `provider.auth.start` / `.complete` / `.cancel` / `.logout` /
  `.subscribe` and `provider.install.start` / `.cancel` / `.subscribe` /
  `.remove`, new upstream in the 2026-09-03 merge with the Google Antigravity ACP
  agent (#9348) and the provider-editor/models-list redesign (#8508). They drive
  a provider CLI login and a CLI install on the machine the server runs on;
  Moatless runs providers in its own sandboxes and serves none of them, so all
  nine share `ProviderSetupRpcError`, which now carries `UnsupportedMethodError`.
  The editor still reads and the models list renders; the auth and install
  actions inside it resolve to a refusal. Closes if Moatless ever manages
  provider credentials on the client's behalf.
- **Opening in an external editor** — `shell.openInEditor`. Holds open
  `FEATURES.openInEditor`, which covers every way in: the chat header's and a file
  preview's Open in pickers, a transcript path link's Open in action, its
  modifier-click and its reveal-in-a-file-manager sibling, a path clicked in
  terminal output, the commit dialog's changed-file rows, and the diff panel's
  editor fallback for a file opened without a thread ref.
  Unlikely ever to close: the browser is not on the machine
  the workspace is on, so this one is a candidate for deleting the surface
  rather than serving the method. Upstream answered the same problem on
  2026-08-16 for its own remote environments, by having the server return an
  SSH open target (`apps/server/src/environment/RemoteOpenTargets.ts`) that the
  _desktop_ shell hands to a local editor. That path needs an Electron shell, so
  it does not reach this fork's browser client — but the shape is the one to
  copy if the surface is ever kept rather than deleted. Upstream keeps fixing the
  launcher behind it — the 2026-09-13 merge gave Cursor `baseArgs: ["--classic"]`
  so a file open reaches the IDE rather than its Agents Window
  (`packages/contracts/src/editor.ts`, #11498) — which lands in the contract and
  in `apps/server`, neither of which changes anything here while the method is
  refused.
- **Codex feedback** — `provider.uploadFeedback`, new upstream in the
  2026-08-26 merge. Backs the `/feedback` slash command that posts a Codex
  session's transcript to OpenAI (`ChatView.tsx`'s `submitCodexFeedback`).
  Needs no fork gate: the command is Codex-specific and independent of any
  capability, so it always resolves to `UnsupportedMethodError` and the
  composer shows "Could not send feedback to OpenAI" — a correct answer, not a
  broken button. Closes if Moatless ever wants to relay this itself, which is
  unlikely: the feedback is addressed to OpenAI, not to the workspace.
- **Preview automation** — `previewAutomation.connect`, `focusHost`, `respond`.
  The MCP side of the same surface grew a `save` argument on `preview_snapshot`
  (upstream, 2026-09-08, `apps/server/src/mcp/toolkits/preview/tools.ts`) that
  writes the screenshot to disk for the agent to re-read. It rides this surface
  and closes with it.
- **The device hub** — `device.configure`, `device.list`, `device.testHost`,
  `device.open`, `device.close`, `device.shutdown`, `device.detail`,
  `device.action` and the `subscribeDeviceState` push stream, all new upstream in
  the 2026-09-11 merge (#10677, #10854, #10855, #10856). They run iOS simulators
  and Android emulators for a person and an agent to share: `apps/server/src/device/`
  drives them on the server's own machine (`LocalDeviceHost.ts`) or on another one
  over SSH (`SshDeviceHost.ts`), streams video and the accessibility tree, and
  exposes tap/type/screenshot to the agent through an MCP toolkit
  (`apps/server/src/mcp/toolkits/device/`). The client half is a `device`
  right-panel surface (`apps/web/src/components/device/`) and a Devices section
  on the Integrations settings page. **Nothing gates it on a capability**:
  upstream's `ChatView.tsx` passes `deviceAvailable={activeThreadRef !== null}`,
  so the launcher offers a Device row on every thread, and what a Moatless user
  reaches is the setup dialog rather than a broken panel —
  `subscribeDeviceState` never resolves, so the state stays the empty record,
  `onboardingCompleted` is false, and `addDeviceSurface` opens `DeviceSetup`;
  its "Enable the device hub" step calls `device.configure`, which resolves to
  the refusal the dialog then shows. `FEATURES.deviceHub` closes both ways in:
  the two `deviceAvailable` props drop the launcher row, and
  `IntegrationsSettingsPanel` drops the Devices section, whose hosts save
  through `server.updateSettings` the backend does not dispatch either. Holds
  open the nine union entries and that flag. Closes when the backend runs a
  simulator host for a task, which is a real question and not a stub — the hub
  needs Xcode or the Android SDK on the host it drives, and its stream is a
  second connection beside the RPC one.
- **Desktop and host lifecycle** — `server.updateServer`,
  `updateServerWithProgress`, `commitDesktopUpdate`, `getBackgroundPolicy`,
  `subscribeBackgroundPolicy`, `reportHostPowerState`, `cloud.installRelayClient`,
  `subscribeDiscoveredLocalServers`. These are upstream's self-hosted desktop
  product and are **not** fork targets — they are listed for completeness, not as
  work. Holds open `FEATURES.serverUpdateBanner` (2026-08-11), which drops the
  composer's "Server update available" banner and its `npx t3` command: the
  Moatless server does not implement `server.updateServer`, so the offer would
  point at a command that cannot run. Upstream reaches that banner by two routes
  since #10596, so the flag now carries two gates in `ChatView.tsx` — the
  single-machine condition and the `autoUpdateEnvironments` memo behind
  `useAutoBalanceUpdateBanner`. Count both when the flag is dropped.
- **Window capture** — the SnapShots settings page, new upstream in #8103. A
  global shortcut grabs the foreground window and hands the image, and
  optionally the window's accessibility text, to the composer. Every control
  drives `window.desktopBridge`, which a browser tab does not have, so this is
  upstream's desktop product and **not** a fork target. Upstream renders the
  page with an "unavailable" notice rather than hiding it, which is why a gate
  is needed at all: without one a hosted build lists a sidebar section and six
  searchable rows for a feature it can never run. Holds open `FEATURES.snapShots`
  and the `/settings/snap-shot` entry in `FEATURE_BY_SETTINGS_PATH`
  (`apps/web/src/fork/features.ts`). Closes when upstream marks the six
  `snap-shot-*` rows in `settingsSearch.ts` `desktopOnly: true`, the way it
  already marks its other desktop rows — check with
  `git grep -A6 'id: "snap-shot-' apps/web/src/components/settings/settingsSearch.ts`.
  Delete the flag and the path entry when it does.

- **Check:** run `unsupported-methods.mjs` rather than reading this list. Where
  the two sides come from is _Deriving the unsupported set_ in the inventory.
- **Then here:** drop the union entry in `packages/contracts/src/rpc.ts` and, if
  the method was the last one behind a flag, the flag too.

### A folder expansion re-reads the whole index, because the backend ignores the path it was handed

`projects.listEntries` is served and declares no `UnsupportedMethodError`, so
this is not a refusal — it is a served method that got a new optional input in
the 2026-09-14 merge and does not honour it. Upstream's #11527 added
`directoryPath` to `ProjectListEntriesInput` (present → the immediate
filesystem children of one directory, including gitignored ones; omitted → the
old indexed recursive listing), an `ignored` boolean on `ProjectEntry`, and a
`directory_list_failed` failure literal (`packages/contracts/src/project.ts`,
`apps/server/src/workspace/WorkspaceEntries.ts`).

Nothing breaks: `useDirectoryEntries` in
`apps/web/src/components/files/useDirectoryEntries.ts` filters what comes back
by parent path, so a full recursive listing still yields the right rows. It
degrades instead, and quietly — every folder expansion re-reads and re-transfers
the entire workspace index, the four-way request pool it added has nothing to
pool, and gitignored files stay invisible because the indexed listing excludes
them. On a large repository that is the difference between a keystroke and a
wait.

- **Closes when:** the backend reads `directoryPath` and answers with one
  directory's immediate children, sets `ignored` on the entries that are
  gitignored, and reports `directory_list_failed` for a path it cannot read.
- **Then here:** nothing to delete — no flag holds this open, which is why it
  would otherwise go unnoticed. Strike the entry when the backend honours the
  field.

### A turn arrives whole, so there is nothing for a streaming mode to govern

`FEATURES.assistantStreaming` is `false` because Moatless delivers each
assistant message once it is complete. Upstream's #11678 replaced the
`enableLegacyTokenStreaming` boolean with a three-way `responseStreamingMode`
(turn / paragraph / token) on `ServerSettings`, and the 2026-09-14 merge carried
the fork's gate onto the new row in `SettingsPanels.tsx`. Two reasons it is worth
more than a moved gate.

The setting itself is unsaveable anyway — `server.updateSettings` refuses — so
the gate is really about not showing a control for a distinction the backend does
not make. The same merge added `assistantStreamingOnly` to `settingsSearch.ts`,
because the gate on the row does not reach the command palette and a result for
it would land on General at a hash for a control that is not rendered. That is
the `snap-shot-*` problem above, one page over.

The interesting half is upstream's server change behind the middle mode
(#11062): `splitBufferedAssistantText` in
`apps/server/src/orchestration/Layers/ProviderRuntimeIngestion.ts` flushes the
buffered message at the last blank line or closing fence that is _not_ inside an
open code block, no more than once every 400 ms. That needs no token stream — it
is a buffer-and-split on the message the backend already builds, which makes it
the reachable middle ground between what Moatless does now and real streaming.
The client half merged inert and is ready for it: the fade-in is gated on
`data-streaming` and the smooth end-scroll on `isWorking`, so a whole-message
delivery simply never triggers them.

- **Closes when:** the backend delivers a turn in completed paragraphs and code
  blocks rather than all at once. Reproduce the split boundary faithfully — a
  naive split on `\n\n` breaks fenced blocks and tables, which is the bug
  upstream wrote that helper to avoid.
- **Then here:** delete `FEATURES.assistantStreaming` and the
  `assistantStreamingOnly` filter beside it. Saving the setting is a separate
  gap — see _Editing server settings_ above.

### The handshake now fails a connection whose environment id does not come back

Upstream's #8606 was its own dev-auth feature, which this fork does not adopt,
but it carried a client-side guard that applies here regardless. After
`initialSync`, `packages/client-runtime/src/rpc/session.ts` compares
`config.environment.environmentId` with the id the connection was registered
under and fails with a `ConnectionBlockedError` — "Connected environment X does
not match Y" — instead of proceeding. The same commit removed the
initial-config race in the `serverConfigEvents` stream.

So an id Moatless echoes differently from the one the client registered is now a
hard connection failure rather than a silent mismatch. This is a live risk, not
a missing feature: it is the kind of thing that passes every check in this
repository and fails on first contact with a deployment.

- **Closes when:** a real Moatless deployment has been connected to on this
  branch and the handshake is confirmed to echo, in its `subscribeServerConfig`
  descriptor, exactly the `environmentId` the client registered.
- **Then here:** nothing to delete. Strike the entry once that check has been
  run against a deployment.

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

The 2026-09-15 merge added upstream's first such field, and it was carried: a
setup script can now be marked to finish before the agent's first turn starts
(#11832). It rides as `waitForSetup` in the editor's form and maps to
`async: false` on the script (`apps/web/src/projectScripts.ts`), so the flag is
written through `project.meta.update` today and does nothing until the backend
honours it — see _Runtime fixes upstream made to its own server_ below.

- **Closed by:** the backend dispatching `project.meta.update` for a project's
  scripts and reporting `scriptsEditable` per project.
- **Watch on merge:** if upstream's editor grows a field the fork's port-only
  form dropped, decide per field whether to carry it; the port is the fork's, the
  URL is upstream's.

A thread can also declare scripts of its own, which is the second method running
the derivation backwards. A Moatless agent that brings up a dev server registers
it for that task alone, stored beside the thread's state rather than on its
project, so no project listing can show it. `scripts.listForThread` answers with
every script one thread can run — its project's, with the thread's own merged
over them — and the header's Run control lists that. `apps/server` refuses the
method, as it does `scripts.run`, so the same "keep the union entry" rule
applies. The read is gated on the `taskScripts` capability and falls back to the
project's own scripts whenever it is absent, in flight or failed. Editing stays
on `project.meta.update`, which writes a project's list and cannot reach a
thread's script, so the control offers no Edit on a task-scoped row.

- **Closed by:** nothing outstanding on the client. Declaring and removing a
  thread's script is the backend's `moat tasks scripts` CLI and its HTTP route;
  no UI writes one.
- **Watch on merge:** upstream has no per-thread script, so a merge that changes
  how `ProjectScriptsControl` receives its rows has to keep the merged list
  reaching it.

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

### Listing somebody else's threads has no upstream meaning

`threads.browse` runs the derivation backwards for the same reason
`threads.getShell` does, so it carries the same trap and the same instruction.

Upstream has one person per server and one listing, so "whose thread is this"
is not a question its client can ask. Moatless has users, roles and tags, and an
administrator who has to see what a deployment is doing cannot get there from a
listing scoped to their own follows. So the method answers a browse — by owner,
by tag, or both, optionally including closed work — with the listing's own rows
under the reader's ordinary read rules, and `apps/server` answers
`UnsupportedMethodError` unconditionally, beside the `serversList` /
`sandboxStatus` / `scriptsRun` / `subtasksList` / `threadsGetShell` stubs.

- **Keep the union entry** for as long as `apps/server` answers the method with
  `UnsupportedMethodError`, whatever `unsupported-methods.mjs` reports it under.
  The fourth documented exception to _drop what DROP lists_.
- **Closes when:** upstream's client grows a notion of another person's threads,
  or the method leaves the contract. Neither is near.

The client half is fork-only and gated on the `threadBrowse` capability as well
as on the viewer being an administrator, so a build pointed at upstream's server
offers the owner and tag selects to nobody and the sidebar filter is the closed
toggle alone.

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
thread out of it — relaxing that filter is all "include closed threads" in the
sidebar filter does — so nothing here needs to know about archiving.

### A command cannot be refused

`orchestration.dispatchCommand` is one dispatched method carrying a union of 30
command types — 28 upstream's, 2 fork-only. Recount rather than trust that
number:

```bash
sed -n '/^const DispatchableClientOrchestrationCommand/,/^]);/p' \
  packages/contracts/src/orchestration.ts | grep -c 'Command,$'
```

The union itself is in `packages/contracts/src/orchestration.ts` — `thread.create`, `thread.archive`,
`thread.delete`, `project.create`, `thread.pin`, `thread.settle`,
`thread.snooze` and their inverses. The backend dispatches the method, so
`UnsupportedMethodError` cannot say anything about the commands inside it: a
client that sends `thread.delete` to a backend that does not implement it gets a
generic runtime failure, after the user has already asked for the deletion.

The union grows every merge, and each new type inherits the same silence. The
2026-09-07 merge added two: `thread.active.reorder`, which persists a manual
order for the active thread list (upstream #9729), and
`thread.user-input.dismiss`, which drops an async question without answering it
(upstream #10431). Both are ordinary controls the client renders unconditionally
— a sidebar drag and a Dismiss button — and both fail generically on a backend
that does not implement them.

This is the reason `threadDeletion` and `checkpointFileRestore` are build flags
and not typed refusals, and it will be the reason for the next one too.

- **Closes when:** either the backend reports which command types it accepts, or
  the contract splits the union into methods that can each be refused. The first
  is cheaper and fits the capability record above.
- **Then here:** delete `threadDeletion` and `checkpointFileRestore`, and the
  `projectManagement` gates that cover `project.create` / `project.delete`.

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

Two more arrived in the 2026-09-17 merge, both about _when_ the settlement is
recorded rather than what it decides:

- **A linked pull request should settle its thread at once.** #12161 gave
  `ThreadSettlementReactor` a per-thread sweep and drives it from the
  `thread.pull-request-linked` and `thread.pull-request-synced` events, so a
  thread whose PR merged settles on the event instead of waiting for the next
  periodic sweep (`apps/server/src/orchestration/ThreadSettlementReactor.ts`,
  with the propagation half in `PullRequestSyncReactor.ts` and
  `PullRequestService.ts`). Moatless settles only on an explicit override
  today, so the applicable part is the shape: a settlement decision belongs on
  the event that changed the answer, not on a timer.
- **A cancelled setup should record its settlement before it rolls back.**
  #12176 made the cancellation path in `apps/server/src/ws.ts` uninterruptible
  around the record-and-rollback, because the interrupt that cancels a worktree
  setup otherwise eats the settlement and leaves the thread mid-setup. Moatless
  cancels its own sandbox setup, where the same interrupt lands in the same
  place.

- **Closes when:** the backend's settlement decision reads pin and snooze state,
  settles a snoozed thread immediately, settles on the pull-request event rather
  than on the next sweep, and records a cancelled setup's settlement before
  rolling it back.
- **Then here:** nothing to delete — this one is behaviour to reproduce, not a
  placeholder to remove.

### Workspace icons cannot hold a monogram

Upstream's #11845 added soft-tint project monograms — one or two letters over a
palette colour — and #11993 gave them their own arm on `ProjectIconOverride`,
beside `emoji` and `lucide`. The picker that returns one,
`apps/web/src/components/settings/ProjectIconPickerDialog.tsx`, is upstream's
and offers all three modes with no prop to restrict them.

The fork's Workspace settings page uses that picker, and the Workspace API's
icon has only the two older arms
(`packages/moatless-api/src/generated/model/workspaceIcon.ts`, generated by
orval from the backend's schema). There is no field to put the letters in, so
`workspaceIconFromOverride` in
`apps/web/src/components/settings/moatless/workspaceDetail.ts` reports a picked
monogram as no icon and the workspace keeps the automatic glyph it was already
drawing. Someone who picks a monogram sees the pick do nothing.

Hiding the monogram mode is the tempting fix and is the wrong one here: it means
threading a new prop into upstream's dialog and its three mode branches, which
is exactly the delta shape the Stable Fork Rules exist to avoid — and it would
be paid on every merge to buy an explanation for a mode the backend is expected
to grow.

- **Closes when:** the Workspace API's icon schema grows a monogram arm, and
  `workspaceIcon.ts`, regenerated, carries it.
- **Then here:** delete the `return null` branch at the end of
  `workspaceIconFromOverride`, and this entry with it.

### Runtime fixes upstream made to its own server

Upstream server fixes the fork cannot use, because Moatless owns the surface
itself. None is a placeholder here — there is nothing in this repository holding
them open — so they are recorded only so the next person to touch the Moatless
runtime knows the answer was already worked out upstream.

- **A completed turn should get a full idle window before its provider session
  is reaped.** Upstream's `ProviderSessionReaper` now measures idle time from the
  later of the binding's last-seen timestamp and the thread's session
  `updatedAt`, so a turn that ran longer than the idle timeout is not reaped the
  moment it settles (`apps/server/src/provider/Layers/ProviderSessionReaper.ts`,
  #10689). Relevant to Moatless exactly if it reaps provider CLI sessions on an
  idle timer of its own; a reap mid-flight or immediately after a long turn is
  the symptom.
- **Event replay should release each page as it is consumed.** Upstream replaced
  a recursive `Stream.flatMap` chain — which retained every page it had already
  yielded for the life of the stream — with `Stream.paginate`
  (`apps/server/src/persistence/Layers/OrchestrationEventStore.ts`, #10777). The
  failure mode is memory growth proportional to a thread's whole event history,
  which only shows up on long threads.

Three more arrived in the 2026-09-12 merge:

- **A message sent during context compaction should be queued, not dropped.**
  Upstream's `ProviderCommandReactor` holds a user message that arrives while a
  thread is compacting and replays it when compaction finishes
  (`apps/server/src/orchestration/Layers/ProviderCommandReactor.ts`, #11107). The
  fork has the client half of the same problem already solved — #11103 preserves
  the composer draft across a compaction — so on Moatless the text is not lost
  from the editor, but a message actually sent mid-compaction is the backend's
  problem to hold.
- **A review diff should detect renames.** Upstream's diff builder reports a
  renamed file as one rename rather than a delete and an add
  (`apps/server/src/vcs/GitVcsDriverCore.ts`, #8086). Moatless builds its own
  review diffs, so a rename shows there as two entries until it does the same.
- **A qualified provider model id should survive selection and generation.**
  Upstream stopped dropping the qualifier from Codex's fully-qualified model ids
  when carrying a selection into text generation
  (`apps/server/src/provider/ModelManifest.ts` and
  `src/textGeneration/CodexTextGeneration.ts`, #9921). Relevant to Moatless
  wherever it passes a model selection to a provider CLI by id.

Three more arrived in the 2026-09-13 merge:

- **Listing pull requests should read the projects it was asked about, not every
  project there is.** Upstream's `listWorkspaceProjects` fetched the whole shell
  snapshot and then filtered it; it now asks the projection for the one project,
  or for the listed ids, and scans nothing else
  (`apps/server/src/pullRequest/PullRequestService.ts` and
  `persistence/Layers/ProjectionSnapshotQuery.ts`, #11299). Moatless dispatches
  `pullRequests.summary` for a single thread, so the cost lands on it the same
  way the moment the summary is derived from a list.
- **Usage should read each provider account's own history directory.** Upstream's
  `UsageService` resolves an account's home from its home setting or its
  `CODEX_HOME` / `CLAUDE_CONFIG_DIR` / `GROK_HOME` environment variable, counts
  disabled accounts, and de-duplicates accounts that share a directory
  (`apps/server/src/usage/UsageService.ts`, #11485). Moatless serves
  `server.getUsageSummary` itself, so an account with a custom home reports zero
  there — or double — until it resolves homes the same way.
- **Forgejo and Gitea remotes should be first-class source control.** Upstream
  recognises both hosts and drives them with the `fj` and `tea` CLIs across
  remote identity, pull-request creation and PR sync
  (`apps/server/src/git/GitManager.ts`,
  `project/RepositoryIdentityResolver.ts`,
  `orchestration/PullRequestSyncReactor.ts`, #11436). Moatless owns git and pull
  requests, so a Forgejo or Gitea project is an unrecognised host there
  regardless of what the client can render.

Three more arrived in the 2026-09-14 merge:

- **A thread should not fail to create because a worktree could not be made.**
  Upstream now preflights whether the project cwd is a git repository at all and
  whether the resolved base ref names a real commit, falling back to the project
  checkout instead of failing thread creation (`isRepository` and `hasCommit` in
  `apps/server/src/git/GitWorkflowService.ts`, the preflight in
  `bootstrapProgram`, #6208). Largely moot today — `FEATURES.worktreeSelection`
  is off because Moatless runs each task in its own sandbox and never sets
  `worktreePath` — and recorded because the shape is the one to copy if worktrees
  ever arrive: preflight and degrade, never fail the thread.
- **Work that outlives a tool call should still emit a task lifecycle.**
  Upstream's Grok adapter derives task started/updated/completed runtime events
  from `ToolCallUpdated` payloads for long-running monitors and background
  shells (`apps/server/src/provider/acp/XAiBackgroundTasks.ts`,
  `provider/Layers/GrokAdapter.ts`, #9139). Moatless runs its own agents rather
  than upstream's ACP adapters, so none of the code is reusable — but the
  contract-level behaviour is: the client already knows how to render a task's
  lifecycle, so a Moatless task that spawns a background shell or a watcher
  lights that surface up for free by emitting the same events.
- **A transport-error pattern should not swallow the agent's own diagnostics.**
  Upstream's `transportError` regex gained a `(?!\[internal\])` so a
  `RetriableError: [internal] …` is no longer replaced with a generic "Something
  went wrong communicating with the server"
  (`apps/server/src/provider/acp/CursorTransportFailure.ts`, #11365).
  Cursor-specific and not a fork target; the generalisable part is the failure
  mode. Wherever Moatless normalises sandbox or agent errors into
  transport-versus-agent buckets, an over-broad transport pattern erases exactly
  the diagnostic a person needed.

Seven more arrived in the 2026-09-15 merge:

- **A generated thread title should describe what the user asked for.** Upstream
  reworked title generation so the title is derived from user intent and
  regenerated only when intent actually changes, with a decider
  (`decider.titleRegeneration.test.ts`), a projection field, and a scripted
  evaluation harness over recorded cases
  (`apps/server/scripts/evaluate-thread-titles.ts`,
  `orchestration/Layers/ProviderCommandReactor.ts`, #10720). Moatless titles its
  own threads, so this is the whole behaviour to copy, not a patch — including
  the harness, which is the part that makes "is the title good" answerable
  rather than argued.
- **A title's links should be resolved by the provider that owns them.**
  Upstream moved issue- and PR-reference resolution out of title generation and
  behind `SourceControlProvider`, with GitHub and GitLab implementations
  (`apps/server/src/sourceControl/`, #11844, tidied by #11847). Moatless owns
  source control, so a `#123` in a title stays unresolved text there until it
  does the same lookup.
- **A setup script should be able to block the agent.** #11832's `async: false`
  lets a project setup script finish before the agent's first turn starts.
  The fork already carries the client half — the editor's "Wait for it to finish
  before the agent starts" toggle and the `waitForSetup` → `async: false`
  mapping in `apps/web/src/projectScripts.ts` — so the flag reaches the backend
  on `project.meta.update` today and means nothing until Moatless honours it.
  See _A script runs on the backend_ above.
- **A setup script should not wait on a color probe nobody will answer.**
  Upstream sets `NO_COLOR=1` / `FORCE_COLOR=0` for a setup script, because it
  runs before any terminal client has attached to answer the probe and the
  script otherwise stalls (`apps/server/src/project/ProjectSetupScriptRunner.ts`,
  #11843). Moatless runs scripts in a sandbox terminal with the same
  nobody-is-attached window, so this is a one-line fix with a hang behind it.
- **A config subscription should not refresh providers.** Upstream dropped a
  provider refresh that ran on every `subscribeConfig` (`apps/server/src/ws.ts`,
  #11811). Relevant wherever Moatless does work on subscribe rather than on
  change: every reconnecting client paid for it.
- **Terminal output should not cost a round trip per chunk.** Upstream added a
  send window over `terminal.attach` and `subscribeTerminalEvents` — up to 8
  pending chunks or 64 KiB in flight before it waits for an ack
  (`apps/server/src/terminal/OutputProtocol.ts`, #11407). Moatless serves both
  methods, so a chatty build in a sandbox terminal is latency-bound there in
  exactly the way this fixes.
- **A tight list should stream one item at a time.** Upstream's runtime
  ingestion no longer emits a tight markdown list as one block in paragraph mode
  (`orchestration/Layers/ProviderRuntimeIngestion.ts`, #11833). Moatless builds
  its own assistant stream; see also _A turn arrives whole_ above, which is the
  larger version of the same gap.

Eight more arrived in the 2026-09-16 merge:

- **A rewind should not assume the history is the length it was.** Upstream's
  Claude adapter kept rewind working when a fork changes how many entries the
  transcript holds (`apps/server/src/provider/Layers/ClaudeAdapter.ts`, #11954).
  Moatless forks threads and drives the same CLI, so the same length assumption
  is worth looking for there — the symptom is rewind quietly unavailable on a
  forked thread.
- **A checkpoint capture should reuse the index git already stat'd.** Upstream's
  capture reuses Git index metadata instead of re-walking the tree
  (`apps/server/src/vcs/GitVcsDriver.ts`, #10792). Moatless records its own
  checkpoints and the cost this removes grows with repository size.
- **A fetch and checkout should not redo work it already has.** #11633 reworked
  that path in `apps/server/src/vcs/GitVcsDriverCore.ts`. Moatless cuts no
  worktree, but it clones and checks a repository out into every sandbox, which
  is the same work under another name and is on the critical path of starting a
  task.
- **Git process bursts should be bounded.** Upstream caps concurrent git
  processes at eight with a semaphore, and deliberately exempts the operations
  that are allowed to run long — anything with a raised timeout — so a slow
  checkout cannot sit on a permit (`vcs/GitVcsDriverCore.ts`, #11405). The
  symptom is a server that stops answering its socket while a diff fans out. The
  exemption is the part that is easy to leave out and the part that matters.
- **A preview host should be released when nobody answers the request holding
  it.** Upstream's `PreviewAutomationBroker` releases after an unanswered
  request rather than holding to timeout (`apps/server/src/mcp/`, #11381).
  Moatless hands out preview hosts per task, where a leaked one is held for the
  life of the sandbox.
- **A missing provider executable should name the setting that fixes it.**
  Upstream's Codex provider explains how to configure the binary instead of
  reporting a spawn failure (`provider/Layers/CodexProvider.ts`, #11345).
  Moatless spawns provider CLIs inside a sandbox, where "not found" is both more
  likely and harder for the reader to act on.
- **A provider health check should clean up what it unpacked.** Upstream's
  Antigravity driver stopped leaving a PyInstaller `_MEI` extraction folder
  behind on every check (`provider/Drivers/AntigravityDriver.ts`, #12008). Any
  health check that runs a packed binary on a timer does this; on a sandbox disk
  it fills it.
- **GitHub reads should stay inside the account's quota.** Upstream added a
  GraphQL budget, a rate-limit gate and a read cache across its source-control
  and pull-request providers (`sourceControl/githubGraphQlBudget.ts`,
  `sourceControl/SourceControlRateLimit.ts`,
  `pullRequest/PullRequestReadCache.ts`, #11888). Most of the surfaces this
  feeds are decided out here, but Moatless does its own GitHub reads behind
  `pullRequests.summary` and the task binding, so the budgeting half applies.

Four more arrived in the 2026-09-17 merge, all on the checkpoint path:

- **A large sparse checkout should stay on the fast checkpoint path.** #12154
  streams `git ls-files --full-name --sparse -z -v` under a 4 KiB output cap
  instead of buffering the whole listing, probes once whether this git knows
  `add --sparse`, and pins `sparse.expectFilesOutsideOfPatterns=false` on the
  index commands (`apps/server/src/vcs/GitVcsDriver.ts`, `VcsProcess.ts`,
  `processRunner.ts`). Without it a sparse checkout large enough to blow the
  output limit silently drops to the slow path on every checkpoint. Moatless
  checks repositories out into sandboxes and records its own checkpoints.
- **A checkpoint should be flushed before it is published.** #10944 writes the
  objects and refs to disk before the checkpoint is announced
  (`apps/server/src/vcs/GitVcsDriver.ts`), so a reader that acts on the
  announcement cannot find a ref pointing at an object that is not there yet.
  The failure is a race, so it is rare, unreproducible and permanent when it
  lands.
- **A ready checkpoint should survive a later placeholder.** #8432 stopped a
  placeholder that arrives after the real checkpoint from overwriting it
  (`apps/server/src/orchestration/Layers/ProjectionPipeline.ts`). The symptom is
  a checkpoint that reverts to pending and never comes back, which reads as
  losing the restore point rather than as an ordering bug.
- **A VCS wait should not hold a turn open.** #11970 took the VCS wait off the
  turn-completion path (`orchestration/Layers/ProviderRuntimeIngestion.ts` and
  `orchestration/decider.ts`), so a slow git call between the provider's last
  event and the turn being marked done no longer keeps the turn live. Moatless
  decides turn completion itself and runs git in a sandbox, where that call is
  slower than upstream's.

Eight more arrived in the 2026-09-18 merge, five of them on the checkpoint and
usage paths the previous merge already opened:

- **A file rewind should be refused when the workspace is shared.** #12306 made
  `CheckpointReactor` reject a file-restoring rewind whose cwd is shared with
  another thread or with a nested repository owner, because a checkpoint holds
  the whole checkout and restoring one erases a sibling's uncommitted work
  (`apps/server/src/orchestration/Layers/CheckpointReactor.ts`). Moatless gives
  each task its own sandbox, so the sharing case is rarer — but a workspace with
  nested repositories has the same parent-and-nested overlap inside one task, and
  that half applies directly. The client half of this landed here as a merge
  conflict: upstream added `activeWorktreePath !== null` to the "Revert files
  too" button, which now sits alongside `FEATURES.checkpointFileRestore`.
- **A checkpoint should still be captured when the baseline lookup fails.**
  #12307 stopped `CheckpointReactor` from skipping capture entirely when it
  cannot resolve a baseline, which is the case that silently leaves a turn with
  no restore point at all.
- **A file-search refresh should not run inside checkpoint processing.** #12308
  moved the refresh out of the checkpoint path, where it extended every capture
  by an index walk.
- **A checkpoint should survive an empty nested repository.** #12181 taught the
  capture path that git cannot stage an embedded repository until it has a
  commit, discovering those only after staging fails so an ordinary checkpoint
  pays no extra scan — and cleared a stale private index lock left behind by a
  forced process termination (`apps/server/src/vcs/GitVcsDriver.ts`). Moatless
  checks repositories out into sandboxes where forced termination is the normal
  end of a task, so the lock half is the one to copy first.
- **A provider event log should be bounded before it is serialized.** #12305
  gave `EventNdjsonLogger` a traversal bound and made it log decoded frames
  rather than a second copy of every token delta, with failing accessors
  contained so they cannot escape into provider processing
  (`apps/server/src/provider/Layers/EventNdjsonLogger.ts`). Any backend that
  writes a provider event log to disk grows it proportionally to tokens streamed
  until it does this.
- **Usage totals should survive transcript cleanup.** #12304 keeps canonical
  paths and source fingerprints stable across a root cleanup, so a moved
  transcript is not counted twice and saved totals are not lost
  (`apps/server/src/usage/UsageService.ts`). #10315 is the shared half: when two
  summaries claim one fingerprint the most recently read one wins and the rest
  have that provider's buckets dropped, with environment ids breaking ties so the
  winner is stable (`packages/shared/src/usageMerge.ts`). Moatless serves
  `server.getUsageSummary` itself, so both apply — see also the usage bullet in
  the 2026-09-13 group, which is the same surface.
- **Codex image attachments should be passed by path.** #11050 stopped inlining
  images as base64 into the turn/start request, so the request no longer scales
  with attachment size, and restricted the inlining to images because anything
  else reaches the agent through the path line in the prompt
  (`apps/server/src/provider/Layers/CodexAdapter.ts`). Moatless drives provider
  CLIs with its own adapters and a sandbox adds a hop, so an oversized request is
  more expensive there, not less.
- **Storage should be reclaimed on a schedule the deployment sets.** #11598's
  `apps/server/src/storageCleanup.ts` sweeps worktrees and transcripts against
  retention rules held per machine and per project, with a workspace lease so two
  servers cannot sweep the same directory
  (`apps/server/src/workspace/workspaceLease.ts`). The settings surface and its
  two capabilities are covered by _Capabilities are reported_ above; this bullet
  is the sweeper behind it, which is the part Moatless would have to build. A
  sandbox per task bounds the worktree half, but transcripts outlive the sandbox.

Nine more arrived in the 2026-09-19 merge:

- **A pull request diff too large to hold should not be cached.** #12523 caps a
  cached diff at 512 KiB of patch text, counting UTF-16 storage, and invalidates
  an oversized entry the cache is already holding
  (`apps/server/src/pullRequest/PullRequestService.ts`). Moatless derives
  `pullRequests.summary` itself, and a diff cache with a capacity but no size
  bound is how one enormous pull request pins memory for the life of the process.
- **A checkpoint's git commands should be retried when the failure is a lock or
  a vanished file.** #11665 classifies `…lock: file exists` and
  `no such file or directory` stderr as transient, carries the verdict as a
  `retryable` field on `VcsProcessExitError` (`packages/contracts/src/vcs.ts`),
  and retries the checkpoint-capture operation twice at 75 ms while keeping the
  private index and recovery's outer deadline
  (`apps/server/src/vcs/VcsProcess.ts`). The race is an agent writing files while
  a checkpoint is captured, which a sandbox makes more likely rather than less.
- **A failed settings write should put the secrets back.** #12487 turned the
  secret writes behind `serverSettings` into a change list applied around the
  settings file, with a rollback over the writes already made, so a persistence
  failure no longer leaves a provider key removed or overwritten with nothing to
  restore it from (`apps/server/src/serverSettings.ts`). Moatless stores provider
  credentials itself, and this failure is silent until the provider is next used.
- **A fetch failure should be explained without echoing the remote.** #12485 maps
  four recognised stderr shapes — authentication, unreachable host, missing
  repository, locked ref — onto fixed sentences and leaves anything unrecognised
  as the generic message, because fetch stderr can carry credentials from the
  remote URL (`fetchFailureDetail` in `apps/server/src/vcs/GitVcsDriverCore.ts`).
  Both halves are the point: a persisted error is exactly what a token leaks into.
- **A branch switch should not be readable as a path checkout.** #10574 appends
  `--` to `git checkout <ref>`, so a selection whose ref no longer exists cannot
  be taken as a pathspec and restore files over local edits
  (`apps/server/src/vcs/GitVcsDriverCore.ts`). One argument, with losing
  uncommitted work behind it.
- **Rate limits from a tolerated read should still be recorded.** #12486 keeps
  the Bitbucket rate-limit headers from optional pull-request reads instead of
  discarding the accounting along with the error
  (`pullRequest/BitbucketPullRequestProvider.ts`, `sourceControl/BitbucketApi.ts`).
  Bitbucket is not a fork target; the shape is — wherever Moatless swallows an
  optional host read, the budget was spent whether or not the caller wanted the
  answer.
- **An evicted preview host should be able to register again.** #12535 completes
  the RPC stream on eviction rather than shutting the queue down, so a desktop
  that was merely slow to answer can re-register, and serializes the
  live-generation check with the offer so a route cannot outlive its generation
  (`apps/server/src/mcp/PreviewAutomationBroker.ts`). This is the follow-up to
  the preview-host bullet in the 2026-09-16 group. The client half landed here,
  in `packages/client-runtime/src/rpc/client.ts`.
- **A server should export log records, not only traces and metrics.** #12493
  adds an `otlpLogsUrl` and lifts the shared `otlpResource` out so all three
  signals report one service identity (`apps/server/src/config.ts`,
  `observability/Layers/Observability.ts`). The fork already exports client spans
  to a Moatless collector; this is the server-side half, and the shared resource
  is what makes the three joinable at the collector.
- **Pull request reads should be batched rather than fanned out.** #11825 reworked
  the GitHub provider so a preview costs far fewer requests, with a measurement
  script to prove it (`apps/server/scripts/measure-pr-preview.ts`,
  `pullRequest/GitHubPullRequestCli.ts`, `pullRequest/gitHubPullRequestJson.ts`).
  Sits beside the GitHub budgeting bullet in the 2026-09-16 group: most of the
  surface is decided out here, but Moatless does its own GitHub reads behind
  `pullRequests.summary`.

Four more arrived in the 2026-09-20 merge:

- **An agent that dies during session start should report its own stderr.**
  #12625 buffers the ACP child's stderr and, when `cursor-agent` exits before the
  session handshake completes, raises the captured text instead of the generic
  session-start failure (`apps/server/src/provider/acp/AcpStderr.ts`,
  `provider/Layers/CursorAdapter.ts`). Moatless launches its own agent processes
  in a sandbox, so the same failure — a bad credential, a missing binary, a
  refused network — reaches a person as "could not start the session" with the
  one line that explained it discarded.
- **An empty provider home should resolve to the default, not to a fresh one.**
  #12624 treats a Claude account whose `homePath` is set but empty as `~/.claude`
  rather than an unset home, so the account shares session continuation with the
  default rather than starting its own transcript directory
  (`apps/server/src/provider/Drivers/ClaudeDriver.ts`). Moatless resolves
  provider homes itself; the symptom is a resumed thread that has forgotten
  everything, on an account that merely had a blank field.
- **A provider permission prompt should be approvable, not just displayed.**
  #7861 adds a `permission` provider-request kind and a `permission_approval`
  canonical request type (`packages/contracts/src/orchestration.ts`,
  `providerRuntime.ts`) and has the Codex adapter raise app permission requests
  through the ordinary approval path
  (`apps/server/src/provider/Layers/CodexProvider.ts`). Both contract members
  landed in this merge, so the client and mobile halves are already here;
  Moatless has to emit the request for the surface to light up, and until it does
  a Codex permission prompt stalls the turn with nothing to answer it.
- **An editor installed outside `PATH` should still be launchable.** #12439 falls
  back from `isCommandAvailable` to the platform's install locations — macOS
  `Applications` bundles, JetBrains Toolbox scripts, Windows program directories
  — before declaring an editor absent (`packages/shared/src/editor.ts`,
  `apps/server/src/process/externalLauncher.ts`). Moot while
  `FEATURES.openInEditor` is off, and recorded because it is the detection
  Moatless would need the day it dispatches `shell.openInEditor`: a GUI editor is
  normally not on the `PATH` of the process asking about it.

- **Closes when:** the Moatless backend's session reaper reads the later of the
  two timestamps, its thread/session event replay releases consumed pages, its
  compaction path queues in-flight user messages, its review diffs report
  renames, it passes qualified model ids through unmodified, its pull-request
  reads are scoped to the projects asked for, its usage scan follows each
  account's own home, it recognises Forgejo and Gitea remotes, it preflights and
  degrades rather than failing a thread whose worktree cannot be made, it emits
  task lifecycle events for work outliving a tool call, and its error
  normalisation preserves internal agent diagnostics, its titles are generated
  from user intent and resolve their own links, it honours `async: false` on a
  setup script and runs one without a color probe, it does no provider refresh
  on subscribe, it windows terminal output rather than acking per chunk, it
  streams tight list items one at a time, its rewind survives a history that
  changed length, its checkpoint capture reuses index metadata, its clone and
  checkout skip work already done, its git processes are bounded with the long
  operations exempt, it releases a preview host whose request went unanswered,
  it names the setting behind a missing provider executable, its health checks
  clean up what they unpack, its GitHub reads are budgeted and cached, a large
  sparse checkout stays on its fast checkpoint path, its checkpoints are flushed
  before they are published and survive a late placeholder, a VCS wait no
  longer holds a turn open, a file rewind is refused on a shared or nested-owner
  cwd, a checkpoint is captured when the baseline lookup fails and survives an
  empty nested repository, its file-search refresh is off the checkpoint path,
  its provider event log is bounded before serialization, its usage totals
  survive transcript cleanup and its shared scans resolve to the newest, it
  passes provider image attachments by path, it sweeps stale worktrees and
  transcripts against retention rules it reports a capability for, it neither
  caches nor keeps an oversized pull request diff, its checkpoint git commands
  are retried on a lock or a vanished file, a failed settings write rolls its
  secret changes back, a fetch failure is explained without echoing remote
  stderr, a branch switch cannot be read as a pathspec, rate limits survive a
  tolerated host read, an evicted preview host can register again, its log
  records are exported over OTLP under the same resource as its traces, its
  pull request reads are batched rather than fanned out, an agent that dies
  during session start surfaces its own stderr, an empty provider home resolves
  to the default rather than a fresh one, it emits `permission` provider
  requests for approval, and its editor detection looks past `PATH`.
- **Then here:** nothing to delete — behaviour to reproduce, not a stand-in.
  Strike each bullet once it is confirmed in the backend, and the entry when the
  last one goes.

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

The 2026-09-19 merge widened it. Upstream rewrote `test-t3-app` around a Browser
panel driven from the desktop app (#12414) and gave the mobile client a device
panel that views and controls an agent's devices over a device stream (#12531,
`apps/mobile/src/features/devices/`). Both are paired-device surfaces: each
assumes the bundled server brokering between a client and a registered device,
which is what device pairing is decided out for above. The scope notes were
re-applied over the rewritten skills rather than extended — saying more would
mean asserting something about Moatless that nobody has checked.

### Merges must be merge commits

The 2026-08-02 merge was applied as four cherry-picks. `git merge-base` never
advanced past `0ad91b6e`, so the 2026-08-06 merge replayed 63 commits where 59
were new, re-conflicted 17 files that were already identical to upstream, and
needed a hand reconciliation of the file counts before they made sense.

Nothing is broken now — the base is correct again as of the 2026-08-06 merge
commit. This is a rule, not a repair: **land upstream with a merge commit.** A
cherry-pick moves the code without moving the base, and every later merge pays
for it.

### `pnpm test` does not test every package

`vp run -r test` leaves packages out, and it exits 0 without them. On
2026-09-07 it reached eleven and never started `t3` (`apps/server`), whose 293
test files cover the whole backend this fork talks to. Which packages it drops
changes between merges: it dropped `apps/web` through 2026-08-16.

It also stops the packages still running as soon as one of them fails. That day
a `@t3tools/desktop` failure truncated `apps/web` and `@t3tools/mobile` after
each had reported hundreds of passing files and before either printed a
summary. Four failing web tests went unreported.

What it costs: a merge that breaks a test in a dropped or truncated package is
green. The 2026-08-16 merge landed four broken web tests that `verify.mjs`
reported nothing about.

What holds it open: nothing fork-owned — root `package.json` has no fork delta,
so this is upstream's task graph, not a fork decision. `verify.mjs` compensates
rather than fixes. It reads which packages printed a closing `Test Files` line,
runs every other package that declares a test script alone, and fails the step
on the ones that fail alone. So run the check, not the raw command:

```bash
node .agents/skills/fork-upstream-merge/scripts/verify.mjs --only test
```

- **Closes when:** `pnpm test` reaches every package that declares a test script
  and lets the packages still running finish.
- **Then here:** delete this entry, and delete `completedPackages` and the
  alone-run loop from `verify.mjs`.

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

- **Package:** `@t3tools/web`
- **Open while:** `node -e 'process.exit(process.version.startsWith("v24") ? 0 : 1)'`
  — the gap is the machine's node, so the marker appears on exactly the machines
  that have it.
- **Check:** run the file on Node 24. It passes.
- **Then here:** nothing to delete — this is a version mismatch, not fork code.
  Listed so the next reader does not chase it as a merge regression.

### The desktop suite needs libsecret, which the sandbox does not have

`apps/desktop/scripts/browser-secret-native.test.mjs` fails with
`Command failed: pkg-config --cflags --libs libsecret-1`. The test compiles the
bundled `t3-browser-secret` helper, which reads Chromium's cookie keys from the
Linux keyring, and the sandbox image ships neither `libsecret-1` nor its
pkg-config file. The file is byte-identical to upstream and predates every merge
that has hit it, so `verify.mjs` reports `@t3tools/desktop` failing alone on a
clean tree.

Nothing here is a fork target: `electron-desktop` in `inventory.json` says the
desktop app is kept in tree and is not a compliance target.

- **Package:** `@t3tools/desktop`
- **Open while:** `pkg-config --exists libsecret-1` — it exits nonzero exactly
  when the library the suite needs is absent, so the marker retires itself the
  day the image carries it.
- **Check:** `pkg-config --exists libsecret-1`. Installing `libsecret-1-dev`
  makes the suite green.
- **Then here:** nothing to delete — this is a missing system library, not fork
  code. Listed so the next merge does not chase it as a regression, and so a
  reader knows `@t3tools/desktop` is expected red until the image carries it.

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
