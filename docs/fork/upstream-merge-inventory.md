# Fork upstream merge inventory

This is the mutable fork policy and inventory used by the project-local
[`fork-upstream-merge`](../../.agents/skills/fork-upstream-merge/SKILL.md)
skill. Keep stable merge procedure and policy definitions in the skill. Keep
durable ownership rules, tripwires, inventory, and convergence rules here. Keep
dated merge decisions in [the upstream merge tracker](./upstream-merge-log.md).

## Fork-owned concerns

If an unlisted file touches one of these concerns, decide and record it. If it
does not, take upstream.

| Concern | Fork position | Upstream-addition action |
| --- | --- | --- |
| Authentication and session | Moatless cookie session and `/login`; no T3 backend session. | Do not adopt upstream auth work. |
| Client / device identity | Moatless replaces device pairing. | Do not adopt; check Deleted Surfaces. |
| Cloud, relay, T3 Connect | Being removed with Clerk. | Do not adopt. |
| Dev-server origin and proxy | Upstream single-origin dev plus fork proxy-target override. | Adopt upstream, then re-apply the fork delta. |
| Backend contract | Client may assume only what Moatless implements; see `docs/internals/client-server-contract.md`. | Adopt only if Moatless implements it. |
| Electron / desktop | Kept in tree; not a compliance target. | Take upstream and do not spend merge effort making desktop work. |

## Path policy

| Path | Policy | Action |
| --- | --- | --- |
| `apps/web/src/environments/primary/auth.ts` | ours | Keep Moatless auth. |
| `apps/web/src/environments/primary/httpLayer.ts` | ours | Keep cookie session behavior and missing same-origin gate. |
| `apps/web/src/routes/login.tsx` | ours | Keep fork-only `/login`. |
| `apps/web/src/authBootstrap.test.ts` | ours | Keep fork auth coverage. |
| `apps/web/vite.config.ts` | converged | Take upstream, then apply Web Vite Delta. |
| `docs/fork/**` | ours | Keep fork docs and tracker. |
| `docs/user/moatless-*.md`, `docs/internals/client-server-contract.md`, `docs/internals/moatless-concept-map.md`, `.plans/**` | ours | Keep fork-authored docs and plans. |
| `scripts/dev-runner.ts`, `scripts/dev-runner.test.ts` | theirs, verbatim | Take upstream exactly; investigate any re-grown fork delta. |
| `apps/web/src/components/servers/**`, `apps/web/src/browser/**`, `apps/web/src/state/servers.ts`, `packages/contracts/src/servers.ts`, `packages/contracts/fixtures/moatless/**`, `packages/client-runtime/src/state/servers.ts` | ours | Keep fork thread-server and hosted-preview surfaces. |
| `packages/contracts/src/rpc.ts`, `packages/contracts/src/auth.ts` | converged | Take upstream, then re-apply `UnsupportedMethodError`, its unsupported-method error unions, and `servers.*` wiring. |
| `apps/server/src/ws.ts`, `apps/server/src/auth/RpcAuthorization.ts` | converged | Take upstream, then re-add exactly three `servers.*` method entries in each file. |
| `apps/web/src/fork/**` | ours | Keep fork-only feature registry. |
| Feature-gated files in Fork Inventory | converged | Take upstream, then re-apply additive gates without re-indenting upstream blocks. |
| `.github/workflows/**` | ours | Keep workflows renamed to `*.yml.disabled`; let upstream content changes land on disabled paths. |
| Unlisted and outside Fork-Owned Concerns | theirs | Take upstream. |
| Unlisted and inside Fork-Owned Concerns | decide, then add a row | Decide in the merge and update this policy. |

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

## Deleted surfaces

Run from the repo root.

| Surface | Status | Tripwire |
| --- | --- | --- |
| Clerk / T3 Connect | decided, not yet removed | `git grep -ln '@clerk/' -- '*package.json' ':(exclude).repos'` |
| Device pairing | decided, not yet removed | `git grep -lni pairing -- apps/web/src apps/server/src apps/mobile packages/contracts/src` |
| T3 backend session bootstrap | decided, not yet removed | `git grep -n 'fetchSessionState\|exchangeBootstrapCredential' -- apps/web/src` |

When removal work lands, change that surface to `removed` here in the same
commit. Only `removed` tripwires require no matches.

## Fork inventory

Use this inventory to identify deliberate fork changes during conflicts, test
failures, or convergence decisions. If fork code exists outside a listed row,
update this file.

