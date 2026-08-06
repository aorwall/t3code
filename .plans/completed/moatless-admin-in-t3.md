# Moatless administration as T3 Code settings pages

> **Status:** shipped
> **Updated:** 2026-08-06
> **Vocabulary:** CONTEXT.md (moatless repo)

**What shipped (2026-08-06).** Every surface in this spec is built. Workspaces and its Repositories
catalog landed first (#49, #50); Secrets, Loops, Integrations, Skills and Users were built on their
own branches and then combined into one change, each verified in the browser against staging and
each write path exercised on throwaway records.

Combining them was the right call rather than a convenience: all five extend the deliberately-shared
`apps/web/src/components/settings/moatless/queries.ts`, so as separate branches they conflicted
pairwise on its import block and export list — and a hand-resolved import block is where a query
quietly goes missing. Merged as one change the resolution happens once, under one type check. Two
real defects fell out of doing it that way and would have been easy to miss four times over: a
duplicated `RepositoryResponse` type import, and a dropped `import {` opener on the plugins block.

Combining also unblocked the two follow-ups this spec had been deferring, because both were blocked
only by the surfaces being separate PRs: `NotInT3Yet.tsx` is deleted — no surface renders a
placeholder any more, so the file its own comment said to remove with the last usage is gone — and
this spec moves to `.plans/completed/`.

## Current solution

Moatless administration lives entirely in the Moatless SPA (`moatless` repo, `apps/frontend`).
T3 Code serves the chat surface against the same backend and has no administrative surface at all.
The work is to build the administrative surface a second time, in T3, over the REST API that already exists.

Both repositories are checked out side by side in this workspace: `moatless/` and `t3code/`.
Paths below are prefixed with the repository when ambiguous.

### Anchors — where the change lands

**T3 settings shell (all edited):**

| Path | What it is | What happens to it |
|---|---|---|
| `t3code/apps/web/src/components/settings/settingsLayout.tsx:91` | `SettingsSection` — title, optional `icon`, `headerAction`, children | Used unchanged |
| `t3code/apps/web/src/components/settings/settingsLayout.tsx:125` | `SettingsRow` — `title`/`description`/`status`/`control`/`resetAction` grid | Used unchanged |
| `t3code/apps/web/src/components/settings/settingsLayout.tsx:202` | `SettingsPageContainer` | Used unchanged |
| `t3code/apps/web/src/components/settings/itemRows.ts` | `ITEM_ROW_CLASSNAME`, `ITEM_ROW_INNER_CLASSNAME` | Used unchanged for list rows |
| `t3code/apps/web/src/components/settings/SettingsSidebarNav.tsx:47` | `SETTINGS_SECTION_ICONS` | Gains one entry per new page |
| `t3code/apps/web/src/components/settings/SettingsSidebarNav.tsx:60` | `SETTINGS_NAV_ITEMS`, derived from `SETTINGS_SECTION_LABELS` | Gains the administration group |
| `t3code/apps/web/src/components/settings/SettingsSidebarNav.tsx:287` | Nav render, already filtered by `settingsPathEnabled` | Gains the admin-role filter |
| `t3code/apps/web/src/components/settings/settingsSearch.ts` | `SETTINGS_SECTION_LABELS`, `SettingsPath`, `searchSettings` | Gains the new paths and their search items |
| `t3code/apps/web/src/routes/settings.tsx` | `beforeLoad` redirect for disabled paths | Gains the admin-role redirect |
| `t3code/apps/web/src/routes/settings.providers.tsx` | Route file shape: `createFileRoute` returning one panel component | Copied for each new route |
| `t3code/apps/web/src/components/settings/SettingsPanels.tsx:2003` | `ProviderSettingsPanel` — the list-with-`headerAction` precedent | Read, not edited |
| `t3code/apps/web/src/fork/features.ts:65,78,92` | `projectManagement`, `serverAdministration`, `connections` | Deleted with their gates when their surfaces land |

**T3 data layer:**

| Path | Fact |
|---|---|
| `t3code/apps/web/package.json:20-48` | **No `@tanstack/react-query`.** Dependencies are `effect`, `@effect/atom-react`, `zustand`, `@tanstack/react-router` |
| `t3code/packages/client-runtime/src/state/runtime.ts:480` | `createEnvironmentQueryAtomFamily` — the socket-backed query helper |
| `t3code/packages/client-runtime/src/state/runtime.ts:516` | `if (generation === null) return Effect.never` — the reason it cannot be reused |
| `t3code/packages/client-runtime/src/state/runtime.ts:522` | `Atom.swr({ staleTime, revalidateOnMount })` — the caching primitive to reuse |
| `t3code/packages/shared/src/devProxy.ts` | Vite dev proxy; already forwards `/api` |
| `t3code/apps/web/src/index.css:853` | Light-theme tokens; identical names to the SPA's |
| `t3code/docs/fork/upstream-merge-inventory.md` | Fork path policy — `ours` / `converged` / `decide` / `theirs` |

**Moatless side (read-only for this change except `CONTEXT.md`):**

| Path | Fact |
|---|---|
| `moatless/packages/api-client/orval.config.ts` | Orval config, `client: "react-query"`, input `../../openapi-specs.json` |
| `moatless/packages/api-client/package.json:32-35` | `generate:spec` runs `cargo run -- --dump-openapi`; `generate:client` runs orval |
| `moatless/packages/api-client/custom-instance.ts:28` | `errorMessage(status, statusText, body)` — reads `{error}`, `{error:{message}}`, `{message}`, `{detail}` |
| `moatless/apps/frontend/src/routes/admin.tsx` | The SPA's admin role guard |
| `moatless/apps/frontend/src/features/workspaces/components/workspace-repos-panel.tsx:93` | `ConfigurationGroup title="Repositories"` — placement list with primary/remove |
| `moatless/apps/frontend/src/features/workspaces/components/workspace-repos-panel.tsx:277` | Add-repository dialog: Repository select, Branch, Mount name |
| `moatless/apps/frontend/src/features/loops/components/loop-form.tsx:499` | Loop's repository picker |
| `moatless/apps/frontend/src/lib/hooks/use-dirty-form.ts` | 30-line zero-dependency dirty tracking; ports verbatim |
| `moatless/crates/t3code/src/commands.rs:118` | `project.create` / `project.meta.update` / `project.delete` refusal |
| `moatless/backend/src/loops/dao.rs:404` | `ScopeContext.is_admin` read in a DAO — authorization is not in the transport |
| `moatless/k8s/helm/moatless-vibe/templates/app-ingressroute.yaml:149` | Traefik matches `PathPrefix('/api')` on the T3 host as well as the app host |

**Backend endpoints the pages call.** None are added, changed or removed.

| Group | Endpoints |
|---|---|
| Workspaces | `GET/POST /api/v1/workspaces`, `GET/PUT/DELETE /api/v1/workspaces/{id}`, `POST …/override`, `POST …/reset-git`, `POST …/repos`, `PUT/DELETE …/repos/{placement_id}`, `POST …/repos/{placement_id}/primary` (`moatless/backend/src/workspace/handlers.rs:130,219,249,268,330,368,431,536,615,660`) |
| Repositories | `POST/GET /api/v1/repositories`, `GET/PUT/DELETE /api/v1/repositories/{id}`, `POST …/verify-access`, `GET …/branches` (`moatless/backend/src/repository/handlers.rs:47,164,182,209,338,427,549`) |
| Repositories — not reached from T3 | `POST …/convert-to-template` (`:497`), `POST …/sync-config` (`:1075`) |
| Plugins / Skills | `GET/POST /api/v1/plugins`, `GET/DELETE /api/v1/plugins/{id}`, `GET …/skills`, `GET …/activations`, `PUT …/activation`, `DELETE …/activation?reach=`, `GET /api/v1/plugins/effective` (`moatless/backend/src/plugin/handlers.rs:34,53,97,126,166,209,256,302`) |

### What the code does not say

**T3's query machinery is transport-agnostic but must not be reused here.**
`createEnvironmentQueryAtomFamily` takes any `Effect`, so a REST call would type-check.
It returns `Effect.never` until the environment socket reports a connected generation
(`runtime.ts:516`). An admin page built on it goes blank every time the chat socket reconnects,
for data that never needed the socket. The new helper reuses `Atom.swr` and nothing else.

**T3 has no react-query.** The Moatless SPA's generated client is `client: "react-query"` mode.
Generating the same way in T3 would add TanStack Query as a dependency for the admin pages alone.
Orval's `fetch` mode emits plain functions and is what the fork uses.

**`@moatless/api-client` cannot be imported across repositories.**
It is a workspace package inside the `moatless` repo (`packages/api-client`), and T3 is a separate
git repository with its own lockfile. The fork generates its own client from a checked-in copy of
`openapi-specs.json`.

**Authorization is not in the transport.** It is `ScopeContext.is_admin`, read inside the DAOs
(`moatless/backend/src/loops/dao.rs:404`). Every nav gate and route guard added in T3 is cosmetic;
the server refuses a non-admin either way. This is why the rollout can be partial without a
security review per page.

**REST already reaches T3's origin.** Traefik matches `PathPrefix('/api')` against the T3 host as
well as the app host (`app-ingressroute.yaml:149`), and the Vite dev proxy already forwards `/api`.
No CORS configuration, no new ingress rule, same session cookie.

**A plugin-level activation is a default, not a gate.** Precedence in
`moatless/backend/src/plugin/activation.rs:51` is one ladder over specificity:
`(Personal, skill)=4 > (Personal, plugin)=3 > (Everyone, skill)=2 > (Everyone, plugin)=1`.
A global skill record therefore outranks a global plugin record, so **source off + skill on delivers
the skill**. A Skills page that renders a source row as a gate over its children renders a state the
backend can produce as impossible. A plugin-level record also "speaks for every skill the plugin has
*now*, including ones added by a sync after the record was written" (`:79`, test at `:359`), and
nothing is delivered without a record at all (`:221`).

**`GET /api/v1/repositories/{id}/skills` already returns both skill sources, merged.**
"The repository's own skills plus the plugin skills their activation records resolve to",
deduplicated by name — repository shadows plugin, first plugin wins among plugins
(`moatless/backend/src/skill/service.rs:80`). The plugin half is per-caller (`:86`).
`SkillSource { Workspace, Plugin }` is already on the wire
(`moatless/crates/api-schemas/src/skill.rs`).

**Registering a repository already creates Workspaces.** `POST /api/v1/repositories` runs
`sync_repo_workspaces` in the same request, reconciling any `.moatless/workspaces.json` the repo
declares (`moatless/backend/src/repository/handlers.rs:47`). An admin who registers a repository
that declares workspaces gets those workspaces without a second action.

**`RepositoryKind::Template` marks a repository deliberately in no Workspace**
(`moatless/backend/src/sandbox/preflight.rs:202`). This is why `convert-to-template` has no home on
a Workspace page.

**Teams grant no access.** Nothing in the backend consults a Team for authorization, which is why
the surface is dropped rather than ported.

## Planned solution

**New**

- `t3code/packages/moatless-api/` — fork-only package: checked-in `openapi-specs.json`, orval config in `fetch` mode, generated client, and a `customInstance` mutator.
- `t3code/apps/web/src/moatless/query.ts` — `Atom.swr`-backed query and command helpers that never touch the socket.
- `t3code/apps/web/src/moatless/session.ts` — the viewer's Moatless role, read once.
- `t3code/apps/web/src/components/settings/moatless/` — one panel component per administrative surface.
- `t3code/apps/web/src/routes/settings.workspaces.tsx` and six siblings, plus four `$id` detail routes.
- `t3code/apps/web/src/components/settings/moatless/NotInT3Yet.tsx` — the placeholder a surface showed until its real panel landed. Deleted once the last surface shipped; it exists nowhere in the final tree.

**Changes materially**

- `t3code/apps/web/src/components/settings/SettingsSidebarNav.tsx:47,60,287` — the nav gains an administration group and an admin-role filter.
- `t3code/apps/web/src/components/settings/settingsSearch.ts` — new paths, labels and search items.
- `t3code/apps/web/src/routes/settings.tsx` — `beforeLoad` also redirects a non-admin away from an administration path.
- `t3code/apps/web/src/fork/features.ts:65,78,92` — `projectManagement`, `serverAdministration` and `connections` are deleted along with every gate naming them, once their surfaces land. Per the file's own rule this is deletion, never `false` → `true`.
- `t3code/docs/fork/upstream-merge-inventory.md` — gains a row per new fork-owned path and updates the settings-gate rows.
- `moatless/CONTEXT.md` — the `Skill` and `Plugin` entries; see "Vocabulary changes".

**Untouched**

- `moatless/backend/**` — no endpoint, scope, DAO or authorization path changes.
- `moatless/apps/frontend/**` — the SPA keeps working exactly as it does today and keeps serving every administrative route, including the two this plan does not port.
- `moatless/crates/t3code/**` — the compatibility surface, shell snapshot, listing feed and socket are unchanged. `commands.rs:118` keeps refusing `project.*` writes; those writes are not what the new pages use.
- `t3code/packages/contracts/**` — no RPC method, no schema, no `RpcGroup` member. This is the whole point of choosing REST.
- `t3code/apps/server/**` — upstream's Node server needs no new stub, because no contract method was added.
- `t3code/apps/web/src/components/ui/**` — every primitive is used as it stands. No new primitive, no variant added.
- Traefik, ingress and CORS configuration.
- The `moat` CLI and every API-level test in `moatless/tests/`.

### Problem

An operator running a deployment where T3 Code replaces the Moatless SPA on the application host
(`t3.host` empty, `moatless/k8s/helm/moatless-vibe/values.yaml:118`) cannot administer it.
They cannot register a repository, compose a Workspace, wire a Loop, add a Secret, turn on a Skill,
or add a user. Work continues only on the Workspaces that already exist, because
`project.create`, `project.meta.update` and `project.delete` are refused
(`moatless/crates/t3code/src/commands.rs:118`) and the surfaces that would do the rest were never
built in T3.

An administrator on a deployment that serves both hosts can do all of it, but must keep two
applications open and learn two navigation models for one system.

### Behaviour

**As an administrator, in T3:**

| # | Given | When | Then |
|---|---|---|---|
| 1 | I am signed in and my Moatless role is `admin` | I open Settings | An **Administration** group appears in the settings nav below the personal sections |
| 2 | My role is not `admin` | I open Settings | The administration group is absent, and typing an administration URL redirects me to `/settings/general` |
| 3 | My role is not `admin` and I force a request anyway | The request reaches the backend | It is refused by the DAO, regardless of what the nav showed |
| 4 | I am an admin on a deployment with no Workspaces | I open Settings → Workspaces → **+**, name it, and save | The Workspace exists, and I land on its detail page |
| 5 | I am on a Workspace detail page | I open **Add repository**, choose *Register a new one*, paste a remote URL, and save | The Repository is registered, any workspaces its `.moatless/workspaces.json` declares are reconciled, and the repository is placed in this Workspace — primary if it is the first |
| 6 | A Workspace has two or more repositories | I set a non-primary one as primary | Exactly one placement is primary, and the change is visible without a reload |
| 7 | I am on a Workspace detail page | I edit the name and navigate away without saving | I am warned that changes are unsaved |
| 8 | A Workspace's `source` is `git` | I open it | A banner says it is declared in a repository, and editing requires an explicit override |
| 9 | I open Settings → Skills | The page loads | Each registered Plugin is a section whose header row is the source's own default, and each Skill it delivers is a row beneath it |
| 10 | A source's default is off and one of its skills has a global record turning it on | I open Settings → Skills | The source row reads default-off and the skill row reads on — not a contradiction, and not silently corrected |
| 11 | A skill has no record of its own | I open Settings → Skills | Its control reads **Inherit**, showing the resolved value, and is visibly distinct from off |
| 12 | A skill's control is on Inherit | I set it to on for Everyone | `PUT /api/v1/plugins/{id}/activation` is sent with that `skill_name` and reach, and the row stops reading Inherit |
| 13 | A skill has a record of its own | I clear it | `DELETE /api/v1/plugins/{id}/activation?reach=…` is sent and the row returns to Inherit — not to off |
| 14 | I open a surface that is not built yet | The page loads | It names the surface, says administration for it still happens in Moatless, and offers a link that opens the same page there in the same session |
| 15 | My session expires while a page is open | I trigger any request | I am returned to login, not to an error boundary |
| 16 | The chat socket is disconnected or reconnecting | I use any administration page | It loads and saves normally |

**As an operator:**

| # | Given | When | Then |
|---|---|---|---|
| 17 | I deploy a build whose checked-in `openapi-specs.json` is older than the backend | CI runs | The staleness check fails with the diff, before the build ships |
| 18 | I serve T3 on its own host | An administration page issues a request | It reaches `/api/v1/*` on the same origin with the existing session cookie |

### Architecture and key flows

#### `t3code/packages/moatless-api/` — the generated Moatless REST client

- **Observed:** does not exist. The Moatless repo generates its own client at
  `moatless/packages/api-client` with orval from `moatless/openapi-specs.json`
  (`orval.config.ts`), in `client: "react-query"` mode.
- **Proposed responsibility:** the only place in T3 that knows the shape of a Moatless endpoint.
- **Proposed change:** new workspace package. Contents:
  - `openapi-specs.json` — a checked-in copy of the backend's dumped description. Checked in rather
    than fetched, because a build must not depend on a running backend and a lockstep repo pair must
    be able to diverge deliberately.
  - `orval.config.ts` — `client: "fetch"`, `mode: "tags-split"`, `mutator` pointing at
    `./customInstance.ts`. **Not `react-query`:** `t3code/apps/web/package.json` has no
    `@tanstack/react-query`, and adding one for the admin pages alone is a dependency the fork would
    carry through every upstream merge.
  - `customInstance.ts` — same-origin `fetch`, `credentials: "include"`, JSON body pass-through,
    and an error message extracted from the body. Port `errorMessage` verbatim from
    `moatless/packages/api-client/custom-instance.ts:28`; it already handles the four body shapes
    this API returns, and HTTP/2 makes `statusText` useless.
  - `src/` — generated output, checked in, so a clone builds without running orval.
- **Evidence:** `moatless/packages/api-client/orval.config.ts`,
  `moatless/packages/api-client/package.json:32-35`, `t3code/apps/web/package.json:20-48`.

The package is fork-owned in full. Add it to `docs/fork/upstream-merge-inventory.md` as `ours`.

#### `t3code/apps/web/src/moatless/query.ts` — the REST query and command helpers

- **Observed:** `createEnvironmentQueryAtomFamily`
  (`t3code/packages/client-runtime/src/state/runtime.ts:480`) is T3's query helper. It gates on the
  environment socket generation and returns `Effect.never` until connected (`:516`), then wraps the
  result in `Atom.swr` (`:522`).
- **Proposed responsibility:** caching, staleness and refetch for a Moatless REST call, with no
  dependency on the chat socket.
- **Proposed change:** new module exporting
  - `moatlessQuery(key, execute, options?)` — `Atom.family` keyed by a serialised key, wrapping
    `Atom.swr({ staleTime: 30_000, revalidateOnMount: true })`. Same primitive, no generation gate.
  - `moatlessCommand(execute)` — a write, returning a result the caller can branch on, and
    invalidating the keys it names on success.
  - `invalidate(prefix)` — used after writes so a detail page and the list behind it agree.
- **Evidence:** `runtime.ts:480-530`.

This module is fork-only and lives in `apps/web/src`, not in `packages/client-runtime`.
`client-runtime` is a `converged` path in the merge inventory; adding a fork-only module there
creates a conflict on every upstream merge for no benefit, because nothing outside the web app uses it.

#### `t3code/apps/web/src/moatless/session.ts` — the viewer's role

- **Observed:** T3 has its own session bootstrap; nothing in it carries a Moatless role.
  The SPA guards `/admin` on `session?.user?.role !== 'admin'`
  (`moatless/apps/frontend/src/routes/admin.tsx`).
- **Proposed responsibility:** answer "is this viewer a Moatless admin", once, for the nav and the
  route guard.
- **Proposed change:** a single query over `GET /api/v1/auth/me`, exposed as an atom.
- **Evidence:** `moatless/apps/frontend/src/routes/admin.tsx`.

This is cosmetic by design. It decides what is *shown*. It is not a security boundary and must not
be described as one in code comments — the boundary is `ScopeContext.is_admin` in the DAOs
(`moatless/backend/src/loops/dao.rs:404`).

#### The settings shell — nav, search and route guard

- **Observed:** `SETTINGS_NAV_ITEMS` is derived from `SETTINGS_SECTION_LABELS`
  (`SettingsSidebarNav.tsx:60`); the render filters on `settingsPathEnabled`
  (`:287`); `/settings`'s `beforeLoad` redirects a typed URL for a disabled path
  (`routes/settings.tsx`); search reads the same registry (`settingsSearch.ts`) and is already
  filtered by `settingsPathEnabled` (`SettingsSidebarNav.tsx:86`).
- **Proposed responsibility:** unchanged — one registry, one filter.
- **Proposed change:** add the administration paths to the registry, add their icons, and extend the
  existing filter with the admin-role predicate. Group the administration entries under a
  `SidebarGroup` label so they read as a section rather than as more personal settings.
- **Evidence:** `SettingsSidebarNav.tsx:47,60,86,287`, `fork/features.ts:126,135`.

Keep the role predicate to a single expression at each of the two call sites, in the style
`fork/features.ts` sets out in its "Keeping the merge cost down" section: no new props, no hooks
threaded through upstream components. That is what lets git carry the change through an upstream
rewrite nearby.

Adding rows to `settingsSearch.ts` is not optional. Every section and every row carries an `id`, and
`SettingsSection`/`SettingsRow` already wire `id` to a scroll-and-pulse target
(`settingsLayout.tsx:104,142`). A page whose rows have no ids is a page the search cannot reach, and
the search is the second way into every section.

#### The panels — one per surface

- **Observed:** `ProviderSettingsPanel` (`SettingsPanels.tsx:2003`) is the precedent: a
  `SettingsPageContainer`, one `SettingsSection` with a `headerAction` holding icon buttons for add
  and refresh, then rows.
- **Proposed responsibility:** one administrative surface each.
- **Proposed change:** new files under `components/settings/moatless/`, one per surface, plus the
  route files that render them. Do **not** add them to `SettingsPanels.tsx`: that file is
  `decide` in the merge inventory and is already ~2,500 lines. A new file per panel keeps every
  administration change out of the path upstream edits most.
- **Evidence:** `SettingsPanels.tsx:2003-2090`, `docs/fork/upstream-merge-inventory.md`.

| Route | Panel | Sections |
|---|---|---|
| `/settings/workspaces` | `WorkspacesPanel` | Workspaces (list, `headerAction` = add) |
| `/settings/workspaces/$id` | `WorkspaceDetailPanel` | General · Repositories · Run configuration · Access · Danger |
| `/settings/loops` | `LoopsPanel` | Loops (list, add) |
| `/settings/loops/$id` | `LoopDetailPanel` | The loop form |
| `/settings/integrations` | `IntegrationsPanel` | Connections · Apps · GitHub |
| `/settings/integrations/connections/$id` | `ConnectionDetailPanel` | Per-adapter configuration |
| `/settings/skills` | `SkillsPanel` | One section per Plugin source |
| `/settings/secrets` | `SecretsPanel` | Secrets |
| `/settings/users` | `UsersPanel` | Users |
| `/settings/users/$login` | `UserDetailPanel` | One user |

The detail route's file is `settings.workspaces_.$workspaceId.tsx`, with the trailing underscore
TanStack Router reads as "do not nest under the segment before me" (the same convention as
`connect_.callback.tsx`). Without it the file-based tree makes `settings.workspaces.tsx` the
detail route's parent, and that file renders `WorkspacesPanel` with no `<Outlet />` — so the
detail page never mounts and `/settings/workspaces/ws_…` silently renders the list.

#### Key flow — reading an administration page

1. The viewer opens an administration route.
2. `beforeLoad` checks the role atom; a non-admin is redirected to `/settings/general`.
3. The panel reads its list atom; `Atom.swr` serves any cached value and revalidates.
4. `customInstance` issues a same-origin `fetch` with `credentials: "include"`.
5. Traefik routes `/api` on the T3 host to the backend (`app-ingressroute.yaml:149`).
6. The DAO applies `ScopeContext.is_admin` and returns rows or refuses.

No step touches the chat socket. This is the property that makes step 3 safe while the socket is
reconnecting, and it is the reason `createEnvironmentQueryAtomFamily` is not reused.

#### Key flow — adding a repository to a Workspace

This is the only flow where one user action issues two writes, and the only place the two folded
surfaces meet.

1. The admin opens **Add repository** on a Workspace detail page.
2. They either pick a registered Repository, or choose *Register a new one* and paste a remote URL.
3. If registering: `POST /api/v1/repositories`. This also reconciles any `.moatless/workspaces.json`
   the repository declares, creating Workspaces (`repository/handlers.rs:47`).
4. `POST /api/v1/workspaces/{id}/repos` with the repository id, optional branch override and optional
   mount name.
5. Both the Workspace detail and the Workspaces list are invalidated. Step 3 can create Workspaces,
   so the list is invalidated even though the action targeted one Workspace.

**Step 3 succeeding and step 4 failing leaves a registered Repository in no Workspace.** That is a
valid state, not corruption — a Repository is a first-class record with its own lifecycle. See
"Failure, safety and recovery".

#### Key flow — resolving what the Skills page displays

Rendering a skill row correctly requires the same precedence the backend applies. The page must not
re-implement it.

1. `GET /api/v1/plugins` lists sources.
2. `GET /api/v1/plugins/{id}/skills` lists each source's skills.
3. `GET /api/v1/plugins/{id}/activations` lists the records that exist.
4. `GET /api/v1/plugins/effective` gives the resolved set for the viewer.

A row's control shows **its own record** when step 3 has one at that reach, and **Inherit** when it
does not — with the inherited value taken from step 4, never recomputed in the client.
The precedence ladder lives in `moatless/backend/src/plugin/activation.rs:51` and is the backend's
to own; a second implementation in TypeScript is a second thing to keep correct and the first to
drift.

### Interfaces and contracts

#### External contracts

| Consumer | Interface | What it relies on | Status |
|---|---|---|---|
| T3 administration panels | Moatless REST `/api/v1/*`, through `@t3tools/moatless-api` | Request and response shapes exactly as `openapi-specs.json` declares them | New consumer, existing contract |
| T3 nav and route guard | `GET /api/v1/auth/me` → `user.role` | Whether to show the administration group. Cosmetic; the server enforces regardless | New consumer, existing contract |
| The fork's merge process | `docs/fork/upstream-merge-inventory.md` | Every new path recorded, so a future merge knows it is fork-owned | Changed |
| The paired T3 client | `moatless/crates/t3code` WS and shell surface | The same shapes it reads today | Unchanged |
| The Moatless SPA | Everything it uses today | Unchanged — it remains the only surface for `convert-to-template`, `sync-config`, Teams and Task Connections | Unchanged |

The checked-in `openapi-specs.json` is a contract with the Moatless backend, held across two
repositories. It is the one interface here that can go stale silently, which is what the staleness
check in "Testing and verification" exists to prevent.

#### Internal interfaces

These are implementation boundaries. They may change shape without a spec update, provided the
external contracts above hold.

- `moatlessQuery` / `moatlessCommand` / `invalidate` in `apps/web/src/moatless/query.ts`.
- The panel component boundary in `components/settings/moatless/`.
- The generated client's module layout under `packages/moatless-api/src/`.

#### Vocabulary changes — `moatless/CONTEXT.md`

This plan contradicts two committed glossary entries and amends both. The amendments are part of
this change, not follow-up work.

**`Skill`** currently reads "One capability inside a Plugin". The shipped contract says otherwise:
`SkillSource { Workspace, Plugin }` is on every `SkillResponse`
(`moatless/crates/api-schemas/src/skill.rs`), and `GET /api/v1/repositories/{id}/skills` returns both
sources merged and deduplicated (`moatless/backend/src/skill/service.rs:80`). The entry becomes
source-qualified: a Skill is a `SKILL.md` and the files beside it, derived from a **Repository**
(`.claude/skills/`, committed) or a **Plugin** (registered, synced, activation-resolved). The rest of
the existing entry — identified by directory name, stored in `plugin_skills`, pointed at by an
Activation — describes the Plugin-sourced half and must say so.

**`Plugin`** currently ends "and the admin page is Plugins". That clause is replaced: a Plugin is a
**Skill source**, and the administration page is **Skills**, grouped by source. The rest of the entry
stands — the table is `plugins`, the DAO is `PluginDao`, the API is `/api/v1/plugins`, and the row
that registers one still says Plugin. One-word-everywhere is not weakened; the page was never
configuring plugins, because resolution never yields one
(`moatless/backend/src/plugin/activation.rs:43`).

**`T3 Project` is not amended.** Its `Avoid` line — do not rename Workspace to Project "before T3
Code can compose repositories" — stands as written. T3's administration page is called **Workspaces**.

**Debt to record, not to pay here.** `SkillSource::Workspace` names a skill scanned from a
*Repository*'s `.claude/skills/`; the service is keyed `workspace:{repository_id}` and reads through
`RepositoryDao` (`moatless/backend/src/skill/service.rs:1-7`). Once one Workspace composes several
repositories, "workspace skill" does not say which repository it came from. The enum should read
`Repository`. That is a wire change and is out of scope; record it in the `Skill` entry the way the
Loop `repository_id` debt is already recorded in the `Loop` entry.

### Failure, safety and recovery

| Condition | State before | State after | What the caller sees | Retry safe | Handling |
|---|---|---|---|---|---|
| Session expired (401) on any request | Signed in | Signed out | Returned to login, not an error boundary | Yes, after login | One place in `customInstance`; matches `moatless/apps/frontend/src/routes/admin.tsx` |
| Non-admin reaches an endpoint (403) | Any | Unchanged | The page explains the refusal and does not offer the control again | No | The nav should already have hidden it; a 403 means the role atom is stale, so refetch it |
| Backend unreachable | Any | Unchanged | The section shows a failure with a retry, and the rest of the page still renders | Yes | Per-section, not per-page: one failed list must not blank a detail page |
| Chat socket down | Any | Unchanged | Nothing — administration pages are unaffected | n/a | Guaranteed by not using `createEnvironmentQueryAtomFamily` |
| Repository registered, placement fails | No Repository | Repository exists, in no Workspace | An error naming both halves: the repository was registered, adding it here was not | Yes — retry places the existing Repository | Do not delete the Repository. It is a first-class record and may be in use elsewhere by the time the retry runs |
| Registering a repository whose remote URL already exists | Repository exists | Unchanged | The existing Repository, offered for placement instead | Yes | Prefer detecting this before writing, by matching the URL against the list |
| Concurrent primary-flag changes | One primary | One primary | The winning value | Yes | The backend keeps exactly one placement primary (`workspace/handlers.rs:660`); the client refetches rather than assuming its own write won |
| Unsaved edits, navigating away | Dirty form | Unchanged | A warning | n/a | Port `moatless/apps/frontend/src/lib/hooks/use-dirty-form.ts` verbatim — 30 lines, no dependencies |
| Editing a `git`-sourced Workspace | `source = git` | Unchanged until overridden | A banner saying it is declared in a repository, and that editing requires an override | n/a | `POST /api/v1/workspaces/{id}/override` is explicit and keeps provenance; never override implicitly on the first keystroke |
| Checked-in `openapi-specs.json` older than the backend | Building | Build fails | CI failure with the diff | n/a | See "Testing and verification" |
| A surface's route exists but the panel does not | n/a | Unchanged | A placeholder saying so | n/a | `NotInT3Yet`, parameterised by surface — the transitional state during rollout; no surface is in it now |

**The two repository operations with no Workspace to live on.** `convert-to-template`
(`moatless/backend/src/repository/handlers.rs:497`) marks a Repository deliberately in no Workspace
(`sandbox/preflight.rs:202`), and `sync-config` (`:1075`) runs one repository to *many* Workspaces.
Neither belongs on a page scoped to one Workspace. Both stay in the SPA. The single-Workspace case of a re-sync is already served by
`POST /api/v1/workspaces/{id}/reset-git` (`workspace/handlers.rs:431`), which the Workspace detail
page does offer.

**The Loop form's repository picker.** `loop-form.tsx:499` picks a `repository_id`, and
`CONTEXT.md`'s `Loop` entry already records this as open rename debt — "the config targets a
`repository_id` but a Loop should target a Workspace … reworked in tickets 04/05". Folding the
Repositories page does not remove `GET /api/v1/repositories`, so the picker keeps working over what
was registered through Workspaces. **Label it Repository, not Workspace**, because that is what the
field is. It becomes a Workspace picker when that debt is paid, not before. Do not paper over it by
showing Workspace names against a repository id.

**Partial rollout is the expected state, not a failure mode.** Decision 3 on the approved page: T3
is the surface admins are pointed at from day one, and a surface not yet built renders a placeholder
naming what is missing. No browser test guards Moatless administration today, so a partial rollout
regresses nothing.

The placeholder does not link to the same surface in the SPA, which is a change from the approved
page. A link out of settings into a second application makes the sidebar a menu of two products, and
it ties every unfinished surface to a deployment-shaped environment variable that has to be right in
every build. Saying what is missing costs an admin one extra step and keeps this build one product.

### Testing and verification

**Seams.** The panels are thin: they read atoms and render T3 primitives. The logic worth testing
sits below them, and each piece has a seam that does not need a browser.

| Seam | Module | What is proven |
|---|---|---|
| Pure logic | `apps/web/src/components/settings/moatless/skillRows.ts` | Given plugins, skills, activations and the effective set, the rows a Skills section renders — including source-off-with-skill-on, and Inherit versus off |
| Pure logic | `apps/web/src/components/settings/moatless/workspaceSummary.ts`, `workspaceDetail.ts` | Ordering, primary selection, and which invalidations a placement change implies |
| Query helper | `apps/web/src/moatless/query.ts` | A query resolves without any socket state present; `Atom.swr` serves cached then revalidates; `invalidate` refetches the named keys |
| HTTP mutator | `packages/moatless-api/customInstance.ts` | `errorMessage` extracts from `{error}`, `{error:{message}}`, `{message}`, `{detail}`; a 401 raises the signed-out path; an empty `statusText` never reaches the UI |
| Nav and guard | `SettingsSidebarNav`, `routes/settings.tsx` | An admin sees the group; a non-admin does not and is redirected; search returns administration items only for an admin |
| Contract | `packages/moatless-api` | The checked-in `openapi-specs.json` matches the backend's dump |

T3 uses `vite-plus` and `msw` (`apps/web/package.json`). Follow the existing co-located
`*.test.ts` / `*.test.tsx` convention — `settingsLayout.test.tsx` and `settingsSearch.test.ts` are
the nearest precedents.

**Commands.**

```
# unit and component, from t3code/
bun run test

# type check
bun run typecheck

# regenerate the client after refreshing the spec, from t3code/packages/moatless-api/
bun run generate

# refresh the spec from a built backend, from moatless/
cargo run --manifest-path backend/Cargo.toml -- --dump-openapi > openapi-specs.json
```

**The staleness check.** Add a CI step that dumps the backend's description and diffs it against
`t3code/packages/moatless-api/openapi-specs.json`, failing with the diff. This mirrors the check the
Moatless repo already runs through `task generate`. Without it the two repositories drift silently
and the first symptom is a runtime decode failure on a page nobody opened during review.

**What only a person can judge.** Whether an administration page reads as part of T3 rather than as
a port — spacing against the personal settings pages above it, whether the Workspace detail page
holds together at one screen, and whether the Skills page makes the source-versus-skill relationship
legible without explanation. Check each new page against `/settings/providers` side by side.

**Acceptance criteria.**

- **Given** a deployment serving T3 with no Workspaces, **when** an admin opens Settings → Workspaces, creates one, and adds a repository by URL, **then** the Workspace exists with that repository placed and primary, and appears in T3's own sidebar as a Project.
- **Given** a non-admin viewer, **when** they open `/settings/workspaces` directly, **then** they are redirected and no administration entry is present in the nav or in search results.
- **Given** the chat socket is disconnected, **when** an admin uses any administration page, **then** it loads and saves normally.
- **Given** a Plugin source whose global default is off and one skill with a global record turning it on, **when** the Skills page renders, **then** the source reads default-off and that skill reads on.
- **Given** a skill with no record, **when** the admin clears an adjacent skill's record, **then** that row returns to Inherit and not to off.
- **Given** a surface that is not built, **when** an admin opens it, **then** the placeholder names the surface and what it will hold, and does _not_ link out into the Moatless SPA — see the placeholder decision above, which deliberately changed this from the approved page so the sidebar stays one product.
- **Given** the backend's API description has changed, **when** CI runs, **then** the staleness check fails with the diff.
- **Given** the whole change, **when** the existing API-level specs in `moatless/tests/` run, **then** they pass unchanged.

## Out of scope

- **Teams** (`moatless/apps/frontend/src/routes/admin/teams*`). Nothing consults a Team for authorization, so porting it would carry a concept nothing reads into a second client.
- **Task Connections** (`routes/admin/task-connections/`). One deployment-wide read whose per-Task answer already renders on the Task.
- **`convert-to-template` and `sync-config`.** They have no Workspace to live on; they stay in the SPA.
- **Retiring the Moatless SPA or deleting its administration routes.** The SPA remains served and remains the only surface for everything above.
- **Any change to the Moatless REST API.** No endpoint is added, changed or removed. In particular this plan does not pay the Loop `repository_id` rename debt, and does not rename `SkillSource::Workspace`.
- **Contract-native RPC for administration.** Rejected on the approved page: ~105 operations into `packages/contracts` and stub implementations in upstream's Node server, which will not compile without them.
- **A Repository group on the Skills page.** Repository-sourced skills have no activation record, so a group would be read-only. Grouping by source leaves room for it without a redesign.
- **Un-gating T3's own upstream settings surfaces** — Providers, Connections, Source control — by implementing their contract methods. Whether each is covered by a REST page or by implementing the RPC is a per-surface call, and neither is decided here.
- **Any change to `moatless/crates/t3code`.** `project.*` writes stay refused; the pages do not use them.
