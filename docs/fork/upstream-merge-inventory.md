# Fork upstream merge inventory

This is the mutable fork policy used by the project-local
[`fork-upstream-merge`](../../.agents/skills/fork-upstream-merge/SKILL.md)
skill. Keep stable merge procedure and policy definitions in the skill. Keep
dated merge decisions in [the upstream merge tracker](./upstream-merge-log.md),
and what is still missing — on the backend or here — in
[the fork gaps](./gaps.md).

**The structured half of this policy lives in
[`inventory.json`](./inventory.json), not here.** Fork-owned concerns, path
policy, the fork inventory, deleted-surface tripwires, off-repository state and
the convergence watch list are all entries in that file. They moved there
because they are read far more often by a check than by a person: a path policy
in prose can only be applied by someone reading all of it, while the same
policy as data is applied by

```bash
node .agents/skills/fork-upstream-merge/scripts/preflight.mjs
```

before the merge starts — which is what turns "resolve this conflict, then work
out what the doc says about it" into "resolve this conflict, whose verdict is
already printed next to it".

What stays here is what a check cannot hold: the four re-application deltas,
where the unsupported-method set comes from, and the reasoning behind the path
policy rule.

## Working on inventory.json

Every entry has an `id`, and the checks report against it, so an id is worth
choosing to read well in a failure message.

- `concerns` — the fork-owned concerns. An unlisted file that touches one of
  these is decided and recorded; one that does not takes upstream.
- `pathPolicy` — `paths` (globs), a `verdict`, and a `note` saying what must
  survive. Verdict meanings are defined in the skill.
- `inventory` — deliberate fork changes, each with the `mustSurvive` behavior.
  An entry may carry a `guard`: a symbol that has to stay present in named
  files. Guards are checked twice — by the merge scripts, and by
  `apps/web/src/fork/features.test.ts`, which reads them out of this same file
  so the test and the merge cannot drift apart.
- `tripwires` — deleted surfaces. `expect: "no-matches"` for a surface that is
  gone; `expect: "matches"` for one that is decided but still in the tree,
  where the point is to hold a count steady rather than at zero.
- `deletedUpstreamPaths` — upstream files the fork deletes on purpose. Taking
  upstream on a delete/modify conflict silently restores these.
- `convergence` — surfaces where upstream may take over a fork-built one.
- `offRepo` — the workflow state that lives in GitHub rather than in the tree.

Three checks read it. Run them; do not audit the file by eye:

```bash
# Before merging: the range, stale entries, and the conflict forecast
node .agents/skills/fork-upstream-merge/scripts/preflight.mjs

# Any time: does every path still exist on the side its verdict claims
node .agents/skills/fork-upstream-merge/scripts/inventory-check.mjs

# After merging: tripwires, re-deletions, and GitHub state
node .agents/skills/fork-upstream-merge/scripts/tripwires.mjs
```

## Path policy

An entry may be `ours` only if the path does not exist in `upstream/main`. On a
path upstream still owns, a blanket `ours` discards every upstream change to it,
merge after merge, and reports nothing — a clean, green, quiet merge that threw
upstream's work away. `ours` is for paths upstream does not have, not for paths
the fork feels strongly about. When upstream _adds_ a file under an `ours` path,
that entry splits in the same merge.

`inventory-check.mjs` enforces exactly that rule, in both directions: an `ours`
path that upstream has started shipping fails, and a `decide`/`converged`/
`theirs` path upstream no longer has fails. It is the cheaper way to answer the
question, and the only way that answers it for every entry at once.

The other question an entry needs is whether the fork's side is a delta at all.
`git diff --numstat upstream/main HEAD -- <path>` reporting nothing means the
file is byte-identical to upstream and belongs in no entry.

An unlisted file falls back to the concern rules: inside a fork-owned concern it
is `decide, then add an entry`; outside one it is `theirs`. Both fallbacks are
in `inventory.json` under `fallback`, and `preflight.mjs` prints them whenever
the forecast contains an unlisted file.

### A note on globbing

The scripts match `inventory.json`'s path globs in JavaScript rather than
handing them to git, and that is deliberate. `git ls-tree` treats its path
arguments as leading-directory prefixes while `git ls-files` applies full
pathspec matching, so the same pattern asks two different questions of the two
sides — `.plans/**` matched nothing in a tree and everything in the index. A
check that compares upstream against the working tree cannot use two different
matchers. Write globs with the conventional meaning: `*` and `?` stay inside a
path segment, `**` crosses separators.

## Re-application deltas

Some upstream files carry fork work that cannot be reduced to a verdict, because
the delta has to be re-stated against whatever upstream now looks like rather
than replayed as a patch. These are the entries whose `converged` verdict points
here, and every delta an entry names has a section below —
`inventory-check.mjs` fails when one does not.

### Web Vite Delta

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

### Moatless Spec Check Delta

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

