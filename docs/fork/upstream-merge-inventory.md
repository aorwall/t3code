# Fork upstream merge inventory

This is the mutable fork policy and inventory used by the project-local
[`fork-upstream-merge`](../../.agents/skills/fork-upstream-merge/SKILL.md)
skill. Keep stable merge procedure and policy definitions in the skill. Keep
durable ownership rules, tripwires, inventory, and convergence rules here. Keep
dated merge decisions in [the upstream merge tracker](./upstream-merge-log.md),
and what is still missing — on the backend or here — in
[the fork gaps](./gaps.md).

Entries are lists, not tables. A Markdown table is re-padded across every one of
its rows when a single cell changes width, so adding one path used to rewrite
every line of the block and conflict with any other branch that had touched any
other entry in it. The formatter leaves list items and prose alone. Keep it that
way: one entry per bullet, one path per line, and an edit touches only its own
lines.

## Fork-owned concerns

If an unlisted file touches one of these concerns, decide and record it. If it
does not, take upstream.

- **Authentication and session**
  - Fork position: Moatless cookie session and `/login`; no T3 backend session.
  - Upstream addition: do not adopt upstream auth work.

- **Client / device identity**
  - Fork position: Moatless replaces device pairing.
  - Upstream addition: do not adopt; check Deleted surfaces.

- **Cloud, relay, T3 Connect**
  - Fork position: being removed with Clerk.
  - Upstream addition: do not adopt.

- **Dev-server origin and proxy**
  - Fork position: upstream single-origin dev plus fork proxy-target override.
  - Upstream addition: adopt upstream, then re-apply the fork delta.

- **Backend contract**
  - Fork position: the client may assume only what Moatless implements; see
    `docs/internals/client-server-contract.md`.
  - Upstream addition: adopt only if Moatless implements it.

- **Electron / desktop**
  - Fork position: kept in tree; not a compliance target.
  - Upstream addition: take upstream and do not spend merge effort making
    desktop work.

## Path policy

An entry may be `ours` only if the path does not exist in `upstream/main`. Verify
before writing one, and re-verify an entry the first time upstream conflicts on
it. A fresh sandbox clones only `origin`, so add the remote first — the check is
cheap and answers questions no amount of reading the fork's own history can,
because that clone is shallow:

```bash
git remote add upstream https://github.com/pingdotgg/t3code.git
git fetch --depth=1 upstream main
git ls-tree -r --name-only upstream/main -- <path> | wc -l
```

A non-zero count means upstream owns the file and the entry is `decide` or
`converged`, never `ours`. When upstream _adds_ a file under an `ours` path, that
entry splits in the same merge. `ours` is for paths upstream does not have, not
for paths the fork feels strongly about.

The same fetch answers the other question an entry needs: whether the fork's side
is a delta at all. `git diff --numstat upstream/main HEAD -- <path>` reporting
nothing means the file is byte-identical to upstream and belongs in no entry.

- `apps/web/src/environments/primary/auth.ts` — **decide**
  - Keep the Moatless cookie session. Upstream owns this file and changes the
    environment layer around it; take those changes and re-state the fork's
    session behavior on top.

- `apps/web/src/environments/primary/httpLayer.ts` — **decide**
  - Keep cookie session behavior and the absent same-origin gate. Take
    upstream's transport changes.

- `apps/web/src/routes/login.tsx` — **ours**
  - Keep fork-only `/login`. Not present upstream.

- `apps/web/src/authBootstrap.test.ts` — **decide**
  - Keep fork auth coverage. Upstream owns this file; take its harness and
    assertion changes and keep the fork's cases beside them.

- `apps/web/vite.config.ts` — **converged**
  - Take upstream, then apply Web Vite Delta.

- `AGENTS.md` (and the `CLAUDE.md` symlink to it) — **decide**
  - Keep the fork's slimmed shape and its This fork section. Upstream owns and
    edits this file: read its version for new facts — surfaces, commands, paths,
    sharp edges — and re-state those in the fork's voice rather than taking
    upstream's prose.

- `docs/fork/**` — **ours**
  - Keep fork docs and tracker. Not present upstream.

- `.agents/skills/fork-upstream-merge/**` — **ours**
- `.agents/skills/test-moatless-web/**` — **ours**
  - The fork's two skills: merging upstream, and testing the web client against
    a Moatless backend. Upstream owns the other four in `.agents/skills/` and
    adds more; neither of these is present upstream. Verified 2026-08-06.

