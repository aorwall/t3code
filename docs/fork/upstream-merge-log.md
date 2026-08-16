# Fork upstream merge tracker

Append-only, newest first.

An entry is written for whoever does the _next_ merge or fork change, and holds
only what that person needs: where upstream was, what conflicted and how it was
resolved, what a sweep or tripwire found, what is unverified, and which
verification failures are the machine rather than the code. Why a fork decision
was made is not that — put the durable form in
[the merge inventory](./inventory.json) and link the row from here.
If an entry runs past a few bullets, the rest belongs in the inventory. Work a
merge found and did not do belongs in [the fork gaps](./gaps.md), not in a
bullet here that no one will read again.

## Entry template

```markdown
### YYYY-MM-DD — short title

- Upstream: `<head>` from base `<base>` (`N` commits).
- Landed: `<A>` files from `git diff --stat HEAD^1 HEAD` against `<B>` files in
  the upstream range; fork delta `<C>` files from `git diff --stat HEAD^2 HEAD`.
  Explain any gap between `A` and `B`.
- Conflicts: paths and resolution rule used.
- Sweep: owned-concern hits and decision.
- Verification: commands run, failures or caveats.
```

## Log

### 2026-08-16 — merged upstream to 27732293

- Upstream: `27732293` from base `5a846148` (`159` commits). Landed as a merge
  commit; the base advanced cleanly from the 2026-08-12 entry.
- Landed: `595` files from `git diff --stat HEAD^1 HEAD` against `598` in the
  upstream range. The gap of three is exactly the fork's deliberate deletions,
  re-deleted on delete/modify conflicts: `PreviewLocalServerCard.tsx`,
  `useDiscoveredLocalServers.ts` and its test. Fork delta `609` files from
  `git diff --stat HEAD^2 HEAD` (was `598`).
- Conflicts, twenty files. Nine had a cached verdict, eleven fell to the
  `decide-then-add-entry` fallback inside an owned concern:
  - `PreviewLocalServerCard.tsx`, `useDiscoveredLocalServers.ts` + `.test.ts` —
    delete/modify; `git rm` per `deletedUpstreamPaths`.
  - `PreviewEmptyState.tsx` + `.test.tsx`, `PreviewView.tsx` — upstream added a
    "Recently used" group above the server list and renamed its own group to
    "Local servers". Adopted the recents group (it reads the client-side
    browser history store, so it works here) and kept the fork's Moatless
    server list under "Preview servers"; dropped upstream's `environmentId` /
    `configuredUrls` props, which only feed the deleted local-server scan.
    Entry: _Hosted web preview_.
  - `Sidebar.tsx` — upstream replaced `changeRequestStateByKey` with a
    `ThreadChangeRequestSnapshot` matched on branch. Re-stated the fork gate as
    one leading `FEATURES.prThreadSettling &&` on upstream's new condition.
    Entry: _PR-driven settling gate_.
  - `ChatView.tsx` (4 hunks) — upstream's `autoSettleOnMerge`,
    `desktopByTabId` and two new imports beside the fork's gate,
    `previewServerLabelsByOrigin` and `useThreadPreviewServers`; kept both
    each time.
  - `LegacySidebar.tsx`, `ProviderSettingsPanel.tsx` — upstream restyled the
    button inside a fork gate; took upstream's markup, kept the gate.
  - `SidebarChrome.tsx` — upstream restyled the wordmark row the fork replaced
    with `APP_BASE_NAME`. Kept the fork's span. This delta had **no inventory
    entry**; added _Moatless branding_.
  - `RightPanelTabs.tsx` — one hunk was a fork-side stray blank-line deletion
    against upstream's new launcher-shortcut block; took upstream. The other
    kept both `previewServerLabelsByOrigin` and `desktopByTabId`.
  - `AppRoot.tsx` + `.test.tsx` — both sides added a provider child; kept both
    and moved the test to five children.
  - `packages/contracts/src/environment.ts` — both sides added a capability
    key; kept both.
  - `AGENTS.md` — upstream's only change in range was deleting the
    rebase-before-PR bullet; took the fork's rewritten file and deleted the
    fork's paraphrase of that bullet.
  - `threadActionMenu.logic.ts` + `.test.ts`, `useThreadActionMenu.ts` — see
    convergence below.
- Post-merge fixes the conflict resolution did not catch, all found by
  `verify.mjs` rather than by reading: a stray `getConfiguredPreviewUrls`
  import in `ChatView.tsx` (the fork removed the call site), a duplicate
  `archiveThread` destructuring in `Sidebar.tsx`, and duplicate `case
"archive"` arms in `Sidebar.tsx` and `useThreadActionMenu.ts` — all four the
  same convergence landing twice.
