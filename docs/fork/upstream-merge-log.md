# Fork upstream merge tracker

Append-only, newest first. Keep entries compact: context, conflicts, sweep
decisions, and verification. If an entry needs more than a short paragraph or a
few bullets, move the durable rule into
[the merge policy](./upstream-merge-policy.md) or the fork inventory instead.

## Entry template

```markdown
### YYYY-MM-DD — short title

- Upstream: `<head>` from base `<base>` (`N` commits).
- Conflicts: paths and resolution rule used.
- Sweep: owned-concern hits and decision.
- Verification: commands run, failures or caveats.
```

## Log

### 2026-08-01 — a server may withhold surfaces; the client hides them

- Decision: Moatless answers 32 of the contract's 82 methods and 6 of its 20
  dispatch commands, and the gap reached people as defects. A server now
  declares what it cannot serve in `capabilities.features`; the client leaves
  those surfaces out. Fork inventory row: §3 _Surface gating by environment_.
- **Hide, not disable.** Upstream's `available` / `disabledReason` means "not
  usable yet, and here is why"; a surface a server cannot serve has nothing
  worth explaining, so it is removed. The two mechanisms stay separate.
- **Static, not configurable.** The flags are a table in `ui_rpc/mod.rs` with no
  env-var override — what a server can serve is a fact about its code, and an
  override would let the two disagree.
- **One `projectManagement` group.** Add, remove and the source-control settings
  that configure them arrive together.
- Hazard: `features` is absent from every upstream descriptor and must mean
  _everything on_, the inverse of `threadSettlement` and `threadSnooze` on the
  same struct. Asserted in `environmentFeatures.test.ts`.
- Not gated: Settings General and Providers. `splitPatch` routes much of both to
  localStorage, which works whatever the server implements; only the
  server-backed "add provider instance" is gated inside.

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