### Mobile Touch Delta

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
- **`Sidebar.tsx` and `LegacySidebar.tsx`** — `useTouchContextMenu(handler)`
  beside the row's existing `onContextMenu` handler, spread onto the row element
  in place of the bare `onContextMenu` attribute. Two rows in `Sidebar.tsx`
  (slim and card), one in `LegacySidebar.tsx`. Upstream renamed both of these on
  2026-08-08 — the file that was `SidebarV2.tsx` is now `Sidebar.tsx`, and the
  old `Sidebar.tsx` is now `LegacySidebar.tsx` — so a merge that predates that
  rename will find this delta under the other names. Behavior that must survive:
  a long press on a thread row opens the same menu a right-click does, and the
  press does not also register as a tap on the row.
- **`contextMenuFallback.ts`** — submenus open on `click` as well as
  `mouseenter`, and the menu's `max-width` is clamped to the viewport. Behavior
  that must survive: a submenu is reachable without a hover, and the menu fits a
  phone. If upstream rewrites the fallback around a real popup primitive, drop
  this delta rather than porting it.

### Message Origin Delta

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

### Mermaid Diagram Delta

Upstream renders every fence as highlighted source, which is right for source
and wrong for a picture. One upstream file carries the addition, and the fork
files it reaches are `apps/web/src/fork/mermaidDiagram.ts` and
`apps/web/src/fork/MermaidDiagram.tsx`. Take upstream first, then re-state:

- **`ChatMarkdown.tsx`** — two imports, and an `if (language ===
MERMAID_FENCE_LANGUAGE)` early return above upstream's own return in the `pre`
  renderer. The branch repeats upstream's `MarkdownCodeBlock` call rather than
  wrapping it, which costs a dozen duplicated lines and buys the thing worth
  more at merge time: upstream's block is left byte-identical, so an upstream
  edit inside it conflicts on the lines it touched instead of on all of them.
  Behavior that must survive: the diagram sits inside upstream's
  `MarkdownCodeBlock`, so the header, the language label and the copy button are
  upstream's and copy still copies the mermaid source; and the highlighted
  source is passed down as children, so a mermaid fence falls back to exactly
  what upstream renders whenever there is no diagram to show.

Four properties of the fork files are load-bearing and are the ones a rewrite
loses quietly, because each shows up as a cost rather than a broken diagram.
Mermaid is imported lazily — it is around a megabyte, and someone who never sees
a diagram should never download it. Renders are serialized, because
`initialize` sets the theme globally and two renders across a theme switch would
otherwise draw one diagram in the other's colors. Rendered SVG is cached, and
read during the first render rather than in an effect, because the message list
is virtualized and a diagram scrolled out of view and back would otherwise flash
its source on every pass. And `securityLevel` is `strict`, because the source is
model-written and arrives over the wire.

If upstream grows any per-language branch in `pre`, a fence-renderer registry,
or mermaid support of its own, drop this delta rather than porting it — see the
`rendered-fences` convergence entry.

### Thread Fork Delta

A Moatless Task can be cut at an earlier turn and continued as a new Task.
Upstream has no such command, so every file below gains something. The fork
files it reaches are `apps/web/src/fork/threadFork.ts` and
`apps/web/src/components/chat/ThreadForkDialog.tsx`. Take upstream first, then
re-state:

- **`contracts/src/orchestration.ts`** — the `thread.fork` command and its
  payload. **`client-runtime`'s `commands.ts` and `threadCommands.ts`** — the
  dispatch path for it, in the same shape as the commands beside it.
- **`MessagesTimeline.tsx`** — a fork icon beside the copy button on an
  assistant message's hover controls, and `MessagesTimeline.logic.ts`'s row
  derivation behind it. Behavior that must survive: the icon stays on a message
  from an already-ended turn while a later turn runs, and hides only on messages
  from the running turn — cutting below the open turn is allowed, cutting at or
  into it is not, which is the backend's own gate restated. A message whose
  Moatless turn number parses below the running turn has settled, so it keeps
  its meta row instead of folding into the active visual response, and
  `AssistantForkButton` offers the action under that same comparison. An
  upstream turn id does not parse and keeps upstream's behavior.
- **`ChatView.tsx`** — the dialog's mount point, and the navigation to the new
  thread through the same wait-for-started-thread and cleanup-on-failure path
  starting a thread from a proposed plan already uses.
- **`apps/server/src/orchestration/decider.ts`** — a deliberate refusal. The
  bundled server has no fork session to resume and must not fabricate a
  session-less copy. That hunk is not an oversight to complete.

`MessagesTimeline.logic.ts` is the one to check after a merge that auto-merged.
It holds behavior upstream can rewrite around without conflicting, and the
fork's own vitest is the only check that sees it — `resolution-check.mjs` reads
conflict-set paths and this file may never appear in one.

### Thread Visibility Delta

A Moatless Task can be made readable by everyone signed in. Upstream's threads
are single-viewer, so the whole item is fork work. Take upstream first, then
re-state:

- **`contracts/src/orchestration.ts` and `environment.ts`** — the
  `thread.visibility.set` command, the `visibility` field on a thread row, and
  the `threadVisibility` capability. The item is gated on the capability because
  it covers both halves: a server sending neither leaves the item out rather
  than showing a control it cannot label.