- Sweep: seven concern hits, all false positives. `clerk/*` (four new files) is
  upstream's own Clerk work on a surface the fork has already decided out and
  does not route to; `.agents/skills/test-t3-mobile/scripts/pair-client.sh` is
  upstream's pairing helper under a `converged` SKILL.md whose scope note
  already routes Moatless work elsewhere; `session-logic.command-output.test.ts`
  is an upstream test. Deleted-surface tripwires unchanged at Clerk 4 files,
  session bootstrap 9, pairing 76 files.
- Off-repository: `web-preview.yml` — flagged for disabling by the 2026-08-12
  entry, unregistered then, registered and `active` now — disabled with
  `gh workflow disable web-preview.yml`. `mobile-fingerprint-check.yml`, from
  the same entry, was already disabled. `publish-aur.yml` is new this merge
  (`e25021af7`) and is not yet registered: **disable it after this branch
  lands** — `gh workflow disable publish-aur.yml --repo soaplabs/t3code`.
- Convergence, two fired:
  - _Archive in the sidebar row menu_ — upstream shipped archive in
    `buildThreadActionMenuItems`, `Sidebar.tsx` and `useThreadActionMenu.ts`
    (`48cba7d93`), with a confirm dialog and navigation handling the fork's
    version lacked. Dropped the fork item and both its cases; replaced the
    inventory entry with _Thread deletion gate in the row menu_, which is the
    only fork delta left on that file. Upstream's new
    "archive sits right before delete" test cannot hold while delete is gated
    off, so it was folded into the fork's existing tail assertion.
  - Send while a turn is running — upstream shipped `showSendWhileRunning`
    (`7afa184a9`, `184d8ef33`), gated on `isMobileViewport` and rendering stop
    _and_ send rather than swapping one for the other. Dropped the fork's PR
    #39 delta; a phone browser is a mobile viewport, so the fork's case is
    served and upstream's is strictly better. New convergence row:
    _Send while a turn is running_.
- Unsupported methods: ADD 0, DROP 1, KEEP 2. The DROP is `scripts.run`, which
  is the documented standing exception — `apps/server` still answers it with
  `UnsupportedMethodError`, and the derivation reads only the Moatless side.
  Union entry kept; see _A script runs on the backend_ in the gaps register.
  Upstream added three contract methods this range (`pullRequests.update`,
  `updateComment`, `setReaction`), all inside the already-recorded
  `pullRequests.*` group, and one capability (`agentActivityPublishing`).
- Verification: `verify.mjs` — tripwires, unsupported-methods, `fmt:check`,
  `lint` and `typecheck` all pass. `test` reports three package failures, all
  machine pressure and all passing run alone: `effect-acp` and
  `oxlint-plugin-t3code` exit 137, and upstream's byte-identical
  `packages/shared/src/composerInlineTokens.test.ts` perf assertion missed its
  1000 ms budget by 200 ms. See _The full suite needs a raised heap_.
- Caveat worth carrying: `pnpm test` runs six packages and **`apps/web` is not
  one of them**, so `verify.mjs` never exercised the web tests this merge
  changed. Ran `apps/web`'s `unit` project directly instead, which is how the
  four broken web tests above were found at all. Not new to this merge, and not
  a fork delta — but a merge that only trusts `verify.mjs` is not testing the
  fork's product surface. Now a gaps entry.
