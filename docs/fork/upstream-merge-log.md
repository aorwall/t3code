# Fork upstream merge tracker

Append-only, newest first. Keep entries compact: context, conflicts, sweep
decisions, and verification. If an entry needs more than a short paragraph or a
few bullets, move the durable rule into
[the merge inventory](./upstream-merge-inventory.md) instead.

## Entry template

```markdown
### YYYY-MM-DD — short title

- Upstream: `<head>` from base `<base>` (`N` commits).
- Conflicts: paths and resolution rule used.
- Sweep: owned-concern hits and decision.
- Verification: commands run, failures or caveats.
```

## Log

### 2026-08-02 — merged the upstream service launcher

- Upstream: `5192f777` from base `0ad91b6e` (`4` commits).
- Conflicts: none. `packages/contracts/src/environment.ts` (comment),
  `packages/contracts/src/server.ts` (optional `updateId` and `updateOutcome`),
  and `apps/web/src/components/SidebarV2.tsx` (`focus-visible` instead of
  `focus-within`) all took upstream; none of them touches a fork gate.
- Sweep: five `apps/server/src/cloud/service*.ts` additions matched the `cloud`
  filter. Accepted as upstream because they are the systemd self-update launcher,
  not Clerk or T3 Connect. Clerk and session-bootstrap tripwire counts held at 4
  and 9; pairing fell from 74 to 72 files, and the two added `pairing` lines are
  the existing startup message moved into `apps/server/src/serverActivation.ts`.
- Convergence: none. `rpc.ts`, `auth.ts`, `ws.ts`, `servers.ts`, and
  `vite.config.ts` are untouched, so the unsupported-method unions and the three
  `servers.*` stubs stand unchanged, and no new WebSocket method appeared.
- Verification: `pnpm typecheck` and `pnpm lint` clean. `pnpm test` fails 20
  tests across `apps/web/src/promptStashStore.test.ts` and
  `apps/web/src/authBootstrap.test.ts`, identically on the pre-merge commit; the
  machine runs Node 25.6.0 against the pinned `^24.13.1`, and the failures are
  `localStorage` and unstubbed-`fetch` engine differences. `pnpm fmt:check`
  reported `docs/fork/upstream-merge-inventory.md` and the merge skill, both
  unrelated to this merge and fixed here.

### 2026-08-01 — the contract can say a method is unsupported

- Decision: `UnsupportedMethodError` in `packages/contracts/src/auth.ts`, declared
  on the 47 WebSocket methods Moatless does not serve. Fork inventory row: §3
  _Unsupported methods_. Backend half is soaplabs/moatless#236.
- **Not on all 82, deliberately.** A blanket allowance says nothing and never
  needs editing; a list of 47 is a claim about the surface that has to be kept
  true. It is derived — contract methods minus the backend's dispatch arms — so
  recompute it rather than editing it by hand.
- Why an error and not a capability list: the wire already has a place for this.
  An undeclared failure can only leave as a `Die`, and a `Die` carries no message
  the client can decode, so an absent method and a panic looked identical to the
  person. Nothing about the handshake or the transport had to change.
- Upstream's server implements everything, so it never constructs the new member
  and `apps/server` is untouched. The whole delta is one class and 48 lines of
  union entries in `rpc.ts`.
- Kept out on purpose: the `mapSessionRpcError` arm an earlier pass added in
  `packages/client-runtime`. `server.probe` and `server.getConfig` are both
  served, so their unions do not gain the error and that switch stays upstream's.
- Also: `workspaceSearch` splits into `workspaceSearchContents` in
  `apps/web/src/fork/features.ts`. The backend grew path search (`SearchFilesByName`)
  and has no content-search RPC, so the two halves stopped sharing a fate and
  "Go to file" is no longer gated.
- Verification: `vp run --filter @t3tools/contracts|client-runtime|web|t3 typecheck`,
  all clean.

### 2026-08-01 — the fork hides surfaces it cannot serve

- Decision: Moatless answers 32 of the contract's 82 methods and 6 of its 20
  dispatch commands, and the gap reached people as defects — an unimplemented
  method returns a `Die` cause, so the button showed a server error. Surfaces
  we cannot serve are now absent. Fork inventory row: §3 _Surface gating_.
- **A build constant, not a server capability.** A capability on the wire was
  built first and thrown away: it cost a contract field, a decode path, a
  default that had to point the opposite way to every flag beside it, and a
  subscription at every call site — all to express something that does not vary
  at runtime. `apps/web/src/fork/features.ts` is one table, and flipping a
  surface on is one edit in it. Nothing in `packages/contracts` changed, and the
  backend declares nothing.