- `.agents/skills/test-t3-app/SKILL.md`, `.agents/skills/test-t3-mobile/SKILL.md`
  — **converge**
  - Take theirs, then re-apply the scope note at the top of each. Both describe
    the bundled T3 server, which the fork's web client does not use; the note is
    a few lines routing readers to `test-moatless-web` and is deliberately the
    whole delta, so upstream's edits to these docs land unopposed.

- Fork-authored user and internals docs — **ours**
  - Paths:
    - `docs/user/moatless-*.md`
    - `docs/internals/client-server-contract.md`
    - `docs/internals/moatless-concept-map.md`
  - Keep fork-authored docs. Not present upstream. Verified 2026-08-03.

- The four fork-authored plans — **ours**
  - Paths:
    - `.plans/moatless-adapter.md`
    - `.plans/moatless-convergence.md`
    - `.plans/preview-servers-in-t3-web.md`
    - `.plans/completed/moatless-admin-in-t3.md`
  - Not present upstream — the first three verified 2026-08-03, the fourth
    written in this fork on 2026-08-05.

- `.plans/**` (everything else) — **theirs**
  - Upstream owns 32 of the 36 files here and adds more. This entry was `ours`
    until 2026-08-03, which would have discarded every upstream plan edit; take
    upstream and let the four fork plans above sit beside them.

- `scripts/dev-runner.ts`, `scripts/dev-runner.test.ts` — **theirs, verbatim**
  - Take upstream exactly; investigate any re-grown fork delta.

- Thread-server and sandbox lifecycle surfaces — **ours**
  - Paths:
    - `apps/web/src/components/servers/**`
    - `apps/web/src/state/servers.ts`
    - `packages/contracts/src/servers.ts`
    - `packages/contracts/fixtures/moatless/**`
    - `packages/client-runtime/src/state/servers.ts`
  - Keep them. None of these exist upstream.

- The five fork-only files under `browser/` — **ours**
  - Paths:
    - `apps/web/src/browser/HostedBrowserFrame*.tsx`
    - `apps/web/src/browser/WebBrowserHost*.tsx`
    - `apps/web/src/browser/hostedFrameReload.ts`
  - Not present upstream.

- `apps/web/src/browser/**` (everything else) — **decide**
  - Upstream owns 34 of the 39 files here and works in them steadily. Decide per
    file: take upstream and re-state the hosted-preview behavior from the Fork
    inventory entry on top of it.

- The fork-only files under `components/preview/` — **ours**
  - Paths:
    - `apps/web/src/components/preview/PreviewServerCard.tsx`
    - `apps/web/src/components/preview/PreviewServerNotStarted.tsx`
    - `apps/web/src/components/preview/useFramedServerStatus.ts`
    - `apps/web/src/components/preview/framedServerReload*.ts`
  - Each renders or reasons about `ThreadServer`, a Moatless concept upstream
    does not have. Not present upstream — verified 2026-08-06, when
    `PreviewEmptyState.tsx` and `PreviewView.tsx` in the same directory were
    confirmed to be upstream's.

- `apps/web/src/components/preview/**` (everything else) — **decide**
  - Upstream owns the rest of this directory and works in it steadily. Take
    upstream and re-state the hosted-preview behavior from the Fork inventory
    entry on top. `PreviewChromeRow.test.tsx` was fork-only until 2026-08-06,
    when upstream added a file of the same name — it is upstream's now, and the
    fork's two cases sit beside upstream's.

- `packages/contracts/src/rpc.ts`, `packages/contracts/src/auth.ts` — **converged**
  - Take upstream, then re-apply `UnsupportedMethodError`, its
    unsupported-method error unions, and `servers.*` wiring.

- `apps/server/src/ws.ts`, `apps/server/src/auth/RpcAuthorization.ts` — **converged**
  - Take upstream, then re-add the hosted-environment method entries:
    `servers.*`, `sandbox.status`, `sandbox.start`, and `sandbox.stop`.

- `apps/web/src/fork/**` — **ours**
  - Keep the surface-gating registry and the mobile touch modules.

- `apps/web/src/components/chat/messageOrigin.ts` and its test — **ours**
  - Fork-only mapping from a message origin to its chip. Written for a concept
    upstream does not have. Not present upstream. Verified 2026-08-03.

- Message origin's upstream files — **converged**
  - Paths:
    - `packages/contracts/src/orchestration.ts`
    - `packages/client-runtime/src/state/threadReducer.ts`
    - `apps/server/src/orchestration/projector.ts`
    - `apps/web/src/components/chat/MessagesTimeline.tsx`
  - Take upstream, then apply Message Origin Delta. `MessagesTimeline.tsx` is a
    file upstream works in steadily; the delta is additive and must not
    re-indent upstream blocks.