- `apps/web` unit suite after the fixes: 2 711 pass, four files still red and
  none of them this merge's doing —
  `authBootstrap.test.ts` (12 tests, HTTP mock not intercepting; confirmed
  identical on `HEAD^1` with the pre-merge lockfile installed) and
  `promptStashStore.test.ts`, `useTheme.test.ts`, `imageCompression.test.ts`
  (Node 25's `localStorage` stub; the last two pass run alone). Both are gaps
  entries now.

### 2026-08-12 — merged upstream to 5a846148

- Upstream: `5a846148` from base `2c7267ad` (`91` commits). Landed as a merge
  commit; the base advanced cleanly from the 2026-08-08 entry.
- Landed: `414` files from `git diff --stat HEAD^1 HEAD` against `414` in the
  upstream range — exact match, nothing dropped. Fork delta `598` files from
  `git diff --stat HEAD^2 HEAD`.
- Conflicts, thirteen files, resolved by the inventory's path policy (none had
  a cached `pathPolicy` verdict; all fell to the `decide-then-add-entry`
  fallback inside an owned concern):
  - `Sidebar.tsx`, `threadActionMenu.logic.ts` + `.test.ts`,
    `useThreadActionMenu.ts` — upstream added `copy-thread-id` to the shared
    menu beside the fork's `archive` case; concatenated both. Entry:
    _Archive in the sidebar row menu_.
  - `ChatView.tsx`, `RightPanelTabs.tsx`, `rightPanelStore.ts` — upstream
    shipped the pull-request detail panel and an Agents-card live count
    alongside the fork's `SandboxedRightPanelTabs` wrapper and
    `retargetFile`/file-surface state; kept both independently. Also found and
    fixed a gap the merge would otherwise have introduced: upstream's new
    "Pull request" and "Agents" add-surface menu items in `RightPanelTabs.tsx`
    did not route through the fork's `surfaceAvailable`/`disabledReason`
    helpers the other four items use, so a stopped sandbox would not have
    disabled them. Wrapped both. Entries: _Sandbox lifecycle controls_,
    _Servers view in right panel_.
  - `CommandPalette.tsx` — upstream added a contextual "Project settings"
    action; re-applied the fork's `paletteActionEnabled` filter around the
    full action list including the new item. Entry: _Navigation gates_.
  - `DiffPanel.tsx` — import/add on the same line as upstream's new
    `createGitDiffFileContentsLoader`; kept both.
  - `chat/PanelLayoutControls.tsx` — upstream added its own
    `showTerminalControl` prop (used by the new `/pull-requests` route, which
    has no terminal). ANDed it with the fork's `FEATURES.terminalDrawerToggle`
    rather than picking one. Entry: _Chat surface gates_.
  - `settings/settingsSearch.test.ts` — add/add on adjacent assertions
    (fork's whitespace-collapse case, upstream's new `glass`/`xyzzy` cases);
    concatenated.
  - `packages/contracts/src/rpc.ts` — import/add for the new `sandbox.ts` /
    `servers.ts` fork imports beside upstream's new `usage.ts`; kept both.
    Entry: _Hosted-environment contract group_.
  - `routeTree.gen.ts` — hand-merged the three import/add hunks (new
    `/pull-requests` and admin-detail routes both landing in the same gaps);
    the router plugin re-sorted the import order on the next `tsgo`/`vp test`
    run, confirming the merge was correct.
  - `apps/web/src/routes/_chat.pull-requests.tsx` (new upstream, no conflict)
    typechecked against `RightPanelTabsProps` and failed:
    `previewServerLabelsByOrigin` is a fork-only required prop
    (_Servers view in right panel_) that upstream's file never had reason to
    pass, since it renders no preview sessions. Made the prop optional with an
    empty-map default instead of touching the new file.
  - Unrelated to the merge but caught by the same `vp test` run:
    `apps/web/src/fork/features.test.ts`'s `serverUpdateBanner` guard
    referenced an unimported `chatViewSource` left over from an earlier
    refactor (introduced 2026-08-11, one commit before this merge started).
    Fixed by routing it through the same `webSources` glob the rest of the
    file's guards use, and gave the flag a proper `inventory.json` guard entry
    instead of a bespoke test.
- Sweep: three keyword hits, all false positives —
  `apps/web/src/components/ConfirmDialogHost.tsx` and
  `apps/web/src/components/pullRequest/PullRequestGhosts.tsx` both matched
  `host` inside `Host`/`Ghosts`, and `patches/@clerk__expo@4.2.0.patch` is a
  routine dependency patch (an iOS native-view navigation fix), not new Clerk
  auth work. Deleted-surface tripwires unchanged at Clerk 4 `package.json`,
  session bootstrap 9, pairing 74 files. Off-repository check: the two new
  upstream workflows (`mobile-fingerprint-check.yml`, `web-preview.yml`) are
  not yet registered on GitHub (unpushed at merge time) — **disable both after
  this branch lands**:
  `gh workflow disable mobile-fingerprint-check.yml --repo soaplabs/t3code` and
  `gh workflow disable web-preview.yml --repo soaplabs/t3code`. Also found
  `thread-transfer-report.yml` still `active` from the 2026-08-08 merge, whose
  own tracker entry said to disable it and did not; disabled it now.