| Change | Paths | Merge rule |
| --- | --- | --- |
| Moatless cookie session | `apps/web/src/environments/primary/auth.ts`, `apps/web/src/environments/primary/httpLayer.ts`, `apps/web/src/routes/login.tsx`, `apps/web/src/authBootstrap.test.ts` | Keep ours; the T3 backend session path is unsupported. |
| Proxy target, allowed hosts, dev pins | `apps/web/vite.config.ts` | Converged; apply only Web Vite Delta. |
| Disabled GitHub workflows | `.github/workflows/*.yml.disabled`, `.github/workflows/README.md` | Keep disabled workflow paths. |
| Fork documentation and plans | `docs/fork/**`, `docs/user/moatless-*.md`, `docs/internals/client-server-contract.md`, `docs/internals/moatless-concept-map.md`, `.plans/**` | Keep ours. |
| `servers.*` contract group | `packages/contracts/src/servers.ts`, `packages/contracts/src/rpc.ts`, `packages/contracts/src/index.ts`, `packages/contracts/src/preview.ts`, `packages/contracts/fixtures/moatless/**` | Keep fork methods: list, status subscription, log subscription. |
| Server state in client runtime | `packages/client-runtime/src/state/servers.ts`, its test, `packages/client-runtime/src/rpc/client.ts`, `packages/client-runtime/package.json` | Keep fork server state surface. |
| Servers view in right panel | `apps/web/src/components/servers/**`, `apps/web/src/state/servers.ts`, `apps/web/src/components/RightPanelTabs.tsx`, `apps/web/src/rightPanelStore.ts`, `apps/web/src/components/ChatView.tsx`, `apps/web/src/AppRoot.tsx` | Keep fork UI unless upstream ships an equivalent. |
| Hosted web preview | `apps/web/src/browser/**`, `apps/web/src/components/preview/**`, `apps/web/src/previewStateStore.ts`, `apps/web/src/previewRuntimeCapability.test.ts` | Keep iframe-hosted preview unless upstream ships a web preview. |
| Upstream-server `servers.*` stubs | `apps/server/src/ws.ts`, `apps/server/src/auth/RpcAuthorization.ts` | Converged; re-add exactly three `servers.*` entries. Drop these first if upstream ships server-shaped support. |
| `UnsupportedMethodError` | `packages/contracts/src/auth.ts` | Keep error class until upstream has optional/unsupported method semantics. |
| Unsupported-method error unions | `packages/contracts/src/rpc.ts` | Keep one entry per Moatless-unserved method. Recompute as contract WebSocket methods minus backend `ui_rpc/mod.rs` dispatch arms. |
| Surface-gating registry | `apps/web/src/fork/features.ts` and test | Keep as the only source of fork surface flags. Unknown route/action keys default enabled; tests must read upstream keys. |
| Chat surface gates | `apps/web/src/components/ChatView.tsx`, `apps/web/src/components/RightPanelTabs.tsx`, `apps/web/src/components/chat/ChatHeader.tsx` | Re-apply additive gates only. |
| Persisted panel gating | `apps/web/src/rightPanelStore.ts` | Keep migrate disposal for hidden/unknown surfaces. |
| Navigation gates | `apps/web/src/components/CommandPalette.tsx`, `apps/web/src/components/SidebarV2.tsx` | Re-apply list filtering gates. |
| Settings gates | `apps/web/src/routes/settings.tsx`, `apps/web/src/components/settings/SettingsSidebarNav.tsx`, `apps/web/src/components/settings/SettingsPanels.tsx` | Re-apply route guard and nav/search filtering. General, Appearance, and Providers stay visible except server-backed add-provider instance. |

## Convergence watch list

When upstream ships one of these, prefer upstream and shrink the fork delta.

| Area | Watch for | Action |
| --- | --- | --- |
| Auth | No convergence expected; auth is fork-owned. | Keep ours. |
| Dev proxy / single-origin | Work on `DEV_PROXIED_PATH_PREFIXES`, `T3CODE_SINGLE_ORIGIN_DEV`, or `resolveDevProxyTarget`. | Take upstream and re-apply only Web Vite Delta. |
| Allowed hosts | Upstream consolidation on `T3CODE_DEV_ALLOWED_HOSTS`. | Drop `T3CODE_ALLOWED_HOSTS` alias once deployments inject upstream's name. |
| Thread servers | Any upstream concept of a server owned by a thread, especially in `WS_METHODS`. | Prefer upstream; remove fork group, stubs first. |
| Hosted preview | Any upstream web-build preview surface. | Prefer upstream web preview. |
| Unsupported methods | Capability list, optional-method marker, handshake metadata, `ServerConfig`, or HTTP `metadata` endpoint. | Prefer upstream semantics and collapse 47 error-union entries into it. |
| Surface gating | `ExecutionEnvironmentCapabilities` or another upstream way to say a build/server does not serve a surface. | Prefer upstream and re-point or remove fork flags. |