- Mobile touch's upstream files — **converged**
  - Paths:
    - `apps/web/src/components/ui/sidebar.tsx`
    - `apps/web/src/components/Sidebar.tsx`
    - `apps/web/src/components/SidebarV2.tsx`
    - `apps/web/src/contextMenuFallback.ts`
  - Take upstream, then apply Mobile Touch Delta. `SidebarV2.tsx` also carries
    the Navigation gates delta; both must survive.

- Feature-gated files in Fork inventory — **converged**
  - Take upstream, then re-apply additive gates without re-indenting upstream
    blocks.

- Fork-only workflows — **ours**
  - Paths:
    - `.github/workflows/build-moatless-t3-image.yml`
    - `.github/workflows/README.md`
  - Fork-only. Not present upstream.

- `.github/workflows/ci.yml` — **converged**
  - The one exception to the entry below. Take upstream, then re-apply the
    single `Check the Moatless API description is current` step in the `check`
    job — see Moatless Spec Check Delta. Nothing else in this file is
    fork-owned.

- `.github/workflows/**` (everything else) — **theirs, verbatim**
  - Upstream's files byte for byte, including workflows upstream adds later.
    They are switched off in GitHub, not in the tree, so there is no delta to
    preserve. Any fork delta here means someone edited a workflow — investigate
    before taking it.

- Upstream paths this fork deletes — **decide**
  - Paths:
    - `apps/server/src/cli/pair.ts` and its test
    - `apps/web/src/components/preview/PreviewLocalServerCard.tsx`
    - `apps/web/src/components/preview/useDiscoveredLocalServers.ts` and its test
  - Upstream owns these and the fork's side is deletion. `pair.ts` is the
    pairing CLI, decided out with the surface; the two preview files are
    upstream's local-server discovery, replaced by `useThreadPreviewServers`.
    An upstream edit raises a delete/modify conflict, and taking upstream
    silently restores the file — after every merge run
    `git diff --diff-filter=D --name-only upstream/main HEAD` and confirm the
    list is still exactly these five.

- Unlisted and outside Fork-owned concerns — **theirs**
  - Take upstream.

- Unlisted and inside Fork-owned concerns — **decide, then add an entry**
  - Decide in the merge and update this policy.

## Web Vite Delta

For `apps/web/vite.config.ts`, take upstream first, then re-apply exactly:

- `repoFileEnv` from `loadRepoEnv({ baseEnv: {} })`.
- `proxyTargetOverride` chain:
  `T3CODE_DEV_PROXY_TARGET` -> `T3CODE_PROXY_TARGET_OVERRIDE` from repo env ->
  `T3CODE_PROXY_TARGET` -> `MOATLESS_BASE_URL`.
- `proxyTargetOverride` precedence over upstream `T3CODE_PORT` default in
  `devProxyTarget`, forcing `isSingleOriginDev`.
- `T3CODE_ALLOWED_HOSTS` alias for upstream `T3CODE_DEV_ALLOWED_HOSTS`, including
  the `true` escape hatch and upstream's implicit `.ts.net` entry.
- `VITE_MOATLESS_PROXY_AUTH` define.
- `NODE_ENV=production` to `development` pin for `command === "serve"`.

## Moatless Spec Check Delta

For `.github/workflows/ci.yml`, take upstream first, then re-apply exactly one
step in the `check` job, after `Typecheck`:

- `Check the Moatless API description is current`, guarded by
  `if: vars.MOATLESS_API_URL != ''`, running
  `node packages/moatless-api/scripts/checkSpecFreshness.mjs --url "${{ vars.MOATLESS_API_URL }}"`.

Nothing else in the file is fork-owned. The guard is not a soft launch: this
fork's CI does not check out the Moatless repository, so there is nothing to
compare against until a deployment URL is configured as a repository variable.
Until then the step is skipped and the check is a local one.

Why it exists: the generated client is built from a checked-in copy of the
backend's OpenAPI description. A copy that has drifted still type-checks
perfectly — it describes routes the backend no longer serves — so nothing else
in CI can catch it.

## Mobile Touch Delta

The fork is reached from a phone browser; upstream's mobile client is the native
app in `apps/mobile`, so upstream has no pressure to make `apps/web` usable with
a finger. Four upstream files carry that work. Take upstream first, then
re-state:

