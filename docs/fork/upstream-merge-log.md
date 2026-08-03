# Fork upstream merge tracker

Append-only, newest first.

An entry is written for whoever does the _next_ merge or fork change, and holds
only what that person needs: where upstream was, what conflicted and how it was
resolved, what a sweep or tripwire found, what is unverified, and which
verification failures are the machine rather than the code. Why a fork decision
was made is not that — put the durable form in
[the merge inventory](./upstream-merge-inventory.md) and link the row from here.
If an entry runs past a few bullets, the rest belongs in the inventory.

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

### 2026-08-03 — the screen splits horizontally, and the inventory gets an upstream to check against

- Fork delta on eight upstream files plus three fork-only files. Inventory row:
  _Horizontal split of the screen_, with Split Screen Delta beside the Web Vite,
  Mobile Touch and Message Origin deltas.
- No upstream path is renamed or deleted for it: `rightPanelOrientation.ts` sits
  next to `rightPanelLayout.ts`, `useResizablePanelHeight.ts` next to
  `useResizableWidth.ts`, and the upstream files carry additive hooks into them.
  An earlier draft renamed `useResizableWidth.ts`, which would have made every
  later upstream edit to that hook a modify/delete conflict.
- AGENTS.md changed with it, on request: fork code says so in a comment where it
  sits, and the rule sending every fork-only file to `apps/web/src/fork/` is
  gone — these three sit beside the modules they work with instead.
- Six of the eight upstream files were byte-identical to upstream beforehand, so
  any other difference found in them during a merge is upstream's.
- A sandbox can check ownership now: `git remote add upstream ...` plus
  `git fetch --depth=1 upstream main`, both in Path policy. That check split
  `.plans/**`, which was `ours` while upstream owns 32 of its 35 files, and
  cleared the `messageOrigin.ts` caveat below.
- Merged fork `main` after #43; both fork docs conflicted. Took main's _Agent
  instructions_ row and `AGENTS.md` path policy, kept this branch's rows
  elsewhere, and cut this entry to the new template.
- Verification: repo-wide `pnpm typecheck`, `pnpm lint` and `pnpm fmt:check`
  clean before the merge, contracts 227, shared 318, server 1812, web 1824;
  after it, scoped to what changed per AGENTS.md — web typecheck, lint and the
  touched suites. Not verified in a browser: the task's preview server was in
  `CrashLoopBackOff` (its start command resolves `$WORKSPACE_PATH/t3code`, which
  is not where the checkout is) and the preview gateway still answered 504 after
  a live override fixed that.

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
