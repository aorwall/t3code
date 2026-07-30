# Fork policy for upstream merges

This fork tracks [pingdotgg/t3code](https://github.com/pingdotgg/t3code). Upstream
moves fast — roughly 80 commits a week — so merging is routine and the cost of
each merge is decided almost entirely by how quickly the person doing it can
answer one question per conflict: **is this ours, theirs, or converged?**

This file answers that. It is the merge-time lookup table, not a history essay;
the reasoning lives in [the decision log](#4-decision-log) at the bottom.

## Why a table and not just notes

A merge can hurt us in four different ways, and only the first one is the one
git warns you about.

1. **Conflict.** Upstream and we edited the same lines. Git stops. You need to
   know which side wins → [§1 Ownership](#1-ownership).
2. **Silent re-introduction.** We deleted something on purpose; upstream adds it
   back in a _new_ file, or adds a new call site inside code we kept. Git reports
   a clean add and merges it without a word. Nothing conflicts, nothing fails,
   and the thing we removed is back → [§2 Deleted surfaces](#2-deleted-upstream-surfaces).
3. **Silent convergence.** Upstream independently builds the thing we forked in
   order to build. Nothing conflicts textually, but our version is now redundant
   and the two implementations rot against each other → [§3 Convergence watch
   list](#3-convergence-watch-list).
4. **Silent adoption.** Upstream does new work in an area we own, in files that
   did not exist at the fork point. No conflict, no tripwire — we simply inherit
   a decision nobody made → checklist step 3, read against
   [§1's concerns](#fork-owned-concerns).

Hazards 2 and 4 are the dangerous pair, because both are invisible: the merge is
clean and the tests pass. Prose cannot catch either, so §2 is written as greps
that must return nothing, and step 3 of the checklist is a command that lists what
to decide on.

Hazard 4 is also why there is no blanket "anything unlisted is theirs" rule. Every
merge brings genuinely new upstream work, and some of it lands in areas we own. A
default of "theirs" would quietly accept all of it — see the 2026-07-30 merge
entry in [§4](#4-decision-log) for a live example that got in exactly that way.

## Merge checklist

```bash
git fetch upstream
git merge upstream/main
```

1. For every conflict, look the path up in [§1](#1-ownership).
2. Run every tripwire in [§2](#2-deleted-upstream-surfaces). Each must return no
   matches. A match means upstream re-introduced a surface we removed — delete
   it again in the merge commit, not in a follow-up.
3. **Sweep the new upstream surfaces.** Conflicts and tripwires only cover things
   we already have an opinion about. Every merge also brings work upstream did in
   areas we own, in files that did not exist before — so nothing conflicts and no
   tripwire fires. List them and decide:

   ```bash
   git diff --diff-filter=A --name-only \
     "$(git merge-base HEAD upstream/main)..upstream/main" -- ':(exclude).repos' \
     | grep -Ei 'auth|pair|session|clerk|cloud|relay|connect|proxy|origin|host'
   ```

   Read the hits against the [fork-owned concerns](#fork-owned-concerns). Most
   will be irrelevant; the ones that are not are new decisions, and they go in
   [§4](#4-decision-log) whichever way you decide. Widen the filter if a concern
   grows vocabulary the pattern does not cover.

4. Read [§3](#3-convergence-watch-list) and check whether upstream has since
   built any of it. If so, prefer their implementation and shrink our delta.
5. `pnpm typecheck && pnpm test && pnpm lint && pnpm fmt:check`.
6. Append a dated entry to [§4](#4-decision-log): what step 3 surfaced and what
   you decided, plus any conflict you resolved by judgement rather than by
   looking it up here. An entry saying "swept, nothing to decide" is worth
   writing — it tells the next merge the sweep happened.

## 1. Ownership

Two levels, and you need both. The path table is a cache of decisions already
made; it can only ever list files that exist today. Upstream constantly adds new
ones, so when a path is not in the table, the question is not "is it listed?" but
"does it touch something we own?" — and that is the concerns list.

### Fork-owned concerns

If an unlisted file touches one of these, it needs a decision and a log entry. If
it does not, take upstream's version and move on.

| Concern                                                          | Our position                                                                  | When upstream adds to it                                                              |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Authentication and session                                       | Moatless cookie session, `/login`. The T3 backend is not supported.           | Do not adopt. Upstream auth work is for a backend we do not run.                      |
| Client / device identity                                         | Moatless replaces device pairing.                                             | Do not adopt. See [§2](#2-deleted-upstream-surfaces).                                 |
| Cloud, relay, T3 Connect                                         | Being removed with Clerk.                                                     | Do not adopt.                                                                         |
| Dev-server origin and proxy                                      | Upstream's single-origin dev, plus our proxy-target override.                 | Adopt — this is converged, theirs is the base. Re-apply our delta.                    |
| Backend contract (what the client assumes the server implements) | Whatever Moatless implements; see `docs/reference/client-server-contract.md`. | Adopt only if Moatless implements it, otherwise it is a client that talks to nothing. |
| Electron / desktop                                               | Kept in the tree, explicitly not a compliance target.                         | Take theirs. Do not spend merge effort making it work, and do not delete the app.     |

Anything outside these concerns is upstream's: take theirs, no decision needed.
That is an absence of a decision, not a decision to accept — which is why step 3
of the checklist exists.

### Path policy

`ours` means take the fork side wholesale and do not attempt to reconcile.
`converged` means take upstream wholesale, then re-apply only the deltas listed —
never hand-merge a converged file, or the fork delta grows every time.

| Path                                                                                                                                 | Policy                     | Why                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------ | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `apps/web/src/environments/primary/auth.ts`                                                                                          | ours                       | Auth is fork-owned; we do not support the T3 backend.                                                                                      |
| `apps/web/src/environments/primary/httpLayer.ts`                                                                                     | ours                       | Always sends the Moatless session cookie; upstream's same-origin gate is deliberately gone.                                                |
| `apps/web/src/routes/login.tsx`                                                                                                      | ours                       | Fork-only route. Upstream has no `/login`.                                                                                                 |
| `apps/web/src/authBootstrap.test.ts`                                                                                                 | ours                       | Covers the fork's auth path.                                                                                                               |
| `apps/web/vite.config.ts`                                                                                                            | converged                  | See the delta list below.                                                                                                                  |
| `docs/fork/**`                                                                                                                       | ours                       | This directory is fork-only by construction; upstream will never add files here.                                                           |
| `docs/integrations/moatless-*.md`, `docs/reference/client-server-contract.md`, `docs/reference/moatless-concept-map.md`, `.plans/**` | ours                       | Fork-authored docs.                                                                                                                        |
| `scripts/dev-runner.ts`, `scripts/dev-runner.test.ts`                                                                                | **theirs, verbatim**       | We had a delta here and gave it up (log 2026-07-30). If a conflict appears, we have re-grown one by accident — check why before resolving. |
| unlisted, and outside the concerns above                                                                                             | theirs                     | Nothing to decide. Do not grow a fork delta without adding a row here.                                                                     |
| unlisted, but inside a fork-owned concern                                                                                            | **decide, then add a row** | The table is behind reality; catch it up in this merge instead of leaving the next one to rediscover it.                                   |

### Fork delta in the web vite config

Take upstream's file, then re-apply exactly these. Everything else in that file
is upstream's and should stay upstream's.

- `repoFileEnv` (`loadRepoEnv({ baseEnv: {} })`) and the `proxyTargetOverride`
  chain: `T3CODE_DEV_PROXY_TARGET` → `T3CODE_PROXY_TARGET_OVERRIDE` (file-only) →
  `T3CODE_PROXY_TARGET` → `MOATLESS_BASE_URL`.
- `proxyTargetOverride` takes precedence over upstream's `T3CODE_PORT`-derived
  default in `devProxyTarget`, and forces `isSingleOriginDev`.
- `T3CODE_ALLOWED_HOSTS` read as an alias of upstream's
  `T3CODE_DEV_ALLOWED_HOSTS`, plus the `true` escape hatch. Keep upstream's
  implicit `.ts.net` entry.
- The `VITE_MOATLESS_PROXY_AUTH` define.
- The `NODE_ENV=production` → `development` pin for `command === "serve"`.

## 2. Deleted upstream surfaces

Surfaces we removed on purpose. Each tripwire must return **no matches** after a
merge. Run from the repo root.

| Surface                               | Status                       | Tripwire                                                                                   |
| ------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------ |
| Clerk / T3 Connect                    | **decided, not yet removed** | `git grep -ln '@clerk/' -- '*package.json' ':(exclude).repos'`                             |
| Device pairing (replaced by Moatless) | **decided, not yet removed** | `git grep -lni pairing -- apps/web/src apps/server/src apps/mobile packages/contracts/src` |
| T3 backend session bootstrap          | **decided, not yet removed** | `git grep -n 'fetchSessionState\|exchangeBootstrapCredential' -- apps/web/src`             |

All three stay out of `.repos/` — the first by pathspec exclusion, the other two
by being scoped to app paths. That directory is vendored read-only reference
source and is expected to keep mentioning whatever it mentions.

> Nothing in this section is executed yet — the decisions are recorded here so
> the removal work and the merge policy stay in one place, and so a merge landing
> before the removal does not look like it violated policy. Flip each status to
> `removed` in the same commit that does the removal, and only then does its
> tripwire mean anything.

## 3. Convergence watch list

Places where we built something because upstream had not. If upstream ships its
own version, theirs wins and our delta should shrink or disappear.

| Area                      | Ours                                            | Watch for                                                                                                                                                                   |
| ------------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth                      | Moatless cookie session, `/login` route         | Nothing — auth is fork-owned by decision, not by accident. Take ours even if upstream reworks it.                                                                           |
| Dev proxy / single-origin | `proxyTargetOverride` chain in `vite.config.ts` | Already converged once (2026-07-30). Any further upstream work on `DEV_PROXIED_PATH_PREFIXES`, `T3CODE_SINGLE_ORIGIN_DEV` or `resolveDevProxyTarget` should be taken as-is. |
| Allowed hosts             | `T3CODE_ALLOWED_HOSTS` alias                    | Upstream consolidating on `T3CODE_DEV_ALLOWED_HOSTS`. If deployments can be changed to inject that name, drop our alias.                                                    |

## 4. Decision log

Append-only. Newest first. Each entry records what was decided, by whom, and the
upstream context at the time — so a future merge can tell a deliberate choice
from an accident.

### 2026-07-30 — auth is fork-owned; drop Clerk and pairing

Decided by @aorwall. We no longer need to support the T3 backend, so the auth
path is ours outright rather than a Moatless branch layered over upstream's.

- **Device pairing** is replaced by Moatless. Upstream's pairing credentials and
  client-session management come out.
- **Clerk** comes out. Note the blast radius is wider than `apps/web`:
  `@clerk/electron` (web, desktop), `@clerk/expo` (mobile) and `@clerk/backend`
  (`infra/relay`, which uses `verifyToken` to authenticate the T3 Connect tunnel).
  Removing Clerk therefore removes T3 Connect. **Open:** confirm that is intended
  before touching `infra/relay`.
- **Electron** stays in the tree, but is explicitly _not_ a compliance target for
  now. Do not spend merge effort keeping desktop auth working; do not delete the
  app either.
- **Consequence not yet resolved:** `.agents/skills/test-t3-app/SKILL.md` drives
  local dev by starting the bundled T3 server and authenticating with one-time
  pairing URLs. That is the non-Moatless branch at `auth.ts:359`. Removing the T3
  auth path breaks local dev and agent testing until that skill runs against a
  local Moatless instead.

### 2026-07-30 — merged upstream to v0.0.31, gave up the dev-runner delta

81 upstream commits, merge base `5719e8ac`, upstream head `6efcf3e1`. One
conflict: `apps/web/vite.config.ts`.

Upstream had independently shipped single-origin browser dev (#4555, #4556,
#4608) covering the same ground as the fork's proxy-origin work (#3). Resolved by
taking upstream's implementation wholesale and re-applying only the fork-specific
pieces now listed in [§1](#fork-delta-in-the-web-vite-config). The fork
delta on that file went from 171 lines to 70.

Two fork changes were dropped as superseded:

- `T3CODE_HMR_HOST` and its `dev-runner` plumbing. Upstream now deletes an
  inherited `HOST` for every non-desktop mode and gates the HMR pin on
  `explicitHost` — the same fix, with upstream's own tests. `scripts/dev-runner.ts`
  and its test are byte-identical to upstream again, which is why §1 lists them
  as _theirs, verbatim_.
- The separate `/attachments` proxy entry. Prefixes now come from
  `packages/shared/src/devProxy.ts`, and attachments moved under `/api/assets`
  (`ASSET_ROUTE_PREFIX`), which `/api` already covers.

**New upstream surfaces swept afterwards, not at merge time.** This merge added
101 new upstream files; 17 fell inside fork-owned concerns, including
`apps/web/src/components/clerk/authRedirect.ts` — a brand-new Clerk file, added on
the same day we decided to remove Clerk. It merged cleanly, no tripwire existed
yet, and nothing flagged it. That is hazard 4, and it is why checklist step 3
exists. Also swept in: `apps/server/src/auth/RpcAuthorization.ts` and
`infra/relay/src/environments/ManagedTunnelLimits.ts`. All three are accepted for
now and will be removed with their surfaces rather than picked out individually.