- Convergence: nothing to drop. Upstream shipped a new
  `capabilities.pullRequests` boolean (a fifth per-surface capability) — the
  client already reads it directly (`supportsPullRequests`) with no `FEATURES`
  flag involved, so the whole pull-request surface follows the backend with
  zero fork code, by construction. No other convergence watch-list item fired:
  no dev-proxy/allowed-hosts consolidation, no thread-server concept, no
  upstream web preview, no archive entry point, no PR-driven-settling
  strengthening, no message-provenance field, no searchable-settings
  extraction.
- Unsupported methods: recomputed both directions after teaching
  `unsupported-methods.mjs` to resolve a shared `error: FooError` const the
  same way it resolves an inline union (upstream's new `PullRequestRpcError`
  is the first RPC error type factored out that way; the un-patched script
  reported all thirteen `pullRequests.*` methods as missing a union entry when
  they already had one through the shared const). `52` of `101` contract
  methods now declare `UnsupportedMethodError` (was `38`): `+13` for
  `pullRequests.*` and `+1` for `server.getUsageSummary`, both new upstream
  and both genuinely undispatched. The two conditional refusals —
  `vcs.switchRef`, `git.preparePullRequestThread` — keep their union member.
  See [the gaps register](./gaps.md), which gained _Pull requests_ and
  _Usage summary_ entries and extended _Desktop and host lifecycle_ with the
  `serverUpdateBanner` flag.
- Verification: `pnpm typecheck`, `pnpm lint`, `pnpm fmt:check` clean; full
  `pnpm test` passes on Node 22.23.2 — `2369` passed, `7` skipped across `230`
  test files repo-wide (`apps/web` alone: `2392` passed, `253` files). Needs
  `NODE_OPTIONS=--max-old-space-size=12288` (exit 137 is the OOM killer, not a
  failure). Not verified in a browser.

### 2026-08-08 — merged upstream to 2c7267ad

- Upstream: `2c7267ad` from base `e4abc31f` (`58` commits). Landed as a merge
  commit; the base advanced cleanly from the 2026-08-06 entry.
