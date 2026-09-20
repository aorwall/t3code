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

### 2026-09-20 — merged upstream to 7445aa733, a merge with no conflicts at all

- Upstream: `7445aa733` from base `5378f87f9` (`21` commits).
- Landed: `154` files from `git diff --stat HEAD^1 HEAD` against `154` in the
  upstream range (`5378f87f9..HEAD^2`); fork delta `776` files from
  `git diff --stat HEAD^2 HEAD`. No gap — `merge-stats.mjs` reports an exact
  match, nothing landed that upstream did not change and nothing was dropped.
- Conflicts: none. `preflight.mjs` forecast 0 conflicts and 8 files touched by
  both sides; `git merge` stopped on nothing. All 8 auto-merged files were
  checked by hand against both parents and each carries upstream's change intact
  beside its fork delta — the two `decide` paths
  (`apps/web/src/components/preview/PreviewView.tsx` and its test) took #12636's
  synchronous `capturePreviewAnnotationScreenshot`, which does not touch the
  `FEATURES.browserHistory` gate.
- Sweep: no keyword hits on new upstream files, no new upstream workflows, no
  modify/delete conflicts, no stale inventory entries.
- Lockfile: upstream changed three manifests (`apps/mobile/package.json`,
  `packages/shared/package.json`, `pnpm-workspace.yaml`) and did not touch
  `pnpm-lock.yaml`. Re-derived it per step 5 anyway; the install produced no
  change, so the committed lockfile is already the one those manifests resolve
  to. `verify.mjs --only lockfile` agrees.
- Contracts: `unsupported-methods.mjs` reports ADD 0 and DROP 0, so no union
  entry in `packages/contracts/src/rpc.ts` changed. The 5 known exceptions and
  the 2 conditional KEEP arms are unchanged.
- Verification: `verify.mjs` — all 10 checks pass. The `t3` test package failed
  under load and passed in isolation; not a merge regression.
- Found and not done: four upstream server behaviours worth reproducing, under
  [Runtime fixes upstream made to its own server](./gaps.md) in the 2026-09-20
  group.

### 2026-09-19 — merged upstream to 5378f87f9, where upstream rebuilt the fork's client tracer under its own name and a fork delta retired into it

- Upstream: `5378f87f9` from base `994654198` (`51` commits).
- Landed: `4232` files from `git diff --stat HEAD^1 HEAD` against `4233` in the
  upstream range (`994654198..HEAD^2`); fork delta `777` files from
  `git diff --stat HEAD^2 HEAD`. The gap of 1 is `apps/server/src/cli/pair.ts`,
  the modify/delete below. The landed count is the whole tree because the range
  includes `d547e3b12` / `e3c85ead6`, the Effect rc.115 and Alchemy beta.78
  upgrades and their reference sync.
- Conflicts: 5 files, each resolved with the verdict `preflight.mjs` printed.
  - `apps/web/src/lib/runtime.ts` (unlisted) — resolved `theirs`, as a
    convergence. #12332 reimplemented the fork's `ClientTracingLive` upstream as
    `observability/clientTracer.ts`, identical in behaviour, and in the same
    change removed the `activeDelegate` binding the fork's layer read. The fork
    block auto-merged into `observability/clientTracing.ts` referencing a symbol
    that no longer exists — the "neither side wrote this" failure, caught by
    typecheck rather than by any merge rule. Deleted the fork layer and took
    upstream's side of all three hunks; both files are now byte-identical to
    upstream and the `clientTracing.ts` delta is gone.
  - `.agents/skills/test-t3-app/SKILL.md` and `.agents/skills/test-t3-mobile/SKILL.md`
    (`converged — upstream-test-skills`): #12414 rewrote the first around the
    desktop Browser panel. Took both upstream whole and re-applied the scope
    notes under the headings, which is all these entries ask for.
  - `apps/server/src/cli/pair.ts` (unlisted, modify/delete): `git rm -f` — it is
    in `deletedUpstreamPaths`, and #12493 only touched it to add a config field.
  - `pnpm-lock.yaml` (`theirs — lockfile`): `--theirs` then `install.mjs`, which
    put the fork's `moatless-api` and `mermaid` edges back (+1490 lines).
- Unlisted and auto-merged, decided rather than accepted: `apps/server/src/bin.ts`
  merged correctly — the two `pairCommand` lines stayed absent — but it had no
  inventory entry, so deleting `cli/pair.ts` and keeping this file's references
  to it was one build failure away with nothing to catch it. Added
  `server-cli-entrypoint` (`converged`) in the same merge.