- **`ui/sidebar.tsx`** — an `isMobile && side === "left"` branch returning
  `MobileSidebarDrawer`, placed _above_ upstream's `isMobile` sheet branch. The
  sheet branch stays and still serves `side="right"`. If upstream restructures
  `Sidebar` so the branch has no anchor, the path-policy entry is stale:
  re-derive the branch from the drawer's own contract — it needs `openMobile`,
  `setOpenMobile` and `side`, and nothing else.
- **`Sidebar.tsx` and `SidebarV2.tsx`** — `useTouchContextMenu(handler)` beside
  the row's existing `onContextMenu` handler, spread onto the row element in
  place of the bare `onContextMenu` attribute. One row in `Sidebar.tsx`, two in
  `SidebarV2.tsx` (slim and card). Behavior that must survive: a long press on a
  thread row opens the same menu a right-click does, and the press does not also
  register as a tap on the row.
- **`contextMenuFallback.ts`** — submenus open on `click` as well as
  `mouseenter`, and the menu's `max-width` is clamped to the viewport. Behavior
  that must survive: a submenu is reachable without a hover, and the menu fits a
  phone. If upstream rewrites the fallback around a real popup primitive, drop
  this delta rather than porting it.

## Message Origin Delta

A Moatless Task takes messages from Slack, a GitHub PR, Linear, Telegram and
other Tasks, and upstream's thread has one source — the composer — so upstream
has no field for where a message came from. Four upstream files carry the
addition. Take upstream first, then re-state:

- **`contracts/src/orchestration.ts`** — `OrchestrationMessageOrigin`
  (`kind`, `label`, `url`, `user`) and an `origin: Schema.optional(Schema.NullOr(…))`
  field on both `OrchestrationMessage` and `ThreadMessageSentPayload`. Optional,
  not nullable: a composer message carries no `origin` key at all, so every
  payload written before this decodes unchanged. Both structs need it or a live
  delta renders differently from a reload of the same message.
- **`client-runtime/src/state/threadReducer.ts`** and
  **`apps/server/src/orchestration/projector.ts`** — spread `origin` through
  both the append and the update arm of `thread.message-sent`, in the same
  `!== undefined ? { … } : {}` form the neighbouring `attachments` uses.
- **`MessagesTimeline.tsx`** — `MessageOriginChip` above the user bubble in
  `UserTimelineRow`, and `MessageOriginIcon`'s `switch`. Behavior that must
  survive: a message from an adapter or another Task is visibly not one someone
  typed here, and a composer message renders exactly as upstream renders it.

An adapter kind the client does not recognize falls back to a humanized name
under a generic icon rather than being dropped, so the backend can name a new
source before the client learns about it. Keep that fallback: it is what lets
the two repositories deploy in either order.

## Deriving the unsupported set

`UnsupportedMethodError` belongs on exactly the contract WebSocket methods the
Moatless backend does not dispatch. Both halves are derived, never remembered:

- **Contract side** — every `Rpc.make(WS_METHODS.x, …)` and
  `Rpc.make(ORCHESTRATION_WS_METHODS.x, …)` in `packages/contracts/src/rpc.ts`,
  resolved through the `WS_METHODS` and `ORCHESTRATION_WS_METHODS` maps to the
  wire strings.
- **Backend side** — the `"method.name" =>` arms of the frame dispatch in
  `soaplabs/moatless`, which lives in `crates/t3code/src/lib.rs`. It was
  `backend/src/api/ui_rpc/mod.rs` when this entry was first written; the crate
  split moved it. A sandbox has no checkout of that repository, so read it over
  the API:

  ```bash
  moat gh api repos/soaplabs/moatless/contents/crates/t3code/src/lib.rs \
    --jq '.content' | base64 -d | grep -oE '"[a-zA-Z.]+" =>' | sort -u
  ```

Both directions matter. A method the backend has started serving keeps a union
entry that can never fire; a method it has stopped serving loses the typed
refusal the client renders.

**Known drift, 2026-08-06.** Thirteen entries are stale in the "backend serves
it now" direction: `terminal.open`, `attach`, `write`, `resize`, `clear`,
`restart`, `close`, `subscribeTerminalEvents`, `subscribeTerminalMetadata`,
`vcs.switchRef`, `git.runStackedAction`, `git.resolvePullRequest` and
`git.preparePullRequestThread`. The backend gained all thirteen after the unions
were first computed on 2026-08-01. Dropping them narrows the contract against a
deployment rather than against `main`, so it is its own change, and it wants a
check that the deployed backend serves them. Tracked in
[the fork gaps](./gaps.md); recompute rather than trusting the list above.