- **Hide, not disable.** Upstream's `available` / `disabledReason` means "not
  usable yet, and here is why"; a surface this build does not show has nothing
  worth explaining. The two stay separate — `SurfaceMenuItem` now takes both.
- **Gates are additive and never re-indent.** No gate adds a prop, an effect or
  state, and where a conditional would have wrapped existing JSX the gate moved
  somewhere that filters instead. A re-indented block is what turns a nearby
  upstream edit into a conflict, so a new gate has to keep this shape.
- Cheapest hooks found, each replacing several edits: `/settings`'s existing
  `beforeLoad` covers every gated section at once, and `rightPanelStore`'s
  migrate already drops surface kinds a build does not know, which is exactly
  what a saved layout holding a now-hidden surface needs.
- Hazard: both lookup maps key off strings that live in upstream code — a route
  path and a palette action's `value` — and both treat an unknown key as
  _enabled_, so an upstream rename un-gates silently. `features.test.ts` reads
  the keys back out of the upstream sources rather than restating them.
- Not gated: Settings General, Appearance and Providers. `splitPatch` routes
  much of them to localStorage and they keep working; only the server-backed
  "add provider instance" is gated inside.

### 2026-08-01 — merged upstream to 0ad91b6e

- Upstream: `0ad91b6e` from base `6efcf3e1` (`56` commits).
- Conflicts: docs layout only. Kept fork Moatless docs while accepting upstream's
  move to `docs/user/**` and `docs/internals/**`; updated policy-owned paths.
- Sweep: accepted mobile wakeups, Ghostty terminal files, and
  `docs/internals/connection-runtime.md` as false positives. Rejected new
  `apps/server/src/cli/pair.ts` and test because device pairing is fork-owned
  and replaced by Moatless.
- Verification adaptations: relay deploy test now reads
  `.github/workflows/release.yml.disabled`; image-compression tests use smaller
  synthetic blobs to avoid full-suite timeout while covering the same branches.

### 2026-07-31 — fork publishes a container image

- Decision: `docker/**` and `.github/workflows/build-moatless-t3-image.yml` are
  fork-only because Moatless deploys the web UI from its Helm chart; upstream
  ships `apps/web` to Vercel.
- Runner rule: re-enabled workflows must use `staging-runners-large`; GitHub
  hosted labels did not start in this fork.
- Boundaries: no nginx proxy in the image, and no runtime backend URL. The
  single-origin client derives HTTP and WebSocket origins from
  `window.location.origin`; the image only builds with a non-empty
  `MOATLESS_BASE_URL`.

### 2026-07-31 — started tracking fork inventory

- Decision: the policy needed §3 because conflict ownership is not enough to
  remember every deliberate fork delta.
- Added inventory rows for auth/session, dev hosting, repo hygiene, thread
  servers, hosted preview, and the three upstream-server `servers.*` stubs.
- Rule: any future change that grows the fork delta updates the inventory in the
  same commit.

### 2026-07-30 — auth is fork-owned

- Decision: Moatless cookie session and `/login` own auth; the T3 backend path is
  unsupported.
- Device pairing, Clerk, and T3 Connect are decided out but not fully removed.
- Electron stays in tree but is not a compliance target.
- Known consequence: `.agents/skills/test-t3-app/SKILL.md` still assumes the
  bundled T3 server and one-time pairing URLs.

### 2026-07-30 — disabled upstream workflows

- Decision: upstream workflows were renamed to `*.yml.disabled` because this fork
  cannot run upstream's Blacksmith/public-OSS automation.
- The rename preserves upstream workflow content so future upstream edits land on
  the disabled paths instead of creating delete/modify conflicts.
- Consequence: merge verification is local until CI is deliberately restored.

### 2026-07-30 — merged upstream to v0.0.31

- Upstream: `6efcf3e1` from base `5719e8ac` (`81` commits).
- Conflict: `apps/web/vite.config.ts`. Took upstream single-origin dev and
  re-applied only the fork proxy-target, allowed-hosts, Moatless auth define,
  and serve-mode `NODE_ENV` pin.
- Dropped: `T3CODE_HMR_HOST` / `dev-runner` plumbing and the separate
  `/attachments` proxy, both superseded upstream.
- Late sweep found new auth/relay-owned surfaces including
  `apps/web/src/components/clerk/authRedirect.ts`; accepted temporarily because
  those surfaces were already decided out and will be removed as a group.