- **`useThreadActions.ts`, `useThreadActionMenu.ts`, `threadActionMenu.logic.ts`
  and `Sidebar.tsx`** — one menu item on both surfaces, labelled for the level
  the click moves to ("Make public" on a private thread) because a row carries
  no badge. It sits directly above "Archive thread" and opens that group, so it
  takes the group separator `archive` otherwise carries. Upstream's own tail
  tests assert archive's position — "groups project settings with utility
  actions before archive" and "keeps archive last" — so both need the fork's
  one-item shift re-applied rather than reverted.
- Going public confirms first, going private does not. Public is not read-only
  on Moatless: `ScopeContext::can_control` treats it as the whole control grant,
  so a public thread hands every signed-in viewer its turns, terminal, scripts
  and sandbox. **The confirmation copy says so and must keep saying so.**
- The level is sent whole rather than toggled, so two clients that disagree
  about the current value cannot flip each other's write.
- **`decider.ts`** — a refusal; the bundled server has no per-thread read grant
  to move. `LegacySidebar.tsx` builds its own menu array and is deliberately
  left without the item.

### Thread Follow Delta

A Moatless listing is the open work a viewer follows, so a thread reached by
link is readable and absent from the sidebar at the same time. Opening one
follows it. The fork file is `apps/web/src/fork/unlistedThread.ts`; take
upstream first, then re-state:

- **`ThreadRouteView.tsx`** — the `useAutoFollowThread` call. Upstream's #12015
  moved this view out of the route file, and the hook moved with it; it takes
  `target.kind === "server" ? target.threadRef : null`, because a draft's
  reserved ref is the viewer's own work and the listing carries it unasked.
  `inventory.json` guards the symbol in this file for that reason.
- Four conditions bound the auto-follow, and each one is a bug that does not
  happen: it fires once per ref and never after an unfollow, or the menu's
  Unfollow would do nothing on the next render; it decides against the listing's
  own snapshot rather than the grafted one, because the graft is what put the
  thread on screen; it waits for a non-null snapshot, because a listing that has
  not answered was about to carry the thread; and it skips a thread with an
  `archivedAt`, because the sidebar filters those out and a followed closed
  thread is a follow with no row to undo it from.
- **The menu files and `Sidebar.tsx`** — "Unfollow thread" directly below the
  visibility item and above "Archive thread", on both surfaces
  `buildThreadActionMenuItems` serves, opening the archive group when the
  visibility item is absent. Upstream's archive-tail tests need the fork's
  two-item shift re-applied. No confirmation: the thread keeps running and only
  this viewer's listing changes.
- Both halves are gated on the `threadFollow` capability, and **`decider.ts`**
  refuses both commands — the bundled server lists every thread it stores and
  has no per-viewer listing to move one into.

### Thread Owner Name Delta

A Moatless sidebar lists work other people started, so a row that is not yours
says whose it is. Two upstream files. Take upstream first, then re-state:

- **`contracts/src/orchestration.ts`** — `ownerName` on
  `OrchestrationThreadShell` only, beside `visibility`.
- **`Sidebar.tsx`** — two elements inside `SidebarThreadRow`: the name on the
  card meta line directly left of the environment and provider glyphs,
  truncated, and the whole name on the owner line of the row tooltip. Additive,
  and outside upstream's aria-hidden icon cluster.

No capability gates this. The client is never told which user it is signed in
as, so the server decides: Moatless sends the name only when the Task's owner is
not the viewer, and null otherwise, which means absence and null both read as
"yours, or a server that does not send it" and a row without one renders exactly
as upstream's does. The slim settled and snoozed rows are deliberately left
without it — they carry no provider glyph either, and their point is a quiet
tail.

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
  split moved it. A sandbox has no checkout of that repository, so it is read
  over the API.

Both directions matter, and both are findings. A method the backend has started
serving keeps a union entry that can never fire; a method it has stopped serving
loses the typed refusal the client renders.

Dispatched is not the same as never refuses. An arm that can still reach
`unsupported_exit` refuses conditionally, so its union member has to stay — those
are reported separately rather than as entries to drop.

Run the derivation:

```bash
node .agents/skills/fork-upstream-merge/scripts/unsupported-methods.mjs
```

It reads both sides and buckets the result into ADD, DROP and KEEP. No list of
methods is kept in this file, because a list here would be a copy of the answer
that goes stale the moment either side moves — which is what happened to the
list that used to be here. Standing drift, and why it has not been acted on, is
an entry in [the fork gaps](./gaps.md).

## Off-repository state

Some fork decisions are enforced in GitHub rather than in the tree, so a merge
cannot see them and a clone does not carry them: inherited upstream workflows
are switched off in repository settings, not deleted.

A workflow upstream adds later arrives `active`. That makes this the check that
fails _after_ a merge rather than before one — `preflight.mjs` warns that a new
workflow file is coming, and `tripwires.mjs` is what catches it once it has
landed. Switch the new file off with
`gh workflow disable <name> --repo soaplabs/t3code` and record it in the tracker
entry.

Which workflows are allowed to be active is `offRepo.allowedActiveWorkflows` in
`inventory.json`; `tripwires.mjs` queries the live list and reports anything
else.