## Deleted surfaces

Run from the repo root. When removal work lands, change that surface to
`removed` here in the same commit. Only `removed` tripwires require no matches.

- **Clerk / T3 Connect** — decided, not yet removed
  - Tripwire: `git grep -ln '@clerk/' -- '*package.json' ':(exclude).repos'`

- **Device pairing** — decided, not yet removed
  - Tripwire:
    `git grep -lni pairing -- apps/web/src apps/server/src apps/mobile packages/contracts/src`

- **T3 backend session bootstrap** — decided, not yet removed
  - Tripwire:
    `git grep -n 'fetchSessionState\|exchangeBootstrapCredential' -- apps/web/src`

## Off-repository state

Some fork decisions are enforced in GitHub rather than in the tree, so a merge
cannot see them and a clone does not carry them. Check this like a tripwire:

```bash
gh api repos/soaplabs/t3code/actions/workflows \
  --jq '.workflows[] | select(.state == "active") | .path'
```

The only lines allowed out of that are `.github/workflows/build-moatless-t3-image.yml`
and the two `dynamic/dependabot/*` entries GitHub generates. Anything else is an
inherited workflow that came back on.

A workflow upstream adds later arrives `active`, so this is the check that fails
after a merge rather than before one. Switch the new file off with
`gh workflow disable <name> --repo soaplabs/t3code` and record it in the tracker
entry.

## Fork inventory

Use this inventory to identify deliberate fork changes during conflicts, test
failures, or convergence decisions. If fork code exists outside a listed entry,
update this file.

- **Moatless cookie session**
  - Paths:
    - `apps/web/src/environments/primary/auth.ts`
    - `apps/web/src/environments/primary/httpLayer.ts`
    - `apps/web/src/routes/login.tsx`
    - `apps/web/src/authBootstrap.test.ts`
  - Behavior that must survive: the browser authenticates by Moatless cookie
    session, there is no T3 backend session exchange, and `/login` is the entry
    point. Only `login.tsx` is fork-only; the other three are `decide` —
    upstream owns them and keeps changing the environment layer they sit in.

- **Proxy target, allowed hosts, dev pins**
  - Paths:
    - `apps/web/vite.config.ts`
  - Converged; apply only Web Vite Delta.

- **Upstream workflows switched off**
  - Paths:
    - `.github/workflows/**`
  - Behavior that must survive: no workflow inherited from upstream runs in this
    fork. Enforced in GitHub as `state: disabled_manually`, not in the tree —
    see Off-repository state.

- **Agent instructions**
  - Paths:
    - `AGENTS.md`
    - `CLAUDE.md`
  - Behavior that must survive: the file says this is a fork of
    `pingdotgg/t3code`, what the fork changes, and that `fork-upstream-merge`
    governs ownership questions; and it stays short enough to be read in full.
    It also carries the fork's surgical-change rules: fork code says so in a
    comment, and reaches upstream files through an additive hook. `decide`, not
    `ours` — upstream owns the file and keeps adding real facts to it. Resolve
    conflicts by fact, not by hunk: take what upstream learned, drop what a
    current model already knows.

- **Fork documentation and plans**
  - Paths:
    - `docs/fork/**`
    - `.agents/skills/fork-upstream-merge/**`
    - `.agents/skills/test-moatless-web/**`
    - `docs/user/moatless-*.md`
    - `docs/internals/client-server-contract.md`
    - `docs/internals/moatless-concept-map.md`
    - `.plans/moatless-adapter.md`
    - `.plans/moatless-convergence.md`
    - `.plans/preview-servers-in-t3-web.md`
    - `.plans/completed/moatless-admin-in-t3.md`
  - Keep ours. Only those four plans are ours; upstream owns the rest of
    `.plans/**`, and only `fork-upstream-merge` and `test-moatless-web` are ours
    under `.agents/skills/` — see Path policy.

- **Hosted-environment contract group**
  - Paths:
    - `packages/contracts/src/servers.ts`
    - `packages/contracts/src/sandbox.ts`
    - `packages/contracts/src/rpc.ts`
    - `packages/contracts/src/index.ts`
    - `packages/contracts/src/preview.ts`
    - `packages/contracts/fixtures/moatless/**`
  - Keep fork methods: server list, server status subscription, server log
    subscription, sandbox status, sandbox start, and sandbox stop. Keep sandbox
    lifecycle schemas separate from server list schemas.