- Landed: `290` files from `git diff --stat HEAD^1 HEAD` against `291` in the
  upstream range; fork delta `589` files from `git diff --stat HEAD^2 HEAD`.
  Four upstream-range files did not land — `AGENTS.md` (decided ours, below) and
  the three local-server-preview files the fork drops
  (`preview/PreviewEmptyState.tsx` kept fork-side, `useDiscoveredLocalServers.ts`
  and its test re-`git rm`'d) — offset by three fork-only files this merge
  touches (`docs/fork/gaps.md`, this tracker, `fork/features.test.ts`), so
  `291 − 4 + 3 = 290`. Fork delta is dominated by the fork-only
  `packages/moatless-api` generated client; it did not grow from re-applied
  deltas this merge.
- Conflicts, resolved by the inventory's path policy:
  - `apps/web/src/components/Sidebar.tsx` — upstream renamed SidebarV2 → the
    default `Sidebar.tsx` (`SidebarV2.tsx` `git rm`'d, `#5672`). Took upstream and
    re-stated the fork deltas: `FEATURES.prThreadSettling` gate on
    `changeRequestState` (atop upstream's reorderable-pins restructure), touch
    context-menu props, inline bulk `threadDeletion` gate, `projectManagement`
    gates, `archive` row action. Entries: _PR-driven settling gate_, _Archive in
    the sidebar v2 row menu_, _Mobile Touch Delta_.
  - `apps/web/src/components/LegacySidebar.tsx` — new upstream file (= old
    Sidebar). Re-applied `FEATURES` import, `useTouchContextMenu`, and the
    `projectManagement` gate on "Add project".
  - `threadActionMenu.logic.ts` + `.test.ts` — shared menu now feeds the new
    Sidebar and the chat-header title menu (`#5592`). Added `archive`, gated
    `delete` behind `FEATURES.threadDeletion`; updated the two upstream tests
    that asserted `delete` last/destructive.
  - `useThreadActionMenu.ts` — re-applied the `archive` case.
  - `settings/SettingsPanels.tsx` — took upstream (ProviderSettingsPanel
    extracted out, assistant-streaming setting folded into a new Legacy features
    section, `#5664`); re-applied the four `FEATURES` gates and gated the
    relocated token-streaming toggle behind `FEATURES.assistantStreaming`.
  - `settings/ProviderSettingsPanel.tsx` — new upstream file (`#4479`,
    per-device provider settings). Ported the `FEATURES.serverAdministration`
    gate onto the add-instance affordance.
  - `settings/SettingsSidebarNav.tsx`, `settingsSearch.ts` — dropped
    `/settings/beta` (removed upstream), kept the MoatlessAdminPath group.
  - `chat/ChatHeader.tsx`, `CompactComposerControlsMenu.tsx`,
    `ComposerPrimaryActions.tsx` + test, `MessagesTimeline.tsx` — re-applied
    the `FEATURES` gates and the message-origin chip; converged the Stop/Send
    condition on upstream's `#5554` helper.
  - `preview/PreviewEmptyState.tsx` + test, `PreviewView.tsx` + test — kept the
    hosted-`useThreadPreviewServers` delta, dropped upstream's local-server
    discovery (`useDiscoveredLocalServers`, `PreviewLocalServerCard`,
    `PreviewRecentUrlCard`). Entry: _Hosted web preview_.
  - `rightPanelStore.ts` — kept the fork's generic unknown-kind drop (it now
    subsumes upstream's v9 `plan`-kind removal) and took upstream's
    active-surface fallback to the first survivor.
  - `AGENTS.md` — `decide`. Kept the fork's slimmed "Hit every surface" list
    (upstream's side there was byte-identical to base). Upstream's only other
    change refined the bundled-server `--share`/pairing note; half of it
    references `apps/server/src/bin.ts pair`, a CLI this fork removed, and the
    rest is marginal mechanics on a non-target path the fork's terse note
    already covers — so it was deliberately not absorbed.
  - `pnpm-lock.yaml` — took upstream, regenerated for the fork's
    `@t3tools/moatless-api` workspace package, verified with `--frozen-lockfile`.
- Sweep: `git diff --diff-filter=A ... | grep -Ei 'auth|pair|...'` returned two
  hits, both keyword false positives (`settings/ThemeEditorHost.tsx` — theme
  editing; mobile `WorkspaceConnectionTitle.tsx`). No owned-concern additions.
  Deleted-surface tripwires unchanged at Clerk 4 `package.json`, session
  bootstrap 9, pairing 73 files; deletions vs upstream are exactly the five known
  fork drops (two `cli/pair.*`, three local-server-preview files). Off-repository
  check: only `build-moatless-t3-image.yml` and the two dependabot workflows are
  active — but upstream adds `.github/workflows/thread-transfer-report.yml`,
  which will arrive `active` once this lands: **disable it with
  `gh workflow disable thread-transfer-report.yml --repo soaplabs/t3code` after
  merge.**
- Convergence: nothing to drop. Upstream added the wire capability
  `threadPinReorder` (a fourth per-surface boolean); Moatless does not report it,
  and it gates no `FEATURES` flag, so the surface already follows the backend —
  recorded in [the gaps register](./gaps.md). No upstream archive action, no
  message-provenance field, no thread-server concept, no `SettingsSection`
  search, no dev-proxy/allowed-hosts consolidation.
- Unsupported methods: recomputed both directions. No new upstream WebSocket
  methods, so nothing to add; `38` of `87` contract methods declare
  `UnsupportedMethodError` (was `49` before the eleven dropped since; the gaps
  count is corrected). The two conditional refusals — `vcs.switchRef`,
  `git.preparePullRequestThread` — keep their union member: their arms in
  `crates/t3code/src/lib.rs` still reach `unsupported_exit`. See
  [the gaps register](./gaps.md).
- Verification: `pnpm typecheck`, `pnpm lint`, `pnpm fmt:check` clean; full
  `pnpm test` passes per package on Node 22.23.2 — web 2163, server 1908 (+7
  skipped), mobile 617, desktop 447, client-runtime 592, shared 320, contracts
  231, relay 209, oxlint-plugin 35, effect-acp 31, ssh 25, moatless-api 15,
  tailscale 13. Caveats: needs `NODE_OPTIONS=--max-old-space-size=12288` (exit
  137 is the OOM killer, not a failure — see the gaps register); `pnpm lint`
  emits one warning for an unused oxlint-disable directive in upstream's new
  `settings/ThemeEditorPanel.tsx` (exit 0, upstream's own, not a fork change).

### 2026-08-06 — merged upstream to e4abc31f

- Upstream: `e4abc31f` from base `0ad91b6e` (`63` commits). The base is not
  `5192f777` from the entry below: that merge was applied as four cherry-picks
  rather than a merge commit, so `git merge-base` never advanced and this range
  replays them. They merged clean — the fork's side of every file they touched
  was byte-identical to upstream's.
- Landed: `313` files from `git diff --stat HEAD^1 HEAD` against `337` in the
  upstream range; fork delta `548` files from `git diff --stat HEAD^2 HEAD`.
  The `26`-file gap is those cherry-picks: `25` of the files are byte-identical
  to `upstream/main`, and the twenty-sixth is `apps/server/src/bin.ts`, which
  differs only by the pairing CLI this fork removed. Two files move the other
  way (the diagnostic suppressions below), so `337 − 26 + 2 = 313`.
- Conflicts, twenty-five files. Thirteen under `apps/server/` plus
  `docs/internals/server-updates.md`, `docs/user/updating.md` and
  `packages/client-runtime/src/state/server.ts` and its test were the
  cherry-pick artefact above: took upstream. `pnpm-lock.yaml` took upstream and
  was regenerated. The seven fork conflicts:
  - `ChatView.tsx` — kept the `SandboxedRightPanelTabs` alias beside upstream's
    new `AgentsPanel` imports. Entry: _Sandbox lifecycle controls_.
  - `RightPanelTabs.tsx` — kept the sandbox disabled-state branch, took
    upstream's `data-right-panel-surface-content`.
  - `SidebarV2.tsx` — upstream added thread pinning and restructured the
    partition memo. Took upstream whole and re-stated the
    `FEATURES.prThreadSettling` gate inside it; kept the `archive` row item.
    Entries: _PR-driven settling gate_, _Archive in the sidebar v2 row menu_.
  - `PreviewPanel.tsx`, `PreviewView.tsx` and their tests — took upstream's
    annotation send-through and full-URL chrome row, kept the hosted-frame
    delta and the fork's removal of `configuredUrls`. Entry: _Hosted web
    preview_.
  - `PreviewChromeRow.test.tsx` — add/add. Upstream now owns this path; the
    fork's two cases sit beside upstream's. Path policy updated.
- Sweep: five `apps/server/src/cloud/service*.ts` hits, the same systemd
  self-update files accepted on 2026-08-02 and still in range only because the
  base is stale. No new owned-concern additions. Tripwires unchanged at Clerk 4,
  session bootstrap 9, pairing 73 files. Off-repository check clean — upstream
  added no workflow, and the nine inherited ones are still `disabled_manually`.
- Unsupported methods: two new upstream WebSocket methods,
  `review.getDiffFileContents` and `orchestration.getWorkflowScript`, are not in
  the backend's dispatch and now declare `UnsupportedMethodError`. Deriving them
  turned up thirteen entries stale the other way — see _Deriving the unsupported
  set_, which also records that the backend's dispatch moved to
  `crates/t3code/src/lib.rs`.
- Convergence: nothing to drop. Upstream's preview is still desktop-webview
  only, no upstream thread-server concept, no message-origin field, no archive
  entry point in v2, no work on the dev proxy or allowed hosts. Upstream did add
  `capabilities.threadPinning` — a third per-surface capability boolean, which
  is where surface gating converges; the watch-list entry now says so.
- `origin/main` moved under this branch mid-merge (#58, the Moatless
  administration surfaces) and was merged in. Its only conflict was this
  directory: #58 converted the inventory from tables to lists so an edit stops
  re-padding every row, and this branch's four inventory changes were re-stated
  in that shape.
- Verification: `pnpm typecheck`, `pnpm lint` and `pnpm fmt:check` clean; the
  full test suite passes on Node 22.23.2 — web 1962, server 1874, mobile 615,
  client-runtime 570, contracts 232, relay 209. Two caveats:
  - `pnpm test` and `pnpm typecheck` need `NODE_OPTIONS=--max-old-space-size`
    raised on an 8-core sandbox. Exit code 137 from a package is the OOM killer,
    not a failure; each one passed run on its own. One mobile test
    (`nativeReviewDiffHighlighter`) also fails only under that pressure.
  - Two fork-only modules failed a repo-wide typecheck before this merge and now
    carry a narrow `@effect-diagnostics-next-line` with the reason:
    `packages/moatless-api/src/customInstance.ts` (`globalFetch`) and
    `apps/web/src/moatless/query.ts` (`globalErrorInEffectCatch`). Both landed
    with CI disabled, so nothing had run the check. Recorded in their inventory
    entries.
- Not verified in a browser.

### 2026-08-03 — the chat drops the terminal-drawer toggle

- Fork delta on one upstream file. Inventory row: _Chat surface gates_, which now
  covers `apps/web/src/components/chat/PanelLayoutControls.tsx`.
- The button splits the chat horizontally by opening a terminal across the
  bottom, and the fork keeps one way to a terminal: the right panel's surface.
  New flag `terminalDrawerToggle` in `apps/web/src/fork/features.ts`, one gate
  expression, upstream's props and the drawer itself untouched — `terminal.toggle`
  still opens it.
- Not a backend gap, so this flag is not waiting on Moatless. Delete it if the
  fork wants the button back.
- Verification: web typecheck, lint on both files and `vp fmt --check` clean;
  `vp test run apps/web/src/fork` 22 passing. Not verified in a browser.

### 2026-08-03 — the inventory gets an upstream to check against

- A sandbox can check ownership now: `git remote add upstream ...` plus
  `git fetch --depth=1 upstream main`, both in Path policy. The fork's own clone
  is shallow, so nothing else answers the question.
- That check split `.plans/**`, which was `ours` while upstream owns 32 of its
  35 files — a blanket `ours` that would have discarded every upstream plan
  edit. It also cleared the `messageOrigin.ts` caveat below; the other twelve
  `ours` paths verified clean.
- AGENTS.md gained one rule: fork code says so in a comment where it sits — a
  line in a fork-only module's doc comment, a short `// Fork:` above a hunk in an
  upstream file — so a merge can see what it is holding without diffing against
  upstream.
- Docs only; no checks run.

### 2026-08-03 — AGENTS.md says it is a fork, and gets shorter

- Fork delta on an upstream-owned file. Inventory row: _Agent instructions_,
  path policy `decide` for `AGENTS.md` and its `CLAUDE.md` symlink.
- The file now describes the fork's target — the web client against Moatless —
  rather than upstream's product. Upstream's bundled server, pairing, T3
  Connect, Electron and native mobile are named as in-tree but not fork targets,
  and the dev-server section leads with the proxy-at-Moatless flow.
- Expect a conflict here in every merge from now on. Resolve by fact rather than
  by hunk: take what upstream added, restate it in the fork's shape.
- Docs only; no checks run.

### 2026-08-03 — a message says where it came from

- Fork delta on four upstream files. Inventory row: _Message origin_, with
  Message Origin Delta beside the Web Vite and Mobile Touch deltas.
- `ours` on `messageOrigin.ts` was unverified when this entry was written;
  the entry above verified it on 2026-08-03 — the file and its test are absent
  upstream.
- Backend `soaplabs/moatless#269`, client `#40`; they may land in either order.
- Verification: `vp run typecheck`, `vp lint --report-unused-disable-directives`
  and `vp fmt --check` clean. Tests pass on Node 22.23.2 — contracts 227,
  client-runtime 514, web 1815 — including the `promptStashStore` and
  `authBootstrap` suites that fail below. Those failures are the engine.

### 2026-08-02 — archiving a thread reaches the backend, and gets a way in

- Inventory row: _Archive in the sidebar v2 row menu_. The fork's
  `threadArchival` flag became `threadDeletion`: the backend now serves
  `thread.archive` and `thread.unarchive`, so only deletion is still hidden.
- Additive only — one `archive` item and its `case`, no bulk item, no gate.
  Convergence row watches for upstream adding its own archive entry point to
  `SidebarV2.tsx` or `thread-list-v2-items.tsx`.
- Verification: `pnpm typecheck`, `pnpm lint`, `pnpm fmt:check` clean; the same
  20 Node 25.6.0 failures noted below.

### 2026-08-02 — upstream workflows are switched off in GitHub, not renamed

- Supersedes the 2026-07-30 rename. The nine inherited workflows carry their
  upstream filenames again and are disabled in GitHub, so they are byte-identical
  to upstream and a merge has nothing to follow. Inventory row: _Upstream
  workflows switched off_; checks in §_Off-repository state_.
- A workflow upstream adds later arrives active, so this is checked after a
  merge, not before.
- `deploy.test.ts` reads `release.yml` again.

### 2026-08-02 — merged the upstream service launcher

- Upstream: `5192f777` from base `0ad91b6e` (`4` commits). No conflicts.
- Sweep: five `apps/server/src/cloud/service*.ts` additions matched the `cloud`
  filter and were accepted — systemd self-update launcher, not Clerk or T3
  Connect. Tripwire baseline after this merge: Clerk 4, session bootstrap 9,
  pairing 72 files.
- Convergence: none. `rpc.ts`, `auth.ts`, `ws.ts`, `servers.ts` and
  `vite.config.ts` untouched; no new WebSocket method.
- Verification: `pnpm typecheck` and `pnpm lint` clean. `pnpm test` fails 20
  tests in `apps/web/src/promptStashStore.test.ts` and
  `apps/web/src/authBootstrap.test.ts`, identically on the pre-merge commit —
  Node 25.6.0 against the pinned `^24.13.1`, `localStorage` and unstubbed-`fetch`
  engine differences. Do not chase these.

### 2026-08-01 — the contract can say a method is unsupported

- Inventory rows: _`UnsupportedMethodError`_ and _Unsupported-method error
  unions_. Backend half is soaplabs/moatless#236.
- The 47 entries are derived — contract WebSocket methods minus the backend's
  dispatch arms. Recompute them; never hand-edit the list.
- `apps/server` is untouched, so the whole delta is one class in `auth.ts` plus
  union entries in `rpc.ts`.
- Deliberately not extended: the `mapSessionRpcError` arm in
  `packages/client-runtime`. `server.probe` and `server.getConfig` are served.
- Also landed: `workspaceSearch` split into `workspaceSearchContents` in
  `apps/web/src/fork/features.ts`, so "Go to file" is no longer gated.

### 2026-08-01 — the fork hides surfaces it cannot serve

- Inventory rows: _Surface-gating registry_ and the gate rows beside it. It is a
  build constant in `apps/web/src/fork/features.ts` — nothing in
  `packages/contracts`, nothing declared by the backend.
- Gates are additive and never re-indent. A re-indented block is what turns a
  nearby upstream edit into a conflict, so a new gate has to keep that shape.
- Hazard: both lookup maps key off strings that live in upstream code — a route
  path and a palette action's `value` — and an unknown key defaults to _enabled_,
  so an upstream rename un-gates silently. `features.test.ts` reads the keys back
  out of the upstream sources rather than restating them.
- Cheapest hooks, each replacing several edits: `/settings`'s `beforeLoad` covers
  every gated section at once, and `rightPanelStore`'s migrate already drops
  surface kinds a build does not know.
- Not gated: Settings General, Appearance and Providers, except the
  server-backed "add provider instance" inside.

### 2026-08-01 — merged upstream to 0ad91b6e

- Upstream: `0ad91b6e` from base `6efcf3e1` (`56` commits).
- Conflicts: docs layout only. Accepted upstream's move to `docs/user/**` and
  `docs/internals/**`, kept the fork's Moatless docs, updated policy-owned paths.
- Sweep: rejected the new `apps/server/src/cli/pair.ts` and its test — pairing is
  fork-owned. Mobile wakeups, Ghostty terminal files and
  `docs/internals/connection-runtime.md` accepted as false positives.
- Verification adaptation that still stands: image-compression tests use smaller
  synthetic blobs to avoid a full-suite timeout while covering the same branches.

### 2026-07-31 — fork publishes a container image

- `docker/**` and `.github/workflows/build-moatless-t3-image.yml` are fork-only:
  Moatless deploys the web UI from its Helm chart, upstream ships `apps/web` to
  Vercel.
- Runner rule: re-enabled workflows must use `staging-runners-large`. GitHub
  hosted labels do not start in this fork.
- Image boundaries: no nginx proxy, no runtime backend URL. The single-origin
  client derives HTTP and WebSocket origins from `window.location.origin`, and
  the image only builds with a non-empty `MOATLESS_BASE_URL`.

### 2026-07-31 — started tracking fork inventory

- Conflict ownership alone did not remember every deliberate fork delta, so the
  inventory exists. Rule: any change that grows the fork delta updates the
  inventory in the same commit.

### 2026-07-30 — auth is fork-owned

- Moatless cookie session and `/login` own auth; the T3 backend path is
  unsupported. Device pairing, Clerk and T3 Connect are decided out but not yet
  removed. Electron stays in tree and is not a compliance target.
- Still stale: `.agents/skills/test-t3-app/SKILL.md` assumes the bundled T3
  server and one-time pairing URLs.

### 2026-07-30 — disabled upstream workflows

- Superseded by 2026-08-02. The `*.yml.disabled` rename is gone; the files carry
  upstream names and are switched off in GitHub instead.

### 2026-07-30 — merged upstream to v0.0.31

- Upstream: `6efcf3e1` from base `5719e8ac` (`81` commits).
- Conflict: `apps/web/vite.config.ts`. Took upstream single-origin dev and
  re-applied only Web Vite Delta.
- Dropped as superseded upstream: `T3CODE_HMR_HOST` / `dev-runner` plumbing and
  the separate `/attachments` proxy.
- Late sweep found auth/relay-owned surfaces including
  `apps/web/src/components/clerk/authRedirect.ts`; accepted temporarily because
  those surfaces are already decided out and will be removed as a group.