- Sweep: 5 new upstream files matched the concern patterns, all relay or CI
  infrastructure this fork does not deploy — `.github/scripts/relay-state-output.test.cjs`,
  the two `infra/relay/migrations/postgres/20260918175607_long_thread_ids/` files,
  and `infra/relay/src/clientConfig{,.test}.ts` (#12401, #12484, #12519). Taken
  as `theirs`, no inventory entry.
- Stale inventory found by verification, not by preflight: `tripwires` reported
  `.github/workflows/typecheck.yml` as an inherited workflow active again. It is
  fork-authored and deliberately on — `offRepo.allowedActiveWorkflows` was never
  updated when it landed. Confirmed against
  `repos/soaplabs/t3code/actions/workflows` (4 active, exactly the allowlist plus
  this one) and added it to the entry.
- Also fixed: #9917 deleted `SidebarGroupLabel` from `components/ui/sidebar.tsx`
  and the fork's `SettingsSidebarNav.tsx` was its only caller, which failed both
  typecheck and build. Inlined the label locally rather than re-exporting it from
  an upstream-owned file, which would conflict on every merge.
- Contract drift: `unsupported-methods.mjs` reported ADD 0 / DROP 0. Nothing in
  `packages/contracts/src/rpc.ts` changed.
- Verification: `verify.mjs` all 10 checks green on the final full pass, tests
  included (334 files, 5144 tests). Tripwires: Clerk 4, pairing 96, session
  bootstrap 8, 5 known deletions, 4 active workflows. Nine upstream server fixes
  from this range are in [the gaps register](./gaps.md) under _Runtime fixes
  upstream made to its own server_.

### 2026-09-18 — merged upstream to 994654198, a quiet merge whose only judgement call was that a new settings page needed no fork gate

- Upstream: `994654198` from base `6d1d549441` (`50` commits).
- Landed: `304` files from `git diff --stat HEAD^1 HEAD` against `303` in the
  upstream range (`6d1d549441..HEAD^2`); fork delta `777` files from
  `git diff --stat HEAD^2 HEAD`. The gap of 1 is `inventory.json`. Everything in
  the range landed.
- Conflicts: 6 files, each resolved with the verdict `preflight.mjs` printed.
  Five were one hunk each; none needed a verdict reconsidered.
  - `apps/web/src/components/ChatView.tsx`
    (`converged — thread-fork-upstream-files`): #12306 added
    `activeWorktreePath !== null` to the "Revert files too" button, on the same
    line the fork gates with `FEATURES.checkpointFileRestore`. Kept both as a
    conjunction rather than choosing a side — the upstream condition is about a
    shared workspace and the fork's is about what Moatless serves, and they are
    not the same question.
  - `apps/web/src/components/BranchToolbar.tsx`
    (`converged — branch-toolbar-gates`): took upstream's
    `canUsePreviousWorktree` including its new `!forceNewWorktree` conjunct and
    re-substituted `showWorkspaceControls`. Checked upstream's own uses of
    `showGitControls` against the fork's — ten each, same shape, so #12179 added
    no new place the picker needed gating.
  - `apps/web/src/components/files/FilePreviewPanel.tsx`
    (`decide — file-preview-panel`): #10909 restructured the read — it now runs
    for media and PDFs too, so a folder is knowable as a folder — and added
    `isDirectory` / `previewPath`. Took that whole and re-stated the
    `onRetargetFile` effect between the read and the new derivation. The
    `frameRevision` half of the entry was not in the conflict and was checked
    separately.
  - `apps/web/src/components/settings/SettingsSidebarNav.tsx`
    (`converged — settings-surface-gates`) and
    `apps/web/src/hooks/useThreadActions.ts`
    (`converged — thread-visibility-upstream-files`): both sides added an import
    to the same list. Kept both.
  - `apps/web/src/routeTree.gen.ts` (unlisted): regenerated with
    `regen-route-tree.mjs`, not hand-resolved.
- Sweep: the three new `apps/mobile/src/features/connection/` files
  (`ConnectionFormField`, `ConnectionTraceId`, `LocalEnvironmentList`) matched
  the concern pattern and are false positives — all three are upstream
  extracting shared mobile components out of files it already owned (#12364,
  #12371, #12365), with no fork delta in any of them. Taken as `theirs`, no
  inventory entry added.
- Judgement call worth knowing about: #11598's new `/settings/storage` page is
  deliberately **not** in `FEATURE_BY_SETTINGS_PATH`. It self-gates on two new
  capability booleans Moatless does not report and renders a
  `SettingsScopeNotice`, so a flag would duplicate a decision the wire already
  makes and would have to be deleted again later. Reasoning is in
  [the gaps register](./gaps.md) under _Capabilities are reported_.
- Contract drift: `unsupported-methods.mjs` reported ADD 0 / DROP 0. The two new
  methods in the range (`pullRequests.filesViewed`, `setFilesViewed`, #7721)
  declare `PullRequestRpcError` and so arrived already refusing. The
  `orchestration-decode-boilerplate` duplicate-add exception went stale — the
  colliding line is gone — and was deleted from `inventory.json` in this merge.
- Verification: `verify.mjs` all 9 checks green on the first full pass, tests
  included (333 files, 5071 tests). No flaky retries, no caveats. `vp i` needed
  `NODE_OPTIONS=--max-old-space-size=6144` to get past an OOM on this pod.

### 2026-09-17 — merged upstream to 6d1d54944, upstream moved the thread route's whole body into a component and three fork deltas moved with it

- Upstream: `6d1d549441` from base `0bf2d6b010` (`50` commits).
- Landed: `410` files from `git diff --stat HEAD^1 HEAD` against `407` in the
  upstream range (`0bf2d6b010..HEAD^2`); fork delta `777` files from
  `git diff --stat HEAD^2 HEAD`. The gap of 3 is this file, `gaps.md` and
  `inventory.json`. Everything in the range landed.
- Conflicts: 8 files, each resolved with the verdict `preflight.mjs` printed.
  - **`apps/web/src/routes/_chat.$environmentId.$threadId.tsx` (unlisted) —
    upstream deleted the file's contents out from under three fork deltas.**
    #12015 moved the entire route body into a new upstream file,
    `apps/web/src/components/ThreadRouteView.tsx`, rendered by the `_chat`
    layout so a draft's promotion keeps the same `ChatView` mounted; the route
    file is now a seven-line stub. Took the stub whole and moved
    `useAdoptedThread`, `useAutoFollowThread` and the
    `serverThreadAwaitingFirstAnswer` argument into `ThreadRouteView.tsx`,
    reading `target.kind === "server" ? target.threadRef : null` — a draft's
    reserved ref is the viewer's own work and the listing carries it without
    being asked. Re-pointed the `unlisted-thread-adoption` and `thread-follow`
    inventory entries (paths, guard and both `mustSurvive` texts) at the new
    file. **The fork's own delta guard is what caught this**: with the entries
    still naming the route file, `features.test.ts` failed on
    `useAutoFollowThread` missing from a file that is now a stub. Nothing else
    would have — the merge was clean, typecheck was green, and the route would
    simply have stopped adopting.
  - `apps/web/src/components/chat/MessagesTimeline.tsx`
    (`converged — message-origin-upstream-files`, 4 hunks): kept `GitForkIcon`
    and dropped upstream's now-unused `GitPullRequestIcon` import, and merged
    both sides of `TimelineRowActivityState`, its `useMemo` body and its
    dependency array rather than choosing a side.
  - `apps/web/src/components/ThreadStatusIndicators.tsx`
    (`converged — thread-status-indicators`): fork's
    `visibleThreadPullRequests` memo above upstream's new
    `resolveThreadPullRequestBadgePresentation` early return — hooks first, so
    the memo cannot end up after a conditional `return null`.
  - `apps/web/src/components/settings/ProviderInstanceCard.tsx` (unlisted,
    inside `moatless-provider-auth`, so `decide, then add an entry`): kept the
    `FEATURES.providerConfiguration` ternary with upstream's new container-query
    classNames inside it. Now listed as `provider-settings-gates`.
  - `apps/web/src/components/settings/SettingsPanels.tsx`
    (`converged — settings-surface-gates`): upstream rewrote the
    `proactive-panels` description's semantics; re-stated the fork's browser
    clause onto upstream's new text rather than keeping the old sentence.
  - `BranchToolbar.tsx` (`branch-toolbar-gates`) and `RightPanelTabs.tsx`
    (`right-panel-surfaces`): import blocks only, both sides kept.
  - `pnpm-lock.yaml` (`theirs — lockfile`): `git checkout --theirs` then `vp i`,
    and **the re-derived lockfile is committed**. See the caveat below.
- Sweep: no upstream addition hit an owned-surface keyword, and no workflow was
  added, changed or renamed. No route file was added, deleted or renamed
  upstream either, so `regen-route-tree.mjs` correctly skipped — #12015 moved
  code out of a route, not the route itself.
- **`resolution-check` listed eight unlisted paths both sides changed; seven
  carried a real fork delta and are now listed.** Five new `pathPolicy` entries
  — `command-palette-gates` (the `paletteActionEnabled` filter at the
  `buildRootGroups` handoff), `diff-panel-gates` (`FEATURES.turnDiffs` around
  the turn menu, `FEATURES.openInEditor` as an early return),
  `provider-settings-gates` (both provider files),
  `chat-layout-route` (`/pair` → `/login` with a remembered return-to) and
  `client-runtime-exports` (six fork subpath exports, where a lost entry is a
  build-time resolve failure) — plus `rightPanelStore.test.ts` added to
  `right-panel-surfaces`. The eighth, the thread route stub, resolved to
  upstream byte for byte, so the `theirs` fallback is already correct for it.
- Unsupported methods: ADD 0, DROP 0, so `rpc.ts` and `auth.ts` are untouched.
  Upstream added no WebSocket method in this range — the new work rides existing
  payloads (`review.getDiffPreview` gained an optional `file` input and a `files`
  stat array, `orchestration` gained a `reasoning` message role with
  `thread.message.reasoning.*` commands behind a `reasoningMessages` opt-in).
  `KEEP 2` and the five known exceptions are unchanged.
- Six backend behaviours were recorded in [gaps.md](./gaps.md): four under
  _Runtime fixes upstream made to its own server_ — large sparse checkouts on
  the fast checkpoint path (#12154), flushing checkpoint objects and refs before
  publishing (#10944), keeping a ready checkpoint when a later placeholder
  arrives (#8432), and keeping VCS waits off turn completion (#11970) — and two
  under _Settlement rules Moatless owns_: settling on the pull-request event
  rather than the next sweep (#12161), and recording a cancelled setup's
  settlement before rollback (#12176). #12017 and #12033 are device-hub only,
  which Moatless does not run at all, so neither was recorded.
- Also in gaps.md: upstream #12175 makes every keybinding command a searchable
  settings row pointing at `/settings/keybindings`, a page `serverAdministration`
  gates out of the sidebar and redirects on a typed URL. The rows still match in
  settings search. Left as-is — the same shape as the six `snap-shot-*` rows —
  and the one-line fix that closes both is noted there, to be made outside a
  merge.
- Verification: all 9 `verify.mjs` checks pass, tests in all 15 packages. Two
  findings on the way, and one caveat:
  - `typecheck`: `TS2552: Cannot find name 'label'` in
    `ThreadStatusIndicators.tsx`. #11104/#11180 hoisted `label` onto the
    presentation object; the fork's multi-link popover branch still read the
    removed local. One-word fix to `presentation.label`. **Grep the typecheck log
    for `: error TS`** — it is otherwise dominated by TS suggestions.
  - The two web test failures were this and the delta guard above, nothing else.
  - **`vp i` needs a raised heap in this sandbox.** It dies with
    `Ineffective mark-compacts near heap limit` at ~2 GB, because the cgroup caps
    memory at 12 GB while `free` reports the host's 15 GB and Node sizes its
    default heap from the host. Run it as
    `NODE_OPTIONS=--max-old-space-size=6144 vp i`.
  - **`--force-with-lease` does not work as SKILL.md documents it here.** The
    bare form fails `(stale info)` even after
    `git fetch origin "+refs/heads/$b:refs/remotes/origin/$b"`, because
    `remote.origin.fetch` is only `+refs/heads/main:…` so the branch has no
    lease-eligible tracking ref. Read the remote SHA with `git ls-remote origin
"refs/heads/$b"` and pass it explicitly as
    `--force-with-lease="refs/heads/$b:$sha"` — read, never guessed.

### 2026-09-16 — merged upstream to 0bf2d6b01, upstream's new icon variant broke a fork-only page that borrows upstream's picker

- Upstream: `0bf2d6b01` from base `5623089ae` (`45` commits).
- Landed: `255` files from `git diff --stat HEAD^1 HEAD` against `251` in the
  upstream range (`5623089ae..HEAD^2`); fork delta `776` files from
  `git diff --stat HEAD^2 HEAD`. The gap of 4 reconciles exactly: five
  landed-not-in-range — `gaps.md`, `inventory.json`, this entry, and the two
  fork-only files the typecheck fix below touched — against one
  in-range-not-landed, `SidebarChrome.tsx`, whose conflict resolved to the fork
  side byte for byte, so it shows no change against `HEAD^1`. Nothing else in
  the range failed to land.
- Conflicts: 4 files, each resolved with the verdict `preflight.mjs` printed.
  - `AGENTS.md` (`decide` — `agent-instructions`): fork's rewrite kept whole,
    and upstream's one new sentence folded into the bullet it belongs to — an
    authorized mobile pass now builds a missing native client with
    `scripts/mobile-native-client.ts` rather than stopping.
  - `apps/web/src/state/threads.ts` (unlisted, inside a fork-owned concern, so
    the fallback is `decide, then add an entry`): **upstream moved where the
    snapshot enters, so the fork's graft had to move with it.** #8309 gave
    `createThreadEnvironmentAtoms` a snapshot argument (upstream passes
    `environmentSnapshotAtom`) to preserve cached turns and older-page loading.
    The fork's `adoptedEnvironmentSnapshotAtom` was grafted one layer down, on
    `createEnvironmentThreadShellAtoms`. Kept upstream's structure and moved the
    graft up to the new argument, then pointed the shells at
    `threadEnvironment.snapshotAtom`. Grafting in the old place would have left
    the optimistic lifecycle reading the unadopted listing, so an adopted thread
    would have lost it.
  - `apps/web/src/components/settings/ProjectSettingsPanel.tsx` (unlisted,
    same fallback): additive delta re-applied on upstream's rewrite of the icon
    row — took upstream's `monogram` description arm and its new required
    `projectName` prop, kept the `workspaceSettings` flag read and the Workspace
    sections.
  - `apps/web/src/components/sidebar/SidebarChrome.tsx` (`decide` —
    `sidebar-brand`): upstream reintroduced `T3Wordmark` in the brand; the
    fork's single `APP_BASE_NAME` span stands. The resolution is byte-identical
    to `HEAD^1`.
- `resolution-check` also flags `SidebarChrome.tsx` as landed unchanged from the
  fork's pre-merge copy while upstream changed it. That is the decision, not a
  lost merge — see the conflict above.
- **`pathPolicy` had a hole and this merge closed it.** `resolution-check`
  listed seven paths both sides changed with no policy entry, and every one of
  them turned out to carry a real fork delta — so next merge's fallback would
  have been `theirs` and silently dropped it. All seven are now listed, four by
  extending the entry that already owned the behaviour and three as new entries:
  - `thread-adoption-graft` (`apps/web/src/state/threads.ts`) and
    `project-settings-panel` — the two that conflicted here. The first is worth
    reading before touching `threads.ts` again: it says the graft belongs at the
    **outermost** seam upstream feeds the snapshot through, which is the thing
    #8309 moved.
  - `branch-toolbar-gates` — `BranchToolbar.tsx` and
    `BranchToolbarBranchSelector.tsx`, where `showWorkspaceControls` stands in
    for upstream's `showGitControls` at six uses.
  - `git-vcs-driver-core-test` — **the fork's only delta in `apps/server`
    outside `auth.ts` and `rpc.ts`**, and it was unrecorded. The previous merge
    rewrote upstream's non-interactive-fetch case to intercept
    `ChildProcessSpawner` instead of writing an SSH wrapper to a temp dir,
    because the sandbox has neither a reliable `ssh` nor an executable temp dir.
    Nothing but this entry would have caught its loss.
  - Extended: `chat-composer-gates` (+`CompactComposerControlsMenu.tsx`, the
    same `FEATURES.accessMode` gate at the narrow width),
    `thread-fork-upstream-files` (+`MessagesTimeline.logic.ts`, the settled-turn
    rule that keeps an earlier turn forkable),
    `message-origin-upstream-files` (+`packages/contracts/src/orchestration.test.ts`),
    and `chat-markdown-mermaid` (+`apps/web/package.json`, which carries the
    fork's only two dependency lines — `mermaid` and the `@t3tools/moatless-api`
    workspace link).
- `pnpm-lock.yaml` did not conflict this time, **and that is what went wrong.**
  Git auto-merged it to upstream's copy whole, dropping both fork edges —
  `mermaid` and the `@t3tools/moatless-api` link — with no marker. Because the
  step-5 ritual only fires on a conflict, it never ran; every `vp i` afterwards
  re-derived the edges correctly and every one of those rewrites was discarded
  with `git checkout --`, on the belief that it was the spurious rewrite step 8
  warns about. Nothing here caught it: `resolution-check.mjs` exempts plain
  `theirs` paths, and the working tree installed from a re-derived lockfile so
  lint, typecheck and test were all green against a lockfile that was not
  committed. The image build on `main` failed after this PR merged; fixed in a
  follow-up, which also added the `lockfile` step to `verify.mjs` and rewrote
  the `lockfile` inventory note that claimed it "conflicts on every merge".
  **Re-derive and commit the lockfile on every upstream merge, conflict or not.**
- Sweep: 2 of 27 upstream additions hit the pattern, plus one rename. Both
  additions — `packages/client-runtime/src/connection/compatibility.ts` and its
  test — are upstream's own protocol-version check, extracted whole by #11990
  into a directory where fork deltas live but carrying none; accepted unmodified.
  The rename is `patches/@clerk__expo@4.6.6.patch` → `@4.6.8.patch` at `R100`,
  content identical, from the Clerk bump. Clerk stays decided out and compiling.
- Unsupported methods: ADD 0, DROP 0, so `rpc.ts` is untouched. 99 of 157
  WebSocket methods declare `UnsupportedMethodError` against 67 dispatched by the
  backend; `KEEP 2` (`git.preparePullRequestThread`, `vcs.switchRef`) and the
  five known exceptions in `inventory.json` are unchanged. Upstream added no
  WebSocket method in this range — the monogram work rides `project.meta.update`,
  and the follow-up queue is client-side.
- No route file was added, deleted or renamed upstream, so `regen-route-tree.mjs`
  correctly skipped.
- Eight backend behaviours worth reproducing were recorded in gaps.md under
  _Runtime fixes upstream made to its own server_: rewind surviving a
  changed-length history (#11954), checkpoint capture reusing index metadata
  (#10792), a faster fetch-and-checkout (#11633), a bounded git process pool with
  the long operations exempt (#11405), releasing a preview host after an
  unanswered request (#11381), naming the setting behind a missing provider
  executable (#11345), health checks that clean up what they unpack (#12008), and
  a GitHub quota budget with a read cache (#11888).
- Verification: `tripwires`, `resolution-check`, `unsupported-methods`,
  `fmt:check`, `lint` and `typecheck` pass; tests pass in 15 of 16 packages. One
  failure was found and fixed, and two results are caveated.
  - `typecheck`: **upstream gave an icon type a third arm and a fork-only page
    that borrows upstream's picker stopped compiling.** #11845 and #11993 added
    `monogram` to `ProjectIconOverride` and made `projectName` required on
    `ProjectIconPickerDialog`; `moatless/ProjectWorkspaceSettings.tsx` uses that
    dialog and casts its result into the Workspace API's `WorkspaceIcon`, which
    has no monogram arm. Added `workspaceIconFromOverride` in
    `moatless/workspaceDetail.ts` as the total inverse of `workspaceIconOverride`
    and passed `project.title`. **A fork-only page that borrows an upstream
    component inherits upstream's changes to that component's props and types,
    and a cast at the boundary is what turns that into a compile error instead
    of a wrong render** — the previous merge hit the mirror image, a fork field
    missing from an upstream fixture. Keep these conversions explicit functions,
    never casts. A monogram now saves as no icon; that is gaps.md,
    _Workspace icons cannot hold a monogram_.
  - Caveat, false positive: `duplicate-adds` exits 1 on
    `packages/contracts/src/orchestration.test.ts`. The fork's script-port test
    (`decodes a project.meta.update carrying a script with a port`) and
    upstream's new monogram test share two boilerplate lines —
    `const command = yield* decodeOrchestrationCommand({` and the
    `assert.strictEqual(command.type, "project.meta.update")` after it — at
    different indentation, and the script trims whitespace before comparing.
    Both tests are wanted; no edit is correct. The next merge's base moves past
    it, so this is a one-merge annoyance and not a gap.
  - Caveat, standing: `@t3tools/desktop` fails
    `scripts/browser-secret-native.test.mjs`, which shells out to `pkg-config`
    for `libsecret-1` and does not find it here. Not in the merge diff
    (`git diff HEAD^1 HEAD` on that path is empty) and 106 of its 108 suites
    pass — 1365 tests, 12 skipped. gaps.md, _The desktop suite needs libsecret_.
  - Ran sequentially by package, not as one `vp run -r test`: the sandbox is a
    12 GB cgroup and the parallel run was evicted four times. `verify.mjs` derives
    its heap from the cap and got it right at 6144 MB — this is the case
    _The full suite needs a raised heap_ already covers, not a new one.

### 2026-09-15 — merged upstream to 5623089a, upstream reverted the compact sidebar and took five fork gates' anchors with it

- Upstream: `5623089ae` from base `1bbca0e78` (`60` commits).
- Landed: `388` files from `git diff --stat HEAD^1 HEAD` against `386` in the
  upstream range (`1bbca0e78..HEAD^2`); fork delta `777` files from
  `git diff --stat HEAD^2 HEAD`. The gap reconciles exactly: three landed-not-in-range
  (`gaps.md`, `inventory.json`, this entry) and one in-range-not-landed,
  `apps/server/src/cli/pair.ts`, which the fork deletes on purpose and which
  conflicted modify/delete — resolved by keeping the deletion. Nothing else in
  the range failed to land.
- Conflicts: 14 files. `pnpm-lock.yaml` was reset to `upstream/main` and the fork
  edges re-derived by `vp i` (`@t3tools/moatless-api`, `mermaid`, `orval`).
- **The dominant shape was upstream deleting the anchor, not upstream editing
  the delta.** `d81278aa6 revert(web): remove the compact sidebar (#11685)` took
  out every `group-data-[collapsible=icon]` variant (upstream now has 0), the
  `compact` prop, the `useCompactSidebarEnabled` hook, and
  `ThreadStatusIndicators`' `iconOnly` prop and `"badge"` variant. In
  `LegacySidebar.tsx`, `Sidebar.tsx`, `SettingsSidebarNav.tsx`,
  `SidebarThreadHeader.tsx` and `ThreadStatusIndicators.tsx` the fork's side
  looked the richer one and mostly was not: most of that richness was upstream's
  own code inherited from the merge base. **Check ownership per line with
  `git show <merge-base>:<path>` before deciding one of these** — taking the
  fork side wholesale would have left `compact`, `compactSidebarEnabled` and
  `iconOnly` as undefined references, and taking upstream without reading would
  have dropped `FEATURES.projectManagement`, `ownerName`, `isBrowsing` and
  `pullRequests`. Took upstream's structure whole in all five and re-applied only
  the genuinely fork-authored deltas.
- `projectScripts.ts` / `projectScriptEditor.tsx` / `projectScripts.test.ts`
  (`project-script-port-field`): upstream's #11832 added a `waitForSetup` toggle
  mapping to `async: false`. Carried it — this is the first upstream field the
  port-only form has had to decide on, and it is orthogonal to the port. The
  fork's deletion of the preview-URL toggle survives. Added
  `projectScripts.test.ts` to the entry's `paths`; it holds the fork's
  `portFromPreviewUrl` test and was unlisted.
- `BranchToolbar.tsx` (`navigation-gates`): additive, both sides kept —
  `showWorkspaceControls` still stands in for upstream's `showGitControls`.
  `MessagesTimeline.tsx`: fork's `onForkThread` kept beside upstream's three new
  worktree-setup callbacks, in the interface, the context object and the dep
  array. `__root.tsx` (`root-route`): upstream dropped
  `pathname.startsWith("/connect/")`; the fork's `/login` guard stays.
  `useAvailableSettingsSearchItems.ts` (`settings-search-filters`): took
  upstream's `localEnvironmentDisabled`-guarded `desktopWsl`, kept the
  `moatlessFeatures` read, unioned both dep arrays.
- Sweep: upstream added 74 files; 14 land inside a fork-owned concern —
  `ProjectCloneToastCoordinator.tsx`, `state/projectClones.ts` (web and mobile),
  `ProjectCloneBanner.tsx`, `useRemoveClonedProject.ts`,
  `contracts/projectClone.ts`, `WorktreeSetupCard.tsx`,
  `contracts/worktreeSetup.ts`, `DeviceHostEditor.tsx`,
  `deviceHostConnectionChecks.ts`, `useHostConnectionChecks.ts`,
  `LocalEnvironmentSetting.tsx`, `localEnvironment.ts`,
  `T3ConnectProfilePage.tsx`. All accepted from upstream unmodified and **no new
  `FEATURES` flag was needed**: each is reached only through a gate already in
  place (`projectManagement` via `action:add-project`, `worktreeSelection` via
  the composer's send mode, `deviceHub` via `IntegrationsSettingsPanel`) or sits
  in a surface already decided out. The clone stream is doubly covered — the
  client gates it on `capabilities.projectCloneTracking`, which a Moatless
  handshake omits.
- Unsupported methods: ADD 6, DROP 0. `projectClone.start` / `.cancel` /
  `.retry`, `subscribeProjectClones`, `subscribeWorktreeSetup` and
  `worktreeSetup.cancel` gained `UnsupportedMethodError` in `rpc.ts`. 99 of 157
  WebSocket methods now declare it; re-derivation after the edit reports ADD 0 /
  DROP 0. Both families are written up in
  [gaps.md](./gaps.md) under _Methods the backend does not dispatch_.
- No route file was added, deleted or renamed upstream, so `regen-route-tree.mjs`
  correctly skipped.
- Seven backend behaviours worth reproducing were recorded in gaps.md under
  _Runtime fixes upstream made to its own server_ — thread titles from user
  intent (#10720) and their link resolution (#11844), `async: false` setup
  scripts (#11832), the setup-script color probe (#11843), the provider refresh
  on `subscribeConfig` (#11811), the terminal output send window (#11407), and
  tight-list streaming (#11833).
- Verification: `duplicate-adds`, `tripwires`, `resolution-check`,
  `unsupported-methods`, `fmt:check`, `lint` and `typecheck` pass. Two failures
  were found and fixed before the final pass:
  - `typecheck`: upstream's new `settingsSearch.test.ts` case built a
    `SettingsSearchAvailability` without the fork's required `forgejoEnabled`.
    This is the second merge running where a fork field on that type broke an
    upstream test addition — **when the fork adds a field to a shared
    availability type, expect upstream's next new fixture to miss it.**
  - `unsupported-methods` exit 1 with the ADD bucket above.
  - Caveat, standing: `@t3tools/desktop` fails
    `browser-secret-native.test.mjs` on a missing `libsecret-1`. Untouched by
    this merge and present on `HEAD^1`; `pkg-config --exists libsecret-1` fails
    in the sandbox. Recorded in gaps.md as _The desktop suite needs libsecret_.
  - `@t3tools/mobile`, `t3` and `@t3tools/web` did not finish in the parallel
    run and passed when retried alone — CPU contention, the case
    _The full suite needs a raised heap_ already covers.
- Post-merge action: `tripwires.mjs` reports two new upstream workflows,
  `desktop-macos-preview-publish.yml` and `release-desktop.yml`. Both must be
  disabled in GitHub, and **cannot be until this PR merges** — the API answers
  404 for a workflow that is not yet on the default branch.

### 2026-09-14 — merged upstream to 1bbca0e7, upstream's compact-sidebar work rewrote the rows the fork gates and a settings gate had to move onto a control upstream replaced

- Upstream: `1bbca0e78` from base `0c5771d60` (`32` commits).
- Landed: `203` files from `git diff --stat HEAD^1 HEAD` against `201` in the
  upstream range (`0c5771d60..HEAD^2`); fork delta `772` files from
  `git diff --stat HEAD^2 HEAD`. The gap is two files and reconciles exactly,
  both landed-not-in-range: `gaps.md` and `inventory.json` (this entry makes it
  three). Nothing in the range failed to land.
- Conflicts: 9 files, each taken to its inventory verdict. `pnpm-lock.yaml` was
  reset to `upstream/main` and the fork edges re-derived by `vp i` — the
  remaining diff is the `@t3tools/moatless-api` workspace link, `mermaid
^11.17.2` and the `packages/moatless-api` importer. `AGENTS.md`
  (`decide — agent-instructions`): upstream's only change in range was the
  reusable dev credential, restated into the fork's own "Against the bundled
  server" paragraph rather than taken as a block. `Sidebar.tsx`,
  `LegacySidebar.tsx`, `ui/sidebar.tsx`, `SidebarThreadHeader.tsx` and
  `ThreadStatusIndicators.tsx` are all the compact-sidebar restructure
  (#11525, #9417, #11644) against fork gates — took upstream's structure whole
  and re-applied each delta at its anchor. Four of those five were import-block
  unions or a single re-placed element.
- **A gated control was replaced, so the gate moved rather than survived.**
  #11678 deleted the `enableLegacyTokenStreaming` switch the fork gated and put a
  three-way `responseStreamingMode` select in its place. Taking upstream drops
  the gate with the row it was on, which un-hides the replacement silently —
  there is no conflict marker and no test for a surface that should not render.
  The gate went onto the new row in `SettingsPanels.tsx`. The same sweep found
  the second half: upstream also added a `response-streaming` entry to
  `settingsSearch.ts`, and a gate on a row does not reach the command palette, so
  the result would have landed on General at a hash for a control that is not
  there. Added `assistantStreamingOnly` beside the existing
  `providerConfigurationOnly` filter. New rows: `settings-surface-gates` and
  `settings-search-filters` in the inventory — **when a merge gates a settings
  row, check `settingsSearch.ts` in the same breath.**
- **`authBootstrap.test.ts` auto-merged into something neither side wrote.** No
  marker, no script catch — `resolution-check.mjs` documents this as the case it
  cannot see. Upstream's two new tests assert `status: "requires-auth"`; the fork
  renamed that gate status to `requires-login`. Only the fork's own suite caught
  it. Restated the three assertions.
- `auth.ts` (`decide — primary-auth`) took upstream's new `urlCredential`
  parameter on top of the fork's cookie-session probe. The condition that matters:
  a desktop credential is exchanged only when the server advertises
  `desktop-bootstrap`, which `MOATLESS_BROWSER_COOKIE_AUTH` never does, so a
  stale one is not sent; a URL pairing token is its own method and stays on
  upstream's path.
- Sweep: 8 owned-concern hits, all false positives — auth and pairing strings in
  upstream's own `apps/server` auth work (#8606), which the fork does not adopt
  and did not take. No file accepted from a concern-owned path.
- Unsupported methods: ADD 0, DROP 0 — `rpc.ts` needed no edit. The two new
  methods (`pullRequests.routing`, `routingIdentity`) arrived declaring
  `PullRequestRpcError`, which already carries `UnsupportedMethodError`.
- No route file was added, deleted or renamed upstream, so `regen-route-tree.mjs`
  correctly skipped.
- Verification: `tripwires`, `resolution-check`, `unsupported-methods`,
  `fmt:check`, `lint` and `typecheck` all pass. Tests pass per package — web
  `419`, mobile `319`, relay `30`. Two caveats, both standing:
  - `@t3tools/desktop` fails `browser-secret-native.test.mjs` on a missing
    `libsecret-1`. The file is untouched by this merge and `pkg-config --exists
libsecret-1` fails in the sandbox — the machine, not the code. Already
    recorded in gaps.md as _The desktop suite needs libsecret_.
  - `duplicate-adds.mjs` reports 2 false positives. `auth.ts` → `if (` is a line
    written by the `decide` resolution: it appears once in the merge and in
    neither parent, so it cannot be a kept-twice duplicate. `authBootstrap.test.ts`
    → `expect(testApi.calls.browserSession).toEqual([]);` traces to two
    genuinely distinct tests, one per parent. The script's own tell is that a real
    duplicate breaks lint, typecheck and test at once; all three are green.
  - `@t3tools/mobile` failed once under the parallel run and passed alone — CPU
    contention, not a regression.

### 2026-09-13 — merged upstream to 0c5771d6, upstream folded the sidebar's project scope into a new header component and the Moatless backend moved its dispatch again

- Upstream: `0c5771d60` from base `e81606494` (`32` commits).
- Landed: `489` files from `git diff --stat HEAD^1 HEAD` against `484` in the
  upstream range (`e81606494..HEAD^2`); fork delta `767` files from
  `git diff --stat HEAD^2 HEAD`. The gap is five named files and reconciles
  exactly, all landed-not-in-range: `apps/web/src/fork/SidebarThreadFilter.tsx`
  (fork-only, re-sized below), this entry, `inventory.json`, `gaps.md`, and
  `unsupported-methods.mjs`. Nothing in the range failed to land.
- Conflicts: 8 files. `routeTree.gen.ts` is generated — regenerated with
  `regen-route-tree.mjs` after the install, 22 insertions. `pnpm-lock.yaml`
  auto-merged again and was reset to `upstream/main` with the fork edges
  re-derived by `vp i` — the remaining diff against upstream is exactly the
  `@t3tools/moatless-api` workspace link, `mermaid ^11.17.2` and one alchemy
  peer hash. `projector.ts`, `orchestration.ts` and `threadReducer.ts` are
  `converged — message-origin-upstream-files` and were all the same conflict
  twice over: upstream added a `context` field to an orchestration message at the
  exact anchor the fork's `origin` field sits on, so both lines stay.
  `MessagesTimeline.tsx` is the same entry and the same shape — `GitForkIcon`
  beside upstream's new `GitPullRequestIcon`, and the fork's `MessageOriginIcon` /
  `MessageOriginChip` kept as sibling functions to upstream's new
  `resolvePreviewAnnotationImage`. `SettingsSidebarNav.tsx` kept the fork's
  `settingsPathEnabled` filter and took upstream's new rule — `/settings/general`
  stays active on `/settings/open-source-licenses` — into `renderNavItem`.
- **A fork gate's host file was replaced by one upstream had not written yet.**
  #11315 folded the sidebar's project scope into the search row by extracting the
  whole header into a new `apps/web/src/components/sidebar/SidebarThreadHeader.tsx`.
  `Sidebar.tsx` is `converged — thread-visibility-upstream-files` and took
  upstream whole, which left its `SidebarThreadFilter` import unused; both fork
  deltas were re-applied additively in the new file instead — the
  `FEATURES.projectManagement` gate on New project, and `<SidebarThreadFilter />`
  as a third child of upstream's segmented icon well. No props threaded, no JSX
  re-indented. The one edit outside the new file is
  `SidebarThreadFilter.tsx`'s trigger className, now `size-7` so it matches
  upstream's own `SidebarHeaderIconButton` in that well; that is the whole of the
  file-count gap above.
- **A `decide, then add an entry` obligation, paid.** `ChatComposer.tsx` was
  unlisted and carries two fork deltas — the runtime-mode picker gated on
  `FEATURES.accessMode`, and `phase === "running"` left out of
  `collapsedComposerPrimaryActionDisabled`. Both survived, and the file is now in
  `chat-surface-gates` with a guard plus a `chat-composer-gates` path policy, so
  the next merge gets a cached answer instead of the same decision.
  `file-preview-panel` was the only other `decide`: it auto-merged without a
  marker and both deltas (`frameRevision`, `onRetargetFile`) were confirmed by
  hand.
- **The stale entry was a deliberate deletion, so it needed a new entry, not a
  re-point.** `moatless-admin-pages` still listed the two Workspaces admin routes
  the 2026-09-12 move folded into the project settings page. Re-pointed to the
  five surfaces that remain, and the untracked delta the move left behind is now
  `project-workspace-settings`.
- Sweep: no keyword hits across the newly added upstream files. No concern entry
  needed.
- Unsupported methods: 0 ADD, 0 DROP, 2 KEEP (`git.preparePullRequestThread`,
  `vcs.switchRef`), 5 known exceptions still firing, no stale ones. `rpc.ts`
  unchanged. The merge's unsupported surface is upstream's Cursor `--classic`
  launcher fix (#11498), which lands on a method already refused — see
  [gaps](./gaps.md) under _Opening in an external editor_.
- **The derivation could not read the backend, and that is what a red check
  looks like when it is the script's fault.** `unsupported-methods` exited 2 with
  "could not read the backend dispatch". The Moatless backend moved its dispatch
  a second time: `crates/t3code/src/rpc/dispatch.rs` is now a 264-byte module
  stub over an `rpc/dispatch/` directory whose `routing.rs` holds the arms and
  whose siblings hold the handler bodies. `BACKEND_APIS` now names the directory
  and the script concatenates every `.rs` file in it — pointing it at
  `routing.rs` alone would have read the arms and lost the handlers, and
  `refusesInside` only follows calls it can find in the same source, so every
  conditional refusal would have come back as a false DROP.
- Verification: `verify.mjs` green on seven of eight — `duplicate-adds` (none
  across 34 files), `tripwires` (3 deleted surfaces intact, exactly the 5 known
  re-deletions, 3 allowed workflows), `resolution-check` (16 fork-delta paths
  still differ from upstream, 17 carry upstream's change, 17 theirs-verbatim
  byte-identical, 18 unlisted), `unsupported-methods`, `fmt:check`, `lint`,
  `typecheck`. `test` is red on `@t3tools/desktop` alone, confirmed failing
  alone, and it is the standing environmental one: `browser-secret-native.test.mjs`
  cannot find `libsecret-1` in this sandbox's pkg-config path — 1 file of 105,
  recorded in [gaps](./gaps.md) under _The desktop suite needs libsecret_. No
  root in the sandbox, so it cannot be installed here.
- Four packages did not finish under `vp run -r test` and were each run alone
  again, all green: `@t3tools/mobile` (165 files), `t3` (317, 2 skipped),
  `@t3tools/web` (412), `t3code-relay` (30). Read the retry lines at the end of
  the log, not the parallel output above them.
- **CI caught what no local check runs.** `Build & push moatless-t3` failed on
  the pushed merge commit: upstream's new `t3code:third-party-licenses` plugin
  (#8962) runs in `generateBundle` and refused three packages the fork's own
  `mermaid` edge bundles and upstream's config has never seen — `khroma` (no
  license field, but it ships its own `license` file, so it needed the
  declaration only), `fastdom` and `strictdom` (MIT declared, no notice file, so
  both needed a `generatedNotice`). Three `packageOverrides` entries fixed it,
  and they are now part of `mermaid-diagrams` plus a `third-party-licenses-config`
  path policy. `verify.mjs` has no build step, so it could not have caught this —
  [gaps](./gaps.md), _Nothing builds the web app before a merge is pushed_.
- The sandbox was evicted mid-verification and `node_modules` went with it. The
  merge commit survived because it had already been pushed, which is the whole
  argument for step 8's ordering. The `origin/merge/upstream-2026-09-13`
  tracking ref did **not** survive the restore — `git fetch origin
merge/upstream-2026-09-13` and reading `FETCH_HEAD` is how to confirm the
  branch is still on the remote after one of these.

### 2026-09-12 — merged upstream to e8160649, upstream made every server setting scopable and settings is now most of the fork delta

- Upstream: `e81606494` from base `02297e3db` (`47` commits).
- Landed: `277` files from `git diff --stat HEAD^1 HEAD` against `275` in the
  upstream range (`02297e3db..HEAD^2`); fork delta `756` files from
  `git diff --stat HEAD^2 HEAD`. The gap is three named files and reconciles
  exactly. Three landed that are not in the range — this entry, `inventory.json`
  and `gaps.md`. One in the range did not land: `settings.integrations.tsx`, kept
  as ours per `moatless-admin-integrations-route`, which is the standing add/add
  collision and not a lost merge. `resolution-check.mjs` flags it every merge for
  exactly that reason; the flag is the decision.
- Conflicts: 15 files, `pnpm-lock.yaml` auto-merged again (reset to
  `upstream/main`, fork edges re-derived with `vp i`). Eleven of the fifteen are
  settings files, all from one upstream change — #11176 put a
  `projectSettingsOverrides` record on `ServerSettings` and #10639 rebuilt the
  whole settings UI around a scope (`SettingsScopeContext`, `ScopedSwitch`,
  `settingKeys`, `onResetOverride`, `mixed`). Taken whole with the fork's gates
  re-stated on upstream's rewritten rows: `SettingsPanels.tsx`
  (`FEATURES.assistantStreaming` around the legacy-token-streaming row,
  `FEATURES.projectManagement` around add-project-starts-in),
  `SettingsSidebarNav.tsx` (personal-group filter over upstream's `navItems`),
  `useAvailableSettingsSearchItems.ts` (the Forgejo read kept, the dependency
  array rebuilt — the fork's copy referenced `primaryServerConfig` and
  `primaryEnvironmentId`, which upstream deleted, so carrying it verbatim would
  not have compiled). `orchestration.ts`, `threadReducer.ts`, `ChatView.tsx` and
  `MessagesTimeline.tsx` are `converged` and kept both sides: the rewind command
  beside the fork's two, upstream's perf rewrite of `applyMessageUpdate` with the
  `origin` preservation re-added, the fork's fork-thread handlers moved inside
  upstream's existing paint-only conditional spread rather than beside it, and
  upstream's `RevertUserMessageButton` beside the fork's origin chip.
  `PreviewView.tsx` and `ThreadPreviewMiniPlayer.tsx` are `decide`: upstream's
  only real change to the first was the `miniPlayer?.tabId` → `miniPlayerTabId`
  rename, so the fork block was kept with the rename applied; the second took
  upstream's new `MiniPlayerShell` and moved both fork deltas onto its
  `pillActions` / `visible` / `children(frame)` props.
- **A conflict list does not show you a cross-file consequence.** Upstream moved
  the `agent-browser-access` row off `/settings/projects` and onto the
  embedded-surface panel, which the fork serves at `/settings/browser`, not
  upstream's `/settings/integrations` (that path is the fork's Moatless admin
  page). Nothing conflicted on the destination; the row would simply have pointed
  at an anchor that is not there. Redirect added in `settingsSearch.ts` with the
  reason inline, and the `settingsSearch.test.ts` assertion follows it.
- **A fork delta moved upstream, so its inventory anchor was stale.** Upstream
  extracted the Actions section out of `ProjectSettingsPanel.tsx` into a new
  `ProjectActionsSettings.tsx`, which left `ProjectSettingsPanel.tsx`
  byte-identical to upstream and `project-script-editing-capability`'s
  `guard.files` pointing at a file that no longer contains `scriptsEditable`.
  Re-pointed, and the `portFromPreviewUrl` import for t3.json script imports went
  with it. `project-script-port-field`, `navigation-gates` (the
  `FEATURES.projectManagement` New-project gate, which upstream grew a fourth
  site for in `DraftHeroHeadline.tsx`) and `moatless-version-control-page` (whose
  prose already named `useAvailableSettingsSearchItems.ts` without listing it)
  gained paths too. `inventory-check.mjs` is clean.
- **The silent auto-merge happened again, and again only a fork test caught it.**
  #11285 turned the mini-player's target from a tab id into a source union
  (`{ kind: "browser", tabId }`). `PreviewView.tsx` conflicted and took the new
  shape; `PreviewView.test.tsx` auto-merged, so upstream's own assertion was
  updated and the fork-only "under the frame capability" case a few hundred lines
  down still asserted the string. No marker, no type error — `vi.fn()` takes
  anything. Assertion updated to the union.
- Sweep: no keyword hits across the newly added upstream files. No concern entry
  needed.
- Unsupported methods: 0 ADD, 0 DROP, 2 KEEP (`git.preparePullRequestThread`,
  `vcs.switchRef`), 4 known exceptions still firing. `rpc.ts` unchanged — the
  merge's new surface is a command inside `orchestration.dispatchCommand` and a
  settings key, neither of which is a method that can be refused. Both are in
  [gaps](./gaps.md), under _A command cannot be refused_ and _Editing server
  settings_; the capability half is under _Capabilities are reported_, and it is
  the one worth reading — a project-scope settings write on Moatless is now a
  silent no-op rather than a refusal.
- Verification: `verify.mjs` green on seven of eight — `duplicate-adds` (none
  across 32 files), `tripwires` (3 deleted surfaces intact, exactly the 5 known
  re-deletions, 3 allowed workflows), `resolution-check` (18 fork-delta paths
  still differ from upstream, 17 theirs-verbatim byte-identical, the one explained
  flag above), `unsupported-methods`, `fmt:check`, `lint`, `typecheck`. `test` is
  red on `@t3tools/desktop` alone, confirmed failing alone, and it is the standing
  environmental one: `browser-secret-native.test.mjs` cannot find `libsecret-1` in
  this sandbox's pkg-config path — 1 file of 105, recorded in
  [gaps](./gaps.md) under _The desktop suite needs libsecret_.
- Four packages did not finish under `vp run -r test` and were each run alone
  again; `@t3tools/web` was genuinely red on the first pass (the mini-player
  assertion above) and is green on the re-run. Read the retry lines at the end of
  the log, not the parallel output above them.

### 2026-09-11 — merged upstream to 02297e3d, upstream shipped a simulator hub and restructured the surface launcher

- Upstream: `02297e3db` from base `0f602b337` (`35` commits).
- Landed: `170` files from `git diff --stat HEAD^1 HEAD` against `166` in the
  upstream range (`0f602b337..HEAD^2`); fork delta `756` files from
  `git diff --stat HEAD^2 HEAD`. The gap is six named files and reconciles
  exactly. Five landed that are not in the range: `ThreadStatusIndicators.test.tsx`
  and `sandboxControl.placement.test.tsx`, the two fork-test fixes amended into
  the merge commit and described below, plus these three fork documents. One in
  the range did not land: `PreviewLocalServerCard.tsx`, re-deleted per
  `deletedUpstreamPaths`.
- Conflicts: 11 files. Additive on both sides, kept whole — `MessagesTimeline.tsx`
  (import block), `client-runtime/src/rpc/client.ts` (the fork's four
  subscription tags against upstream's `subscribeDeviceState`),
  `rightPanelStore.ts` (the fork's `sandbox` kind against upstream's `device`),
  `rpc.ts` and `RpcAuthorization.ts` (the fork's thread-server/sandbox/subtasks
  methods and scopes against upstream's eight `device.*` methods),
  `ChatView.tsx` (both right-panel arms, both `onAdd*` props at the inline and
  sheet call sites, and upstream's extended `closePreviewPanel` under the fork's
  proactive preview-open effect). `PreviewEmptyState.tsx` and
  `ThreadPreviewMiniPlayer.tsx` took upstream's `DiscoveryList` and
  `rounded-[inherit]` with the fork's sandbox-read error line and framed
  `hasPreviewSurface` condition re-stated on top. `pnpm-lock.yaml` auto-merged,
  so `--theirs` had nothing to do; reset it to `upstream/main` and re-derived the
  fork edges with `vp i`.
- **A `converged` delta can lose the line it was anchored to.** #11111 rebuilt
  the right panel's add-surface menu from a card grid into compact rows, and the
  fork's sandbox badge in `RightPanelTabs.tsx` (7 conflicts, the hard one) had no
  literal home left. Re-stated on upstream's row rather than replayed: the badge
  renders between the label and the `Kbd`, additively, with no prop threaded and
  no upstream JSX re-indented. `sandboxControl.placement.test.tsx` is what makes
  that checkable and it caught the second half — upstream's rows stopped
  rendering the action `description` at all (in its own Device action too), so
  the test's assertion on the sandbox description was asserting on markup nobody
  emits. Now asserts the rendered label. New inventory row `right-panel-surfaces`.
- **The silent auto-merge this workflow exists for happened, and only the fork's
  own test caught it.** No conflict marker, no type error, no
  `resolution-check.mjs` hit: #11104 and #11180 changed what the multi-PR badge
  counts — the total linked, not the extras beside a named primary — and hoisted
  `state` onto both `ThreadPullRequestBadge` shapes with a new `draft` color.
  `ThreadStatusIndicators.test.tsx` failed on `+1` against `+2`. Fixture gained
  the now-required `state`, expectation updated to upstream's semantics. New
  inventory row `thread-status-indicators` says to re-read the badge before
  touching that assertion again.
- Sweep: 11 keyword hits, all false positives. Ten are upstream's new device-hub
  files matching the `client-identity` concern on `host`/`proxy`
  (`DeviceHost.ts`, `LocalDeviceHost.ts`, `SshDeviceHost.ts`, `DeviceHubProxy.ts`
  and siblings) — that concern is about **device pairing identity**, not
  simulators, so they are inherited in tree and adopted by nothing. The
  eleventh, `McpProviderSession.test.ts`, matched on `session`. No concern entry.
  The device hub's real record is a gaps entry, not a sweep hit.
- Unsupported methods: 9 ADD, 0 DROP after the edit. Upstream's eight `device.*`
  methods plus the `subscribeDeviceState` stream are dispatched by no Moatless
  backend, so each gained `UnsupportedMethodError`; re-derivation reports
  0 ADD / 0 DROP. What a person loses is in [gaps](./gaps.md) under _The device
  hub_, including the `FEATURES.deviceHub` gate this merge did **not** add — the
  Device row is offered on every thread and leads to a setup dialog whose first
  step resolves to the refusal.
- Four unlisted paths this merge decided now have rows:
  `right-panel-surfaces`, `client-runtime-rpc-client`, `thread-status-indicators`
  and `fork-sandbox-components`. `inventory-check.mjs` is clean.
- Verification: `verify.mjs` green on seven of eight — `duplicate-adds`,
  `tripwires`, `resolution-check`, `unsupported-methods`, `fmt:check`, `lint`,
  `typecheck`. `test` is red on `@t3tools/desktop` alone, confirmed failing alone
  rather than machine noise, and it is the standing environmental one:
  `scripts/browser-secret-native.test.mjs > bundled libsecret helper` cannot find
  `libsecret-1` in this sandbox's pkg-config path. 1 file failed of 102;
  [gaps](./gaps.md) records it under _The desktop suite needs libsecret_.
- **Four packages did not finish under `vp run -r test` and were each run alone**
  — mobile `157` files, `t3` `315`, web `389`, relay `30`, all passing. Worth
  writing down because the truncated parallel pass reported a failure that does
  not exist: in `shikiReviewHighlighter.test.ts`, the case that highlights source
  and snippet without a warmup fails on a loaded box and passes in the alone run,
  and neither side of this merge touches that file or its subject. Read the
  retry lines at the end of the log, not the parallel output above them.

### 2026-09-10 — fork change: the composer badge lists a Task's pull requests

- Not a merge. It follows the entry below, and the fork delta for pull requests
  is now two: the `mergeEnvironmentThread` line, and this badge.
- `ThreadPullRequestBadgeControl` opens a popover with more than one link and no
  stack, holding `ThreadPullRequestsMiniList` — the list a sidebar row already
  hovers — where each row links to its own pull request. Upstream's badge is an
  anchor to the primary, so the `+N` had nothing behind it. The label is
  unchanged.
- Untouched: the sidebar badge, and the stack badge on both surfaces. A stack
  still opens the `pull-requests` panel. Moatless rarely produces one, because a
  Task's pull requests seldom share a base — see [the inventory](./inventory.json)
  row `task-bound-pull-request`.
- Verification: `pnpm lint` and `pnpm fmt:check` pass. `@t3tools/web#typecheck`
  passes and its `ThreadStatusIndicators` suite passes, 10 tests.

### 2026-09-10 — fork change: the backend serves upstream's multi-PR threads

- Not a merge. The Moatless half landed with it: `thread.pullRequests` is filled
  from the Task's GitHub bindings, `threadPullRequests` is reported, and
  `thread.pull-request.link` / `.unlink` are dispatched onto those bindings.
- **The capability and the deletions are one commit, on purpose.** With the flag
  reported and the fork branches still in the tree, a sidebar row renders both
  counts and every fork menu row resolves to no status:
  `ForkPullRequestMenuItem` called `useLinkedThreadPullRequest` with two
  arguments, and the fork branches in `Sidebar.tsx` and `GitActionsControl.tsx`
  read no capability at all. Splitting the change ships that state.
- Deleted: `apps/web/src/fork/threadPullRequest.ts` and its test,
  `apps/web/src/fork/PullRequestMenuItem.tsx`, the `+N` menu in
  `BranchToolbarBranchSelector.tsx`, `prOverflowBadge` in `Sidebar.tsx`, the
  inline summary in `ThreadStatusIndicators.tsx`, the fork rows in
  `GitActionsControl.tsx`, and `linkedPullRequests` plus the six status fields on
  `ThreadLinkedPullRequest` in `packages/contracts/src/orchestration.ts`.
- Kept, and the whole of the remaining delta: the `pullRequests` line in
  `mergeEnvironmentThread`. Its reason and its deletion condition are in
  [the inventory](./inventory.json) row `task-bound-pull-request` and in
  [gaps](./gaps.md) under _A pull request link is a listing change, not an
  event_.
- Verification: `pnpm typecheck`, `pnpm lint` and `pnpm fmt:check` pass.
  `pnpm test` exits 1 on three tasks, none of them this change.
  `@t3tools/desktop#test` cannot find the `libsecret-1` system library in this
  sandbox. `@t3tools/mobile#test` and `@t3tools/web#test` exit 137 under `vp`'s
  default concurrency, which [gaps](./gaps.md) records under _The full suite
  needs a raised heap_. Both pass alone under
  `NODE_OPTIONS="--max-old-space-size=12288"`: web `4838` tests, mobile `1393`.

### 2026-09-10 — merged upstream to 0f602b33, upstream shipped its own multi-PR threads

- Upstream: `0f602b337` from base `2a3035353` (`16` commits).
- Landed: `280` files from `git diff --stat HEAD^1 HEAD` against `277` in the
  upstream range (`2a3035353..HEAD^2`); fork delta `733` files from
  `git diff --stat HEAD^2 HEAD`. `merge-stats.mjs` reported the two file sets as
  an exact `277`/`277` match — nothing in the range was dropped and nothing extra
  landed. The three over are the typecheck fixes amended into the merge commit,
  listed below.
- Conflicts: 6 files, all on one upstream feature — #10839
  `feat(pull-requests): link multiple pull requests to threads`. `rightPanelStore.ts`
  and `ChatView.tsx` were additive on both sides (upstream's `pull-requests`
  surface and `addPullRequestsSurface`, the fork's `sandbox` surface and
  `addSandboxSurface`); kept both. `orchestration.ts` was an import-block
  collision plus the fork's `ThreadVisibility` literal landing on upstream's new
  doc comment; kept both. The other three are the entry below.
- **Upstream shipping the thing a convergence entry was waiting for does not
  make it adoptable.** `task-bound-pull-request` said to re-home the fork's `+N`
  menu onto upstream's equivalent "at which point"; upstream shipped that
  equivalent here — `thread.pullRequests`, `packages/shared/src/threadPullRequests.ts`,
  `ThreadPullRequestBadgeControl` — and it still cannot be re-homed, because
  Moatless serves neither the array nor the `threadPullRequests` capability, so
  upstream's badge resolves to nothing and would paint an empty pill over a
  working one. `theirs` would have silently deleted live behaviour the entry's
  `mustSurvive` names. Landed upstream's implementation whole and gated the two
  presentations on `useSupportsMultiplePullRequests` in
  `BranchToolbarBranchSelector.tsx`, `ThreadStatusIndicators.tsx` and
  `Sidebar.tsx` — additive, no prop threading, and it re-homes itself the day the
  backend advertises. Inventory and convergence entries updated to say so; the
  deletion list is in [gaps](./gaps.md) under _Capabilities are reported…_.
- **A clean merge can drop an import you still need.** `resolveBranchToolbarPrBranch`
  vanished from `BranchToolbarBranchSelector.tsx`'s `./BranchToolbar.logic` import
  with no conflict marker: the fork had deleted it from that line, upstream never
  touched the line, so git kept the deletion while upstream's new `branchPrBranch`
  logic reintroduced the use. Nothing flags this but typecheck.
- Three typecheck failures, all fork-only web code that upstream's widened shared
  types reached: `sandboxControl.placement.test.tsx` needed the two new
  `RightPanelTabs` props (`onAddPullRequests`, `pullRequestsAvailable`), and
  `useSandboxAvailability.ts` / `useSandboxDetail.ts` needed `isSuccess`
  destructured out of the query and returned, since `EnvironmentQueryView` grew it.
- Sweep: 13 owned-concern hits, all `infra/relay/**` FCM/Android-push files
  matching on `relay`. They belong to the decided-out `cloud-relay-connect`
  concern ("Being removed with Clerk. Do not adopt."), so they are inherited in
  tree and adopted by nothing. No inventory entry.
- Unsupported methods: 0 ADD, 0 DROP, 2 KEEP, 4 known exceptions — no `rpc.ts`
  edit. Upstream's two new methods `pullRequests.stack` and
  `pullRequests.linkedThreads` are already covered by the shared
  `PullRequestRpcError` union.
- `inventory.json` names a "Thread Fork Delta" and a "Thread Visibility Delta"
  that [the inventory prose](./upstream-merge-inventory.md) has no section for.
  Not introduced by this merge; noted so the next reader does not go looking.
- Verification: `verify.mjs` green on seven of eight — `duplicate-adds`,
  `tripwires`, `resolution-check`, `unsupported-methods`, `fmt:check`, `lint`,
  `typecheck`. `test` is red on `@t3tools/desktop` alone, and it is the standing
  `libsecret-1` gap already in [gaps](./gaps.md): `scripts/browser-secret-native.test.mjs
  > bundled libsecret helper`, 100 files pass and 1 fails to compile. Not
merge-introduced — `git diff --name-only HEAD^1 HEAD | grep browser-secret`is
empty. Four packages did not finish under`vp run -r test` (`@t3tools/mobile`,
`t3`, `@t3tools/web`, `t3code-relay`) and all four pass alone, so that is
parallel load again, not the merge. Whole run took ~18 min with
`NODE_OPTIONS=--max-old-space-size=12288`.
- `vp i` itself now OOMs under the default Node heap, not just the test suite —
  `Ineffective mark-compacts near heap limit`, surfacing as a bare exit 1.
  Re-run with `NODE_OPTIONS=--max-old-space-size=12288` and it installs.
- `git push --force-with-lease` is rejected with "stale info" on a merge branch
  here, every time. `.git/config`'s origin fetch refspec is only
  `+refs/heads/main:refs/remotes/origin/main`, so no remote-tracking ref exists
  for `merge/upstream-*` and the bare lease has nothing to compare against. Pass
  the ref and sha explicitly:
  `git push --force-with-lease=<branch>:<sha> origin HEAD:<branch>`.
- `pnpm-lock.yaml` floated a transitive `js-yaml` `4.2.0` → `4.3.1` and an
  alchemy peer hash on every `vp i`, same as last merge. Reverted before each
  commit and amend.

### 2026-09-09 — merged upstream to 2a303535, question attachments + an Effect rename that hid in three fork-only classes

- Upstream: `2a3035353` from base `a37c66406` (`53` commits).
- Landed: `12175` files from `git diff --stat HEAD^1 HEAD` against `12170` in the
  upstream range (`a37c66406..HEAD^2`); fork delta `730` files from
  `git diff --stat HEAD^2 HEAD`. The gap is both ways and both sides are
  accounted for. One file is in the range and not landed —
  `apps/server/src/cli/pair.ts`, which the fork deletes on purpose and which the
  tripwire confirms is still deleted. Six are landed and not in the range: the
  fixes amended into the merge commit, listed in the bullets below.
- Conflicts: 7 files. `pnpm-lock.yaml` `theirs` then `vp i`. `ChatComposer.tsx`
  both hunks `theirs` — the fork comment there documented `maxFileAttachmentBytes`,
  which upstream now owns itself. `DraftHeroHeadline.tsx` and
  `_chat.$environmentId.$threadId.tsx` were import-block collisions where both
  sides' imports are used; kept both. `ChatView.tsx` was additive on both sides
  in its first hunk (fork's fork-thread block, upstream's `pendingSidebarFileDrops`
  effect) and `theirs` in its second. `SettingsSidebarNav.tsx` is the one to read,
  below. No route file was added, deleted or renamed, so `routeTree.gen.ts` did
  not need regenerating.
- **Upstream deleting the machinery a fork decision hangs off is not the same as
  reverting the decision.** Upstream removed the settings sub-section nav wholesale
  — `settingsSectionVisibility.ts` no longer exists there — and the conflict
  presented as the fork's admin split colliding with that removal. Taking either
  side whole was wrong: the removal is upstream's and belongs, but the fork's
  Administration group answers a Moatless concept upstream has none of. Kept the
  removal and rebuilt the split on top of it, extracting `renderNavItem` so both
  groups render identical rows.
- **A dependency rename reaches fork-only declarations that no conflict will ever
  mark.** Upstream's Effect bump (`4.0.0-beta.103` → `rc.112`) renamed
  `Schema.TaggedErrorClass` to `Schema.TaggedError`. Upstream renamed its own two
  occurrences in `contracts/src/auth.ts`, so those merged clean; the fork's three
  — `UnsupportedMethodError` in `auth.ts:323`, `SandboxNotRunningError` in
  `sandbox.ts:108`, one in `web/src/environments/primary/auth.ts:157` — had no
  upstream counterpart, so git carried them through untouched and typecheck failed
  with ~40 cascading `TS2740`s in `rpc.ts` behind one `TS2551`. When upstream bumps
  a dependency it renames API for, grep the fork's own uses of that API; a clean
  merge says nothing about them.
- `duplicate-adds.mjs` reported `target="_blank"` in `MessagesTimeline.tsx`. Both
  parents have it once, on two unrelated anchors — the fork's `MessageOriginIcon`
  and upstream's new question-attachment link. The script now skips a bare JSX
  attribute on its own line for the same reason it already skips punctuation: the
  duplicate it would otherwise catch is a duplicate-attribute error lint and
  typecheck both reject anyway.
- Sweep: 3 owned-concern hits, all `infra/relay/src/agentActivity/`, matching on
  `relay` alone. They belong to the decided-out `cloud-relay-connect` concern and
  no fork app code imports them (`git grep` over `apps/ packages/` is empty).
  Taken as upstream, no inventory entry.
- Unsupported methods: 1 ADD, 0 DROP, 2 KEEP, 4 known exceptions. The ADD is
  `sandbox.detail`, and it is **pre-existing drift, not merge-introduced** —
  confirmed by re-running the derivation on `HEAD^1`. Applied anyway, since the
  derivation is a finding in either direction.
- `vp fmt` reformatted `apps/web/src/components/sandbox/sandboxPanelFormat.ts` and
  its test, neither of which this merge touched. Upstream's formatter config
  changed and these are fork-owned files that had never been run through the new
  line width; the diff is signature re-wrapping only.
- Verification: `verify.mjs` green on seven checks. `test` is red on
  `@t3tools/desktop` alone, the standing `libsecret-1` gap already in
  [gaps](./gaps.md) — 1289 tests pass, 1 suite fails to compile. Four packages
  did not finish under `vp run -r test` and all four pass alone (`@t3tools/web`
  383 files, `t3` 293, `@t3tools/mobile` 155, `t3code-relay` 28), so that is
  parallel load and not the merge. The suite needs
  `NODE_OPTIONS=--max-old-space-size=8192`, as gaps says.
- `vp i` after verification floats a transitive `js-yaml` `4.2.0` → `4.3.1` in the
  lockfile that has nothing to do with this merge. Reverted before the amend.
  Check `pnpm-lock.yaml` before every `--amend`, not just the first.

### 2026-09-08 — merged upstream to a37c6640, TypeScript 7 + a second route to the update banner

- Upstream: `a37c66406` from base `8b2838e0e` (`43` commits).
- Landed: `343` files from `git diff --stat HEAD^1 HEAD` against `343` in the
  upstream range (`8b2838e0e..HEAD^2`); fork delta `723` files from
  `git diff --stat HEAD^2 HEAD`. Exact match, so there is no gap to explain.
- Conflicts: 5 files. `pnpm-lock.yaml` `theirs` then `vp i`; `routeTree.gen.ts`
  regenerated with `regen-route-tree.mjs`; `SettingsSidebarNav.tsx` and
  `settingsSearch.test.ts` were additive collisions, both sides kept. The fifth
  is the one to carry forward, below.
- **A gate that survives its conflict can still stop covering the surface.**
  Upstream's #10596 split the composer's server-update banner into two routes:
  the single-machine condition the fork already gates, and a new
  `useAutoBalanceUpdateBanner` fed by an `autoUpdateEnvironments` memo. The
  conflict was on the first line only, so resolving it correctly still left the
  auto-balance route ungated and the offer reachable. `FEATURES.serverUpdateBanner`
  now carries two gates in `ChatView.tsx` and
  [its inventory row](./inventory.json) says to count them. Read what upstream
  added beside the line that conflicted, not just the line.
- **A new upstream settings page needs a gate even when it degrades politely.**
  #8103 added `/settings/snap-shot` for desktop window capture. Every control
  drives `window.desktopBridge`, and upstream renders an "unavailable" notice
  rather than hiding the page, so a hosted build listed a sidebar section and six
  searchable rows for a feature it cannot run. Gated with `FEATURES.snapShots`;
  `features.test.ts` catches a gated path with no route source and did.
- `packages/moatless-api` still ran `tsgo --noEmit` after upstream replaced
  `@typescript/native-preview` with TypeScript 7.0.2 everywhere it owns. The
  binary is gone after install, so typecheck failed to find it. Now `tsc`.
- `duplicate-adds.mjs` now skips `pnpm-lock.yaml`. It reported `iconv-lite: 0.6.3`
  as taken twice; `d3-dsv` and `encoding` each declare it, and the lockfile is
  `theirs` plus `vp i` by policy, so nothing in it is ever resolved by hand.
- Sweep: 4 owned-concern hits, all false positives on `session`/`pair` — three
  `apps/desktop/src/snapShot` files from #8103 and
  `packages/contracts/src/agentSessions.test.ts`, which covers the project-import
  scan schema and not auth. Taken as upstream. The snapShot files are the desktop
  half of the surface gated above.
- Unsupported methods: 0 ADD, 0 DROP, 2 KEEP, 4 known exceptions. `#10572` added
  four preview-recording error types and no new method, so no union changed.
- Verification: `verify.mjs` green except `@t3tools/desktop`, which fails to
  compile `browser-secret-native.test.mjs` because the sandbox has no
  `libsecret-1` — 1283 tests pass, 0 fail. New entry in [gaps](./gaps.md).
  `t3` failed `GrokAdapter.test.ts` once under parallel load and passes 42/42
  alone on a file byte-identical to upstream.

### 2026-09-07 — merged upstream to 8b2838e0, project defaults + two more refusals

- Upstream: `8b2838e0e` from base `b438447f6` (`141` commits).
- Landed: `563` files from `git diff --stat HEAD^1 HEAD` against `563` in the
  upstream range (`b438447f6..HEAD^2`); fork delta `720` files from
  `git diff --stat HEAD^2 HEAD`. Exact match, so there is no gap to explain.
- Conflicts: 14 files, resolved by concern; the merge commit message names each.
  Two are worth carrying forward. Upstream extracted the project action rows into
  `ProjectActionsList.tsx`, so the fork's Edit gate now rides an `editable` prop
  that defaults to upstream's always-editable behavior. Upstream also moved the
  `agent-browser-access` setting onto its new `/settings/projects` page, so
  `settingsSearch.ts` points that item there and drops a fork delta.
- **A clean merge is not proof the fork still compiles.** Upstream deleted
  `ClientTracingLive` as unused (#10225) and `apps/web/src/lib/runtime.ts` still
  installs it, so git merged both files without a marker and the typecheck failed
  four ways. Restored with a Fork comment. Read what upstream deleted against
  what the fork imports.
- Sweep: 7 owned-concern hits, all upstream server code this fork does not run —
  three `apps/marketing` images plus `AgentSessionJson.ts`, `HostResources.ts`,
  `cliproxyApi.ts` and its test. No action.
- Tripwires: failed on `.github/workflows/windows-tests.yml`, an inherited
  workflow that had become active again. Disabled it; green after.
- Unsupported methods: the backend moved its dispatch from
  `crates/t3code/src/lib.rs` to `crates/t3code/src/rpc/dispatch.rs`, and every arm
  there is a one-line call into a handler below the match. The script read the old
  path and reported `0 dispatched methods`, then read the new one and called
  `vcs.switchRef` a DROP because the refusal had moved out of the arm. It now
  tries both paths and follows an arm two calls deep. Reports 0 ADD, 0 DROP,
  2 KEEP.
- Contract: `provider.consumeResetCredit` and `server.getHostResources` gained
  `UnsupportedMethodError`; `server.getUsageSummary` lost it, which closes the
  item the previous entry left known-open. `pullRequests.summary` is a fourth
  `unsupportedMethodExceptions` entry rather than a union of its own.
- Fixed here and pre-existing, none of it upstream's doing: three `browser-*`
  search items still routed to the fork's admin `/settings/integrations`;
  `moatless/listSearch.ts` carried no fork-only declaration; `pnpm fmt:check`
  failed on 294 files, 293 of them orval output, now formatted by an
  `afterAllFilesWrite` hook in `orval.config.ts`; and `@t3tools/moatless-api`
  exported `./generated`, a barrel that is never checked in.
- **A green test step can hide a suite that never finished.** `vp run -r test`
  kills the packages still running when one of them fails, and `verify.mjs`
  counted any package with labeled output as tested. A `@t3tools/desktop`
  failure truncated `apps/web` and `@t3tools/mobile`, and four failing web tests
  went unreported. The check now keys on the closing `Test Files` line and runs
  every unfinished package alone. Its summary also named one class of failure
  and returned, hiding the other; both are on one line now.
- Verification: `inventory-check.mjs` clean. `verify.mjs` green on seven checks;
  `test` is red on one package. `@t3tools/desktop`'s `bundled libsecret helper`
  shells out to `pkg-config` for `libsecret-1`, which this sandbox does not have
  — the machine, not the merge. It fails the same way on its retry alone, which
  is why the step stays red. Everything else passes: `apps/web` 369 files, `t3`
  291, `@t3tools/mobile` 149, `t3code-relay` 27, `@t3tools/client-runtime` 71.
  The earlier `apps/web` and `t3` failures are gone. Two were the `browser-*`
  redirect above, missing from `settingsSearch.test.ts`. The other three were
  timeouts under load, in `fileEditorHighlight.test.ts` and
  `AcpJsonRpcConnection.test.ts`, and both files pass when their package runs
  alone.
- `spec:check` cannot run in a sandbox: it needs a sibling `moatless` checkout or
  a deployment URL and has neither.

### 2026-09-06 — merged upstream to b438447f, agent-session import + PR-refresh stream refuse

- Upstream: `b438447f6` from base `36c4e9cf5` (`395` commits).
- Landed: `1174` files from `git diff --stat HEAD^1 HEAD` against `1175` in the
  upstream range (`36c4e9cf5..HEAD^2`); fork delta `658` files from
  `git diff --stat HEAD^2 HEAD`. The one-file gap is
  `apps/web/src/AppRoot.test.tsx`, a modify/delete kept on the fork side: it
  still guards the fork-only `WebBrowserHost` render tree.
- Conflicts: 17 files, resolved by concern. `rpc.ts` converged (fork import
  block plus upstream's `providerUsageLimits`; fork `UnsupportedMethodError`
  entries re-applied onto the declarations upstream reformatted). Chat and
  shell converged (`ChatMarkdown` mermaid fence on upstream's new module-level
  renderer, `Sidebar` `FEATURES`/`useTouchContextMenu`, `MessagesTimeline` fork
  activity state, `SidebarChrome` `APP_BASE_NAME`). Preview decided
  (`previewStateStore` capability helpers kept, upstream z-index taken, fork
  `hasPreviewSurface` kept). Settings took upstream's six-section split with the
  four fork gates and the personal/admin nav split inside it. `AGENTS.md`
  decided, `docs/README.md` unioned, `background-service.md` theirs, `ci.yml`
  converged, `pnpm-lock.yaml` theirs then regenerated.
- Three unions added for methods Moatless does not dispatch:
  `agentSessions.scan`, `agentSessions.import`,
  `pullRequests.subscribeRefreshes`. Gaps.md grown accordingly.
- Two breaks that no conflict and no tripwire could show, both caught by a
  build rather than by review. `pnpm-lock.yaml` comes from upstream by policy,
  and upstream's lockfile does not carry the fork's `packages/moatless-api`
  package, so `--frozen-lockfile` refused three specifiers until the lockfile
  was regenerated. Upstream also made `fileContentRevision` module-private and
  moved its own callers onto new cache-key helpers; the fork's
  `browserPreviewRevision.ts` imports the bare hash, and neither file
  conflicted, so the merge auto-resolved into a missing export. The export is
  restored with a `// Fork:` marker naming the consumer. Run a web build before
  trusting a merge: `resolution-check.mjs` reads conflict-set paths and cannot
  see either of these.
- Sweep: 22 new upstream files matched an owned-concern pattern; all false
  positives (relay/cloud/usage/agent-session server code, host-classification
  shared util, connect-setup doc). 2 new workflows
  (`cursor-hygiene-webhook.yml`, `windows-tests.yml`) arrive enabled; disable in
  GitHub after the branch lands.
- Verification: `duplicate-adds`, `resolution-check` (56 fork deltas preserved,
  58 upstream changes landed, 17 theirs-verbatim byte-identical), `tripwires`,
  `fmt:check`, `lint` and `typecheck` all green. The GitHub image build passes.
  Tests pass across every workspace package. Two caveats, neither a merge
  regression: `@t3tools/desktop`'s `browser-secret-native.test.mjs` needs
  `libsecret-1`, which this sandbox cannot install and CI installs itself (its
  other 831 tests pass); and `@t3tools/shared` failed under full-suite load and
  passed alone.
- `verify.mjs --only test` runs `vp run -r test`, which covered 6 of the 12
  packages that declare a `test` script here. It skipped `@t3tools/web`,
  `@t3tools/client-runtime` and `t3`, all of which carry conflicts in this
  merge, and reported green. Run the rest by name with
  `vp run --filter <pkg> test` until the step itself is fixed; `@t3tools/web`
  alone is 362 files and 4303 tests.
- Known-open, recorded and deliberately not fixed here:
  `unsupported-methods.mjs` reports `server.getUsageSummary` under DROP. Moatless
  dispatches it, so the union entry is dead and should be removed, and the
  "Usage summary" bullet in [gaps](./gaps.md) is stale with it. Also
  `apps/web/src/components/settings/moatless/listSearch.ts` is fork-only with no
  `inventory.json` entry.

### 2026-09-03 — merged upstream to 36c4e9cf, Antigravity provider + usage-rates refuse

- Upstream: `36c4e9cf5` from base `d937e3075` (`137` commits).
- Landed: `816` files from `git diff --stat HEAD^1 HEAD` against `811` in the
  upstream range (`d937e3075..HEAD^2`); fork delta `650` files from
  `git diff --stat HEAD^2 HEAD`. Gap of five, all in landed and not the range:
  two fork-owned files touched during resolution —
  `apps/web/src/components/sandbox/sandboxControl.placement.test.tsx` (a
  test-prop fixup) and `apps/web/src/components/sandbox/useSandboxCommandsBanner.tsx`
  (a reformat) — plus the three fork docs this merge writes,
  `docs/fork/inventory.json` (the fork-policy edit below), `docs/fork/gaps.md`
  and this file. No upstream work dropped.
- Conflicts, resolution by inventory verdict:
  - `AGENTS.md` [`agent-instructions`, decide] — kept the fork's slimmed shape;
    added Antigravity to the intro's provider list.
  - `packages/contracts/src/rpc.ts` [`contracts-rpc-auth`, converged] — kept the
    fork import block, adopted upstream's `./usage.ts` imports. Union work below.
  - `packages/contracts/src/environment.ts` — kept the fork capability keys,
    adopted upstream's `serverUpdateThreadContinuation` (a server-declared
    capability, not a client method, so no union entry).
  - `ChatView.tsx`, `MessagesTimeline.tsx` [`thread-fork` / `message-origin`,
    converged] — took upstream's attachment/right-panel convergence; re-applied
    the fork's message-origin imports and the fork-a-thread hover action (added
    as an optional `actions` prop on `AssistantMessageMeta`). Dropped the now-dead
    `FileIcon` and `configuredPreviewUrls`/`configuredUrls` (the fork's hosted
    `PreviewPanel` takes no such prop).
  - `preview/*` [`upstream-preview`, decide] — took upstream's `addBrowserSurface`
    `profileId` field beside the fork's `url`, `rightPanelStore` `openAttachment`
    beside the fork's `retargetFile`, and the `RightPanelTabs` add-browser-in-
    profile props. Fixed a latent fork bug in `PreviewView`'s hosted annotation
    handler: routed it through the exported `capturePreviewAnnotationScreenshot`
    wrapper (the internal helper it called is not exported).
  - `settings/*`, `SidebarChrome.tsx`, `FilePreviewPanel.tsx` [decide] — took
    upstream's size/icon and attachment-media changes; re-applied the fork's
    `serverAdministration` / `projectManagement` gates, the `APP_BASE_NAME` span,
    and the `onRetargetFile` effect.
  - Deleted per upstream #9364: `ProjectScriptsControl.test.tsx`,
    `preview/PreviewChromeRow.test.tsx` (git rm, accepting the upstream removal).
- New unsupported methods (`unsupported-methods.mjs` ADD → 0 after): added
  `UnsupportedMethodError` to the shared `ProviderSetupRpcError` union (nine
  `provider.auth.*` / `provider.install.*` methods behind the Antigravity #9348 /
  provider-editor #8508 work) and to `server.refreshUsageRates`. Gaps.md
  "Methods the backend does not dispatch" grown with a _Provider setup_ bullet
  and a `refreshUsageRates` clause on _Usage summary_.
- Feature triage of the 137 commits:
  - _Usable as-is_ (UI, no backend dependency): mod+w tab close (#9363),
    PageUp/PageDown chat nav (#9315), diff-header copy-path (#2403), error-report
    copy (#9166), opt-in context-window indicator (#9190), diff/PR file tree
    (#9330), opt-in panel animations (#8830) and proactive panels (#9276),
    button press feedback (#9349), provider-editor redesign chrome (#8508).
  - _Unsupported in Moatless_ (refuse; backend serves none): Antigravity provider
    auth/install and all `provider.*` setup (#9348, #8508), `server.refreshUsageRates`.
    Desktop-only and already capability-/desktop-gated, no new work: preview
    browser profiles (#7254), open-links-in-app (#9339), ssh-host suggestions
    (#9171), environment-as-machine (#9299), continue-threads-across-restart
    (#9167, rides the `serverUpdateThreadContinuation` capability).
  - _Backend behavior to reproduce_ if Moatless wants it: project icons (#9137,
    migration 047), auto-pull clean default branches (#9277, migration 045),
    inline citations (#9146, needs the backend to emit citations), the usage page.
    Migration 046 (RepairAutomaticSettlementTimestamps) is upstream-server-only.
  - Net-zero: context compaction (#8808) landed and was reverted (#9284).
- Sweep: no owned-concern surprises. `scripts.run`, `subtasks.list`,
  `threads.getShell` still report under DROP — the three documented keep-anyway
  exceptions (`apps/server` still refuses them), unchanged.
- Verification: `fmt:check`, `lint`, `typecheck`, `tripwires` green; full test
  suite green. `unsupported-methods` and `duplicate-adds` exit non-zero and are
  the two caveated machine failures — `unsupported-methods` on the three
  documented DROP exceptions above, `duplicate-adds` on three false positives
  (`openPreview` in a `ChatView` object literal vs its deps array; three distinct
  `it()` blocks in `addBrowserSurface.test.ts`), all kept twice legitimately.

### 2026-09-02 — merged upstream to d937e307, server-side settlement converges, prThreadSettling retired

- Upstream: `d937e3075` from base `b17cc3d1b` (`62` commits).
- Landed: `562` files from `git diff --stat HEAD^1 HEAD` against `560` in the
  upstream range (`b17cc3d1b..HEAD^2`). Gap of two: landed carries three files
  the range does not — `apps/web/src/fork/features.ts` and
  `apps/web/src/components/settings/moatless/listSearch.ts` (both fork
  resolution edits) and `docs/fork/gaps.md` (fork doc); the range carries one
  the landing does not — `apps/server/src/cli/pair.ts`, already deleted on the
  fork side so absent from both sides of `HEAD^1..HEAD`. Fork delta `626` files
  from `git diff --stat HEAD^2 HEAD`.
- Conflicts, fourteen textual:
  - `apps/web/src/components/ChatView.tsx` [`thread-fork`, converged] and
    `apps/web/src/components/Sidebar.tsx` [`mobile-touch`, converged] — upstream
    moved thread settlement server-side: it dropped the client-side
    `effectiveSettled` computation and now renders
    `thread.settledOverride === "settled"`. Took upstream's model in both; in
    `Sidebar` re-applied only the fork's pin-before-settled ordering (a pinned
    thread never auto-settles). This makes the fork's `prThreadSettling` gate
    redundant — Moatless already owns settlement and never settles from PR state
    (verified: `settled_override` is set only on explicit user settle/unsettle
    and cleared on new activity, `crates/tasks/src/task/dao.rs`). Retired the
    flag: removed it from `apps/web/src/fork/features.ts`, dropped the
    `prThreadSettling` gate in both files, and removed the `pr-settling-gate`
    guard + `pr-settling` convergence entry from the inventory. Gaps.md's
    "A pull request is not the thread's own" section struck and "Settlement
    rules Moatless owns" rewritten to the server-side model.
  - `apps/server/src/bin.ts` [`server-cli-surface`, decide] — dropped upstream's
    reintroduced `pairCommand`, kept the fork's `appCommand` in the subcommand
    list (`pair.ts`/`pair.test.ts` stay deleted per the tripwire).
  - `packages/contracts/src/rpc.ts` [`contracts-rpc-auth`, converged] — added
    `UnsupportedMethodError` to `WsServerCommitDesktopUpdateRpc`'s error union
    (upstream's new desktop remote-update method Moatless does not serve),
    marked `// Fork:` and referencing gaps.md "Desktop and host lifecycle".
  - Settings-search cluster [`settings-gates`, decide] —
    `apps/web/src/components/settings/settingsSearch.ts` (+ `.test.ts`),
    `SettingsSidebarNav.tsx`, `SettingsPanels.tsx`, `CommandPalette.tsx`,
    `moatless/listSearch.ts`: took upstream's new `searchTerms`/
    `filterAvailableSettingsSearchItems`/`useAvailableSettingsSearchItems` and
    `serverScoped` settings rows; re-applied the fork's `to: "/settings/browser"`
    targets, the admin/enabled filter
    (`settingsPathEnabled(item.to) && (isAdmin || !isMoatlessAdminPath(item.to))`),
    and the `FEATURES.assistantStreaming`/`FEATURES.projectManagement` row gates
    (now carrying upstream's `serverScoped` prop). `listSearch.ts` re-pointed at
    `~/lib/utils` for `normalizeSearchText` after the local re-export was dropped.
  - `apps/web/src/components/files/FilePreviewPanel.tsx` [`file-preview`, decide]
    — took upstream's new media detection (image/video/pdf/html/host-file) and
    re-applied the fork's `onRetargetFile`/`readRelativePath` retarget branch.
  - `apps/web/src/components/chat/MessagesTimeline.tsx` [`message-origin`,
    converged] and `threadActionMenu.logic.test.ts` [`settings-gates`] — import
    and expectation merges only (no delete item — `threadDeletion` off;
    `project-settings` kept, not fork-gated).
- Sweep: `duplicate-adds` clean; `tripwires` clean (`pair.ts`/`pair.test.ts`
  still deleted); `unsupported-methods` reported one ADD —
  `server.commitDesktopUpdate`, resolved in `rpc.ts` above — and the standing
  `scripts.run` DROP, the permanent documented exception (`apps/server` refuses
  it unconditionally and must compile, so the union member stays and the script
  exits 1 benignly). No routes added/removed, so no route-tree regen.
- Verification: `verify.mjs --fast` fmt/lint/typecheck clean; tests pass — web
  `3348`, desktop `689`, mobile `1082`, relay `209`, server `3125` (`10`
  skipped). `unsupported-methods` exits 1 only for the `scripts.run` exception
  above (ADD count is `0`).

### 2026-09-01 — merged upstream to b17cc3d1, generic file attachments converge

- Upstream: `b17cc3d1b` from base `6a9d9f988` (`69` commits).
- Landed: `384` files from `git diff --stat HEAD^1 HEAD` against `385` in the
  upstream range — the one-file gap is `apps/server/src/cli/pair.test.ts`,
  already deleted on the fork side (deliberate, matches the tripwire) and so
  absent from both diffs by different routes. Fork delta `621` files from
  `git diff --stat HEAD^2 HEAD`.
- Conflicts, twelve (eleven textual + one modify/delete):
  - `AGENTS.md` [`agent-instructions`, decide] — kept the fork's "Hit every
    surface" bullet list; dropped upstream's inserted duplicate
    Dev-servers/Test-data/Verifying/Pull-requests sections (the fork already
    has its own later versions). Added one bullet to Verifying about not
    testing implementation mirrors.
  - `apps/server/src/cli/pair.test.ts` — modify/delete; `git rm -f`. Both
    `pair.ts` and `pair.test.ts` are confirmed still-deleted per the tripwire.
  - `apps/server/src/ws.ts` [`server-hosted-env-stubs`, converged] — took
    upstream, re-inserted the fork's full hosted-environment stub block
    (`serversList`/`sandboxStatus`/`sandboxStart`/`sandboxStop`/`scriptsRun`/
    `sandboxSubscribeStatus`/`subscribeServerStatus`/`serversSubscribeLogs`)
    ahead of upstream's `subscribeServerConfig` entry.
  - `apps/web/src/components/ChatView.tsx`,
    `apps/web/src/components/chat/ChatComposer.tsx`,
    `apps/web/src/components/chat/MessagesTimeline.tsx`,
    `apps/web/src/lib/attachmentUploadQueue.ts` (+ `.test.ts`) [unlisted →
    `decide`, all one concern] — upstream shipped a native image/file/video
    composer attachment system (`composerAttachmentFiles.ts`,
    `ComposerFileAttachment`, `classifyComposerAttachmentFile`,
    `fileAttachmentStagingLimit`) that replaces the fork's own earlier
    generic-file-attachment work almost line for line. Took upstream wholesale
    in every one of these files and re-applied only the pieces upstream has no
    equivalent for: the `maxFileAttachmentBytes`/`FEATURES` prop threading, the
    `attachmentUploadsCapabilityKnown`/`supportsAttachmentUploads` gating, and
    the `FEATURES.serverAdministration`-gated affordances. `MessagesTimeline`
    also had a fully redundant fork-only sent-message file-rendering block
    (auto-merged, no conflict marker) duplicating upstream's new native
    rendering — deleted, along with the now-dead `fork/fileAttachments.tsx`
    import there.
  - `apps/web/src/components/settings/ProviderSettingsPanel.tsx` (+
    `.environment.test.tsx`) [`settings-gates`, decide] — took upstream's new
    header (`ProviderLastChecked` + refresh button, gated only by `!readOnly`)
    but wrapped only the "Add provider" control in
    `FEATURES.serverAdministration`, since refreshing is a read every server
    serves and adding an instance is not.
  - `apps/web/src/components/settings/SettingsSidebarNav.tsx` [`settings-gates`,
    decide] — combined upstream's new WSL-visibility-aware `searchableItems`
    base list with the fork's admin-path filter.
  - `pnpm-lock.yaml` [`lockfile`, theirs] — took upstream's, re-ran `vp i`
    (605 lines of fork workspace edges restored).
- Auto-merged but wrong, the failures the tracker exists to catch (both found
  after the merge commit, via `tsgo --noEmit` and a full read-only sweep of
  every remaining "conflict candidate" — see below):
  - `apps/web/src/composerDraftStore.ts` — the fork's own pre-existing
    generic-file-attachment hack (`ComposerImageAttachment.type: "image" |
"file"`, a widened discriminator) survived the merge untouched, sitting
    right beside upstream's new, real `ComposerFileAttachment` type added a few
    lines later. No conflict marker; git spliced both in cleanly. The result
    type-checked file-by-file but broke discriminated-union narrowing at every
    call site that switches on `.type` (9 real `tsc` errors across
    `ChatComposer.tsx`, `composerAttachmentFiles.ts`,
    `attachmentUploadQueue.ts`). Fixed by reverting `ComposerImageAttachment`
    and `hydrateImagesFromPersisted` to upstream's clean shape, deleting the
    now-fully-superseded `apps/web/src/fork/fileAttachments.tsx` (+ test) and
    its two remaining stale call sites in `ChatComposer.tsx` (a persist-effect
    file-size cap and a file-chip render branch, both dead now that
    `composerImages` can never carry `type: "file"`), and deleting a dead test
    `describe` block in `composerDraftStore.test.ts` that exercised the
    reverted behavior.
  - `apps/web/src/components/settings/settingsSearch.ts` — the fork renamed
    upstream's browser-embed settings page from `/settings/integrations` to
    `/settings/browser`, updating every existing search entry that pointed at
    it. Upstream, in the same range, added one new entry
    (`browser-recording-frame-rate`) still pointing at
    `/settings/integrations` — correct on upstream's side, stale on the
    fork's, and outside the span the fork's rename touched, so it merged
    clean with no marker. Searching "recording frame rate" and clicking the
    result sent a user to the fork's unrelated admin Integrations page instead
    of Browser settings. Fixed the route and its matching assertion in
    `settingsSearch.test.ts`.
  - A read-only agent sweep of the other fourteen `[unlisted]` conflict
    candidates from `merge-stats.mjs` (`bin.ts`, `DiffPanel.tsx`,
    `ChatHeader.tsx`, `MessagesTimeline.test.tsx`, `FilePreviewPanel.tsx`,
    `ProjectSettingsPanel.tsx`, `SettingsPanels.tsx`,
    `settingsSearch.test.ts`, `previewStateStore.ts`, `routes/__root.tsx`,
    `docs/README.md`, two `package.json`s, `packages/contracts/src/
environment.ts`) found no further instances of this failure mode — every
    fork hunk in those files sits in a region upstream's own changes never
    touched.
- Sweep: one hit, false positive. `apps/mobile/src/features/cloud/
cloud-drafts.ts` (new upstream file) is a pure mobile cloud/relay sign-out
  feature (`CloudDraftArchiveError`, `removeCloudEnvironments`), unrelated to
  any fork concern.
- `packages/contracts/src/rpc.ts` [`contracts-rpc-auth`, converged] — took
  upstream, then ran `unsupported-methods.mjs`: dropped the now-dead
  `UnsupportedMethodError` union members for `attachments.createUploadUrl` and
  `attachments.delete` (Moatless now dispatches both unconditionally) and
  updated the matching "Attachment uploads" gap. Left `scripts.run`'s member
  in place despite the script reporting it under DROP — this is the
  documented exception in gaps.md's "A script runs on the backend" entry:
  `apps/server` (T3's own bundled server, still checked in `apps/server/src/
ws.ts`) has no sandbox to run a script in and answers `scriptsRun` with
  `UnsupportedMethodError` unconditionally, so the union member is for that
  server, not Moatless. Added a comment on `WsScriptsRunRpc` pointing future
  merges at the gap entry so this isn't rediscovered from scratch.
- Gap correction: the "Attachment uploads" gap this entry originally left open
  ("only the capability flag on the handshake is left to confirm") was wrong —
  queried the deployed backend's `server.getConfig` directly (rpc-verification
  skill) and it already reports `capabilities.attachmentUploads: true` and
  `capabilities.fileAttachments.maxUploadBytes: 52428800`, gated in
  `crates/t3code/src/lib.rs` on `SESSION_JWT_SECRET` being configured, which it
  is on this deployment. The client (`composerAttachmentFiles.ts`) already
  reads both capabilities and the composer's file input already goes through
  `classifyComposerAttachmentFile`. Struck the gap entry from `gaps.md`
  entirely rather than leaving a stale "needs verification" note.
- Verification: `duplicate-adds.mjs` flags one triple
  (`apps/web/src/components/chat/MessagesTimeline.tsx`: `const content = (` /
  `<a>` / `</a>`) — confirmed false positive, two unrelated functions
  (`UserTimelineRow`'s native file rendering and the fork-owned
  `MessageOriginChip`) sharing generic JSX/variable shapes.
  `unsupported-methods.mjs` reports `scripts.run` under DROP — expected, see
  above. `fmt`, `lint`, `typecheck` (all workspaces) clean. Full `test` run:
  one failure, `apps/mobile`'s `nativeReviewDiffHighlighter.test.ts`, which
  passed alone on retry — the documented "full suite needs a raised heap"
  flakiness, not a merge regression. `apps/web`'s own suite independently
  confirmed clean: 302 files, 3259 tests, 0 failures.

### 2026-09-01 — folded in origin/main's fork-thread commit before opening the PR

- Not an upstream merge: `origin/main` had moved with a new fork-only commit
  (`ac7dc2c72`, "fork a thread from the chat hover action") landed directly
  while the b17cc3d1 upstream merge above was in flight. Merged it into this
  branch before opening the PR so the two don't fight each other later.
- Conflict: `apps/web/src/components/chat/MessagesTimeline.tsx`, four blocks —
  combined both sides (import list, `NOOP_*` constants,
  `TimelineRowActivityState` fields, and the `activityState` `useMemo` object
  literal + deps). While combining the deps array, restored
  `isPreparingWorktree`, which the incoming commit's side had dropped from the
  deps despite still reading it in the object literal.
- Auto-merged but wrong, found by `tsgo --noEmit` after the merge commit:
  `ac7dc2c72` was authored against the fork's pre-`b17cc3d1` main, so its
  `MessagesTimeline.tsx` diff still threaded `workingStepLabel` through
  `TimelineRowActivityState` and the `activityState` memo. Upstream had
  already deleted that entire feature, JSX rendering included, in
  `3f62e6fa6` ("simplify the working timer", landed via `b17cc3d1` above) —
  confirmed no consumer of `workingStepLabel` remains anywhere in the tree.
  Removed the dangling field and its two memo references instead of
  reinstating the plumbing, since restoring it would fight upstream's
  deliberate simplification for a feature with nothing left to read it.
- Verification: `duplicate-adds.mjs` and `inventory-check.mjs` clean.
  `tsgo --noEmit` (apps/web) clean. `MessagesTimeline.test.tsx`: 41 passed.

### 2026-08-29 — merged upstream to 6a9d9f98, the project picker becomes a combobox

- Upstream: `6a9d9f988` from base `badae6a5c` (`58` commits).
- Landed: `431` files from `git diff --stat HEAD^1 HEAD` against `431` in the
  upstream range — an exact match, no gap to explain. Fork delta `611` files
  from `git diff --stat HEAD^2 HEAD`.
- The clone arrives with only `origin`; `preflight.mjs` refused until
  `git remote add upstream https://github.com/pingdotgg/t3code.git`. Expected in
  a fresh sandbox, not a finding.
- Conflicts, three, all `decide`-shaped in practice:
  - `Sidebar.tsx` [`mobile-touch-upstream-files`, converged] — upstream replaced
    the project picker's `Menu`/`MenuRadioGroup` with a searchable `Combobox`
    (#5931). Took upstream's structure wholesale and re-applied only the
    `FEATURES.projectManagement` gate on "New project", now carrying the
    `// Fork:` marker it had been missing. Upstream has since grown the
    touch-target span itself, so the Mobile Touch Delta has nothing left to
    re-apply in this file — one convergence, unprompted.
  - `ProviderSettingsPanel.tsx` [unlisted, outside a fork-owned concern → the
    fallback says `theirs`] — upstream split provider settings into list and
    editor (#8380, #8472) and moved `ProviderLastChecked` and the refresh
    button out of `headerAction` into the list footer, leaving `headerAction` a
    plain "Add provider" button. Took upstream's and re-applied the gate as
    `!readOnly && FEATURES.serverAdministration`. The fork's own icon-button
    "Add provider instance" is gone; upstream's labelled button replaces it.
    `ProviderSettingsPanel.environment.test.tsx` is upstream's and asserted
    `headerAction` is not null when editable — adapted, with a marker, to assert
    the section renders and its header action is null, which is what the gate
    means.
  - `pnpm-lock.yaml` — took upstream's and re-ran `vp i`, which restored the
    fork's `@t3tools/moatless-api` workspace edge. Do not hand-merge this file.
- Auto-merged but wrong, the failure the tracker exists to catch:
  `packages/contracts/src/orchestration.test.ts`. Both sides appended
  `OrchestrationMessage` to the same import list and the same
  `decodeOrchestrationMessage` const, at different offsets, so git took both
  without a marker. It surfaced as a parse error in `lint`, `typecheck` and
  `test` at once. `merge-stats.mjs` lists this file under "conflict candidates";
  read that list even when the merge printed no conflict for an entry.
- `HostedBrowserFrame.tsx` (fork-only) needed the new required `renderingActive`
  prop that #8567 added to `resolveHostedBrowserWebviewWrapperStyle`. Upstream
  suspends a parked webview unless background audio, PiP or a recording still
  needs it painted. A frame has none of those to read and is the app's only copy
  of the preview page, so it passes `true` and keeps today's behavior. Revisit
  only with a measurement.
- Sweep: five hits, all false positives, none accepted as fork work.
  `apps/web/src/connection/clientMetadata.ts` and its test report the client's
  OS/browser/device on connect (#8481) — auth-adjacent, but it rides
  `ClientPresentation` on the relay and remote-bearer bootstraps, and the
  fork's primary environment (`environments/primary/auth.ts`) sends none of it.
  `packages/client-runtime/src/relay/errorPresentation.ts`, its test, and
  `connection/errors.test.ts` explain DPoP failures (#8351) — relay only, and
  T3 Connect is decided out.
- Contract: `unsupported-methods.mjs` reports `ADD 0`, `DROP 1` (`scripts.run`),
  `KEEP 2`. Upstream added no WS method in this range. The `scripts.run` DROP is
  **not** actioned — it is the documented exception in
  [the gaps register](./gaps.md#a-script-runs-on-the-backend-and-only-the-backend-can-edit-one):
  the union entry answers for `apps/server`, which still stubs the method, not
  for Moatless. Verified the stub survived the merge in `apps/server/src/ws.ts`.
  This check will keep exiting 1 every merge until upstream's server can run a
  project's script; treat a red `unsupported-methods` as read-the-bucket, not
  as failure.
- Gaps: extended **Attachment uploads** with the file half of #8235 — a turn may
  now carry any file up to 50MB behind a second capability,
  `capabilities.fileAttachments.maxUploadBytes`. Nothing else standing: the
  auto-settling churn (#8321 opt-in, reverted by #8596) nets to no change, and
  upstream's web composer still offers images only.
- Verification: `verify.mjs`. `tripwires`, `fmt:check`, `lint` and `typecheck`
  pass. `test` reports `@t3tools/web` **flaky, passed alone** — in the full run
  its `MessagesTimeline.test.tsx` skipped all 34 tests on a 30s module-import
  timeout under `ChatMarkdown.tsx`, and alone the package is 297 files / 3117
  tests green. Load, not the merge. `unsupported-methods` red by the exception
  above.

### 2026-08-26 — merged upstream to badae6a5c, browser defaults get their own settings route

- Upstream: `badae6a5c` from base `27732293` (`188` commits). Landed as a merge
  commit; the base advanced cleanly from the 2026-08-25 entry.
- Landed: `719` files from `git diff --stat HEAD^1 HEAD` against `718` in the
  upstream range. The gap of one is four file-list differences that net to
  one: `SandboxStatusControl.tsx` (fork-only post-merge lint fix, not in
  upstream's range), `PreviewChromeRow.test.tsx` (fork's superset already
  covers upstream's change, file unchanged by the merge but present in both
  diffs), `settings.browser.tsx` replacing `settings.integrations.tsx` (see
  below — same file count, different path), and `docs/fork/inventory.json`
  (fork-only bookkeeping). Fork delta `609` files from `git diff --stat
HEAD^2 HEAD` (unchanged from the 2026-08-16 entry).
- Conflicts, thirteen files, all falling to the `decide-then-add-entry`
  fallback inside an owned concern (no cached `pathPolicy` verdict fired):
  - `RightPanelTabs.tsx` — upstream replaced its six hardcoded add-surface
    menu items with a `.map()` over `addSurfaceActions` plus a keydown
    handler on the menu popup; adopted upstream's loop wholesale, since the
    fork's items were already flowing through that same array.
  - `SettingsSidebarNav.tsx` — import conflict (fork's `settingsPathEnabled`,
    `useMoatlessSession` beside upstream's new `SidebarUtilityMenu`), kept
    all three. Also fixed a duplicate `SETTINGS_SECTION_ICONS` key the
    conflict resolution surfaced: upstream's `/settings/integrations` entry
    is now `/settings/browser` (see below), fork's stays.
  - `SidebarChrome.tsx` — upstream re-added a `T3Wordmark` component this
    fork already replaces with `SidebarBrand`'s `APP_BASE_NAME` span (see the
    2026-08-16 entry's _Moatless branding_ row); dropped the dead function
    and kept upstream's new `SidebarUtilityItem` helper and the
    `SidebarChromeFooter` → `SidebarUtilityMenu` rename.
  - `threadActionMenu.logic.ts` + `.test.ts` — upstream reshuffled the
    archive/delete tail; re-stated the fork's `FEATURES.threadDeletion` gate
    around the new `delete` item and rewrote the test to check archive is
    last, non-destructive and separated, and that `delete` is absent when the
    gate is off. Entry: _Thread deletion gate in the row menu_.
  - `settings.tsx` — additive import merge only (fork's admin-gating imports
    beside upstream's `WorkspacePageHeader`).
  - `settings.integrations.tsx` — **add/add, no common ancestor.** Upstream
    independently added a new embedded-surfaces settings page at this exact
    path the same range the fork already owns it for the Moatless
    connections/apps/GitHub admin page. Kept the fork's file here and gave
    upstream's page a new home at `settings.browser.tsx` instead of picking a
    side. New `pathPolicy` entry: _moatless-admin-integrations-route_
    (`decide`, not `ours` — `inventory-check.mjs` correctly rejects `ours`
    the moment upstream ships content at an owned path). New `inventory`
    entry: _settings-browser-relocation_.
  - Fallout from the above that git merged silently, no conflict marker:
    `settingsSearch.ts` had a duplicate `SettingsPath` union member and a
    duplicate `SETTINGS_SECTION_LABELS` key from the same collision (only one
    side of an add/add pair gets a marker; the file referencing both paths
    doesn't). Split the five browser-default search items onto
    `/settings/browser`, left the fork's three integrations items on
    `/settings/integrations`. `routeTree.gen.ts` regenerated via `vp dev`
    picks up the new route.
- Post-merge fixes the conflict resolution did not catch, all found by
  `verify.mjs` rather than by reading:
  - `SandboxStatusControl.tsx` — new `t3code(no-native-title-tooltip)` lint
    rule flagged the fork's native `title` attribute; replaced with the
    `Tooltip`/`TooltipTrigger`/`TooltipPopup` pattern the rest of the repo
    uses.
  - `PreviewView.tsx` — orphaned `resolveResponsiveBrowserViewportSize`
    import, dead after upstream's `useBrowserDefaults` replaced its call
    site.
  - `imageCompression.test.ts` — orphaned `MAX_STASH_IMAGE_DATA_URL_CHARS`
    import; the fork's tests use explicit byte limits instead.
  - `ThreadPreviewMiniPlayer.tsx` — stray blank line, `vp fmt` fixed it.
  - `addBrowserSurface.test.ts` — real bug: upstream's `openPreviewSession.ts`
    now unconditionally includes a resolved `viewport` in every `openPreview`
    call; the fork's second test (URL passthrough / `recentlySeenUrls`,
    absent from upstream's file) was missing the same expectation already
    applied to the first test.
- Sweep: five owned-concern hits, all false positives —
  `orphanedProviderSessionStartup.integration.test.ts`, `electronPasskeys.test.ts`,
  `041_AuthSessionClientConnection.ts` + `.test.ts` are upstream's own
  session/auth work, not fork auth surfaces.
- Off-repository: `desktop-macos-preview.yml` is new this merge. It only
  triggers on `pull_request: [labeled, synchronize, reopened]`, and GitHub
  resolves a `pull_request` workflow from the base branch's copy of the file
  — so it stays unregistered until this merge itself lands on `main`, the way
  `web-preview.yml` did between the 2026-08-12 and 2026-08-16 entries.
  Flagged here; disable it once a future merge finds it `active`.
- Convergence: none fired. The watch list's twelve rows are unchanged.
- Unsupported methods: ADD 3, DROP 0, KEEP 2. Upstream added
  `attachments.createUploadUrl`, `attachments.delete` (needs no fork gate,
  `capabilities.attachmentUploads` already keeps the composer's attach
  affordance off) and `provider.uploadFeedback` (Codex's `/feedback` command,
  posts to OpenAI, correctly resolves to `UnsupportedMethodError`
  unconditionally). All three added to the `rpc.ts` union per the script's
  advice; gaps register entries: _Attachment uploads_, _Codex feedback_. KEEP
  unchanged (`vcs.switchRef`, `git.preparePullRequestThread`); DROP's
  `scripts.run` exception is unaffected.
- Verification: `verify.mjs` — tripwires, unsupported-methods (re-run
  standalone after the `rpc.ts` fix, confirms ADD 0), `fmt:check`, `lint` and
  `typecheck` all pass. `packages/contracts` typechecked separately with
  `tsgo --noEmit`, clean. `test` reported four failures across two full runs,
  all confirmed to pass reliably in isolation and unrelated to any touched
  file: `session-logic.test.ts` (perf budget, 162ms vs 100ms), `openVsxThemes
.test.ts` (15000ms timeout), `ProviderRegistry.test.ts`'s codex-binaryPath
  re-probe test (not touched by any conflict resolution, auto-merged clean).
  Same load-pressure pattern as the 2026-08-16 entry's `effect-acp` /
  `oxlint-plugin-t3code` exits.

### 2026-08-25 — the terminal-drawer toggle comes back, the sandbox pill moves down

- Fork delta shrinks by a file. `FEATURES.terminalDrawerToggle` and its gate are
  deleted rather than flipped, the way `features.ts` says to turn one on, so
  `PanelLayoutControls.tsx` is upstream's byte for byte again: a `git diff`
  against `27732293` on that path is empty. This undoes the 2026-08-03 entry
  below. Row: _Chat surface gates_, which no longer names the file.
- The sandbox pill left the right panel's tab bar for the panel body: under the
  launcher's surface cards, and under the disabled state's reason where it is
  the only way back up. The tab bar's right end is where upstream puts its
  layout toggles, and a fork element parked there is what the returning button
  had to fit around. Row: _Sandbox lifecycle controls_.
- Recorded rather than solved: with the pill in the body, Stop is out of reach
  while a surface is open and the sandbox is running. Losing a sandbox disables
  the surfaces and brings the control back with the reason, so the way in is
  never the one that goes missing.
- A ready sandbox's dot is `bg-success` now. In the tab bar an amber dot beside
  "Sandbox running" was a small lie; in the launcher it would have been the
  loudest thing on the screen.
- The placement is now a test rather than a habit:
  `components/sandbox/sandboxControl.placement.test.tsx` renders the panel and
  fails if the control comes out ahead of the body's opening div. Checked by
  putting the hunk back in the tab bar, where both cases fail.
- Verification: web typecheck, lint on the changed files, `vp fmt --check`, and
  `vp test run` over `apps/web/src/fork`, `components/sandbox` and
  `RightPanelTabs.test.tsx`, 36 passing. Not verified in a browser.

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
  (`e25021af7`); it registered as `active` the moment the merge reached `main`,
  and was disabled then. `tripwires.mjs` now reports three active workflows,
  all allowed.
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