- **Server state in client runtime**
  - Paths:
    - `packages/client-runtime/src/state/servers.ts`
    - `packages/client-runtime/src/state/sandbox.ts`
    - their tests
    - `packages/client-runtime/src/rpc/client.ts`
    - `packages/client-runtime/package.json`
  - Keep fork server and sandbox lifecycle state surfaces separate.

- **Servers view in right panel**
  - Paths:
    - `apps/web/src/components/servers/**`
    - `apps/web/src/state/servers.ts`
    - `apps/web/src/components/RightPanelTabs.tsx`
    - `apps/web/src/rightPanelStore.ts`
    - `apps/web/src/components/ChatView.tsx`
    - `apps/web/src/AppRoot.tsx`
  - Keep fork UI unless upstream ships an equivalent.

- **Hosted web preview**
  - Paths:
    - `apps/web/src/browser/**`
    - `apps/web/src/components/preview/**`
    - `apps/web/src/previewStateStore.ts`
    - `apps/web/src/previewRuntimeCapability.test.ts`
  - Behavior that must survive: preview renders in a hosted iframe rather than a
    native browser surface, and a frame that loaded before its server was
    serving is replaced when the server reaches `started`
    (`useFramedServerReload` in `PreviewView.tsx` — a webview reloads itself, a
    frame does not). Upstream owns most files in all four paths and works in
    them; take upstream and re-state the iframe behavior on top. Drop the fork
    delta entirely once upstream ships a web preview.

- **Upstream-server hosted-env stubs**
  - Paths:
    - `apps/server/src/ws.ts`
    - `apps/server/src/auth/RpcAuthorization.ts`
  - Converged; re-add `servers.*`, `sandbox.status`, `sandbox.start`, and
    `sandbox.stop` entries. Drop these first if upstream ships server-shaped
    support.

- **Sandbox lifecycle controls**
  - Paths:
    - `apps/web/src/components/SandboxStatusControl.tsx`
    - `apps/web/src/components/SandboxedRightPanelTabs.tsx`
    - `apps/web/src/components/chat/SandboxedChatHeader.tsx`
    - `apps/web/src/components/sandbox/**`
    - `apps/web/src/components/preview/useThreadPreviewServers.ts`
    - `apps/web/src/components/ChatView.tsx`
    - `apps/web/src/components/RightPanelTabs.tsx`
    - `apps/web/src/components/chat/ChatHeader.tsx`
  - Keep top-bar start/status control and right-panel disabling until upstream
    has an environment lifecycle capability the web client can use.

- **`UnsupportedMethodError`**
  - Paths:
    - `packages/contracts/src/auth.ts`
  - Keep error class until upstream has optional/unsupported method semantics.

- **Unsupported-method error unions**
  - Paths:
    - `packages/contracts/src/rpc.ts`
  - Keep one entry per Moatless-unserved method. Recompute; never hand-edit —
    see Deriving the unsupported set.

- **Surface-gating registry**
  - Paths:
    - `apps/web/src/fork/features.ts` and test
  - Keep as the only source of fork surface flags. Unknown route/action keys
    default enabled; tests must read upstream keys.

- **Chat surface gates**
  - Paths:
    - `apps/web/src/components/ChatView.tsx`
    - `apps/web/src/components/RightPanelTabs.tsx`
    - `apps/web/src/components/chat/ChatHeader.tsx`
    - `apps/web/src/components/chat/PanelLayoutControls.tsx`
  - Re-apply additive gates only. `PanelLayoutControls.tsx`'s gate hides the
    terminal-drawer button, so the fork's chat header has one panel toggle where
    upstream has two; a merge that finds three toggles has taken upstream's
    back.

- **Persisted panel gating**
  - Paths:
    - `apps/web/src/rightPanelStore.ts`
  - Keep migrate disposal for hidden/unknown surfaces.

- **Mobile touch affordances**
  - Paths:
    - `apps/web/src/fork/MobileSidebarDrawer.tsx`
    - `apps/web/src/fork/mobileSidebarDrag.ts`
    - `apps/web/src/fork/touchContextMenu.ts`
    - their tests
    - `apps/web/src/components/ui/sidebar.tsx`
    - `apps/web/src/components/Sidebar.tsx`
    - `apps/web/src/components/SidebarV2.tsx`
    - `apps/web/src/contextMenuFallback.ts`
  - Behavior that must survive: the left sidebar is a drawer the finger drags in
    from the screen edge, and a long press on a thread row reaches Settle,
    Snooze, rename and delete. The three `fork/` modules are ours; the four
    upstream files are `converged` — see Mobile Touch Delta. The drawer must not
    become a modal `<dialog>`: that makes `document.body` inert, and the menus it
    exists to open portal there.

- **Message origin**
  - Paths:
    - `packages/contracts/src/orchestration.ts`
    - `packages/client-runtime/src/state/threadReducer.ts`
    - `apps/server/src/orchestration/projector.ts`
    - `apps/web/src/components/chat/MessagesTimeline.tsx`
    - `apps/web/src/components/chat/messageOrigin.ts` and its test
  - Behavior that must survive: a message that reached the thread through an
    adapter or from another Task says so, and a message typed into the composer
    renders exactly as upstream renders it. `messageOrigin.ts` and its test are
    ours; the four upstream files are `converged` — see Message Origin Delta.
    The contract field is optional rather than nullable so the absent case stays
    byte-identical to upstream's payload.

- **PR-driven settling gate**
  - Paths:
    - `apps/web/src/components/SidebarV2.tsx`
    - `apps/web/src/components/ChatView.tsx`
    - `apps/web/src/fork/features.ts`
  - Behavior that must survive: a pull request never decides whether a thread is
    settled — neither merged/closed settling one nor open holding one out of the
    shelf. Two additive `FEATURES.prThreadSettling` gates feed `effectiveSettled`
    a null `changeRequestState`; `effectiveSettled` itself is upstream's and
    unmodified, and the mobile port keeps upstream's behavior. A merge that finds
    a thread settling on a merged PR has taken upstream's side back.

- **Navigation gates**
  - Paths:
    - `apps/web/src/components/CommandPalette.tsx`
    - `apps/web/src/components/SidebarV2.tsx`
  - Re-apply list filtering gates.

- **Archive in the sidebar v2 row menu**
  - Paths:
    - `apps/web/src/components/SidebarV2.tsx`
  - Keep the single-thread `archive` item and its `case`. Upstream leaves archive
    out of v2 row menus because settling is the put-away action there; in
    Moatless settling is triage and archiving closes the Task, so both are
    needed. Additive only — no bulk item, no gate.

- **Settings gates**
  - Paths:
    - `apps/web/src/routes/settings.tsx`
    - `apps/web/src/components/settings/SettingsSidebarNav.tsx`
    - `apps/web/src/components/settings/SettingsPanels.tsx`
  - Re-apply route guard and nav/search filtering. General, Appearance, and
    Providers stay visible except server-backed add-provider instance.

- **Moatless REST client**
  - Paths:
    - `packages/moatless-api/**`
  - Fork-only. The generated client for the Moatless REST API, plus the
    checked-in OpenAPI description it is generated from and the CI check that the
    two have not drifted. Nothing upstream reaches this package. Regenerate with
    `vp run --filter @t3tools/moatless-api generate` after copying a newer
    `openapi-specs.json`; do not hand-edit `src/generated/**`.
    `customInstance.ts` carries an `@effect-diagnostics-next-line
globalFetch:off`: the package is deliberately outside Effect, and without it
    a repo-wide typecheck fails.

- **Moatless administration reads**
  - Paths:
    - `apps/web/src/moatless/**`
  - Fork-only. Caching and dirty-form helpers for the administration pages.
    Deliberately not `createEnvironmentQueryAtomFamily`: that helper waits on the
    environment socket, and administration data is plain HTTP that has no reason
    to blank on a reconnect. If upstream ships a socket-independent query helper,
    prefer it and delete `query.ts`. `query.ts` carries an
    `@effect-diagnostics-next-line globalErrorInEffectCatch:off` for the same
    reason `customInstance.ts` carries one — keep it.

- **Moatless administration pages**
  - Paths:
    - `apps/web/src/components/settings/moatless/**`
    - `apps/web/src/routes/settings.workspaces.tsx`
    - `apps/web/src/routes/settings.workspaces_.$workspaceId.tsx`
    - `apps/web/src/routes/settings.loops.tsx`
    - `apps/web/src/routes/settings.loops_.$loopId.tsx`
    - `apps/web/src/routes/settings.integrations.tsx`
    - `apps/web/src/routes/settings.integrations_.$connectionId.tsx`
    - `apps/web/src/routes/settings.skills.tsx`
    - `apps/web/src/routes/settings.skills_.$pluginId.tsx`
    - `apps/web/src/routes/settings.secrets.tsx`
    - `apps/web/src/routes/settings.users.tsx`
    - `apps/web/src/routes/settings.users_.$login.tsx`
  - Fork-only. Behavior that must survive: an administrator reaches every
    Moatless administration surface from T3 settings — Workspaces, Loops,
    Integrations, Skills, Secrets and Users, each with its detail route. None of
    these paths exist upstream. The `NotInT3Yet` placeholder these grew out of is
    gone; a new administration surface adds a real panel, not a placeholder.
    Built out of upstream's own settings primitives (`SettingsSection`,
    `SettingsRow`, `itemRows`), so upstream restyling reaches them for free —
    keep it that way.

- **Moatless administration nav and guard**
  - Paths:
    - `apps/web/src/components/settings/settingsSearch.ts` and its test
    - `apps/web/src/components/settings/SettingsSidebarNav.tsx`
    - `apps/web/src/routes/settings.tsx`
  - Converged with Settings gates above; the same three files carry both deltas
    and both must survive. Additive: the `Administration` nav group, the
    `MOATLESS_ADMIN_PATHS` entries, the `beforeLoad` redirect for a
    non-administrator, and an `export` on `normalizeSearchText` so the
    administration list filters decide what matches the way this page does. The
    guard matches detail routes by path prefix — a new administration route with
    children must be added to `MOATLESS_ADMIN_PATHS` or it is reachable without
    an admin check.

## Convergence watch list

When upstream ships one of these, prefer upstream and shrink the fork delta.

- **Auth**
  - Watch for: no convergence expected; auth is fork-owned.
  - Action: keep ours.

- **Dev proxy / single-origin**
  - Watch for: work on `DEV_PROXIED_PATH_PREFIXES`, `T3CODE_SINGLE_ORIGIN_DEV`,
    or `resolveDevProxyTarget`.
  - Action: take upstream and re-apply only Web Vite Delta.

- **Allowed hosts**
  - Watch for: upstream consolidation on `T3CODE_DEV_ALLOWED_HOSTS`.
  - Action: drop the `T3CODE_ALLOWED_HOSTS` alias once deployments inject
    upstream's name.

- **Thread servers**
  - Watch for: any upstream concept of a server owned by a thread, especially in
    `WS_METHODS`.
  - Action: prefer upstream; remove fork group, stubs first.

- **Hosted preview**
  - Watch for: any upstream web-build preview surface.
  - Action: prefer upstream web preview.

- **Unsupported methods**
  - Watch for: an optional-method marker, handshake metadata, `ServerConfig`, or
    an HTTP `metadata` endpoint — a general way for a server to say it does not
    serve a method.
  - Action: prefer upstream semantics and collapse the error-union entries into
    it.

- **Surface gating**
  - Watch for: new booleans on `ExecutionEnvironmentCapabilities`. Upstream adds
    one per thread-lifecycle surface — `threadSettlement`, `threadSnooze`, and
    `threadPinning` as of 2026-08-06.
  - Action: prefer upstream's capability where one exists and delete the
    matching `FEATURES` flag. The server decides, so the surface then follows
    the backend without a fork edit.

- **Web on a phone**
  - Watch for: a swipeable mobile sidebar, a touch affordance for thread-row
    actions, or a `contextMenuFallback` rewritten on a popup primitive.
  - Action: prefer upstream and drop the matching part of Mobile Touch Delta.

- **Archive in sidebar v2**
  - Watch for: any upstream archive entry point in `SidebarV2.tsx` or its mobile
    port `thread-list-v2-items.tsx`.
  - Action: prefer upstream's and drop the fork item.

- **PR-driven settling**
  - Watch for: Moatless reporting the change request for the checkout's own ref
    (matching `headRef` to `refName`), or upstream keying `resolveThreadPr` on
    something stronger than a branch name.
  - Action: delete the `prThreadSettling` flag and both gates; upstream's rule is
    correct once the PR is the thread's own.

- **Message provenance**
  - Watch for: any upstream field on `OrchestrationMessage` saying a message did
    not come from the composer — an origin, author, or source.
  - Action: prefer upstream's shape, re-point the chip at it, and drop the fork
    field.

- **Searchable settings list**
  - Watch for: upstream lifting the expandable header search out of
    `KeybindingsSettings.tsx` into a shared settings component, or giving
    `SettingsSection` a search affordance of its own.
  - Action: delete `moatless/SectionSearch.tsx` and use upstream's. The fork's
    copy exists only because upstream's is private to one file and hard-codes
    its labels.
