# Local T3 Code + Moatless Rust workflow

The first direct-Rust integration slice is runnable with Moatless in Docker
Compose and this T3 Code checkout in Vite development mode.

## Start the backend

The canonical commands and security explanation live in the sibling Moatless
checkout at:

```text
../moatless/docs/runbooks/t3-code-local-development.md
```

In summary, its additive Compose overlay builds the current Rust backend and
enables four feature-gated compatibility routes:

- `GET /.well-known/t3/environment`
- `GET /api/auth/session`
- `GET /api/orchestration/shell`
- `GET /ws`

Log in through `http://localhost:3000` before opening T3. The normal
`moatless_session` cookie is host-scoped and is reused across local ports; no
API key is exposed to browser JavaScript.

## Run this checkout

```bash
corepack enable
pnpm install --frozen-lockfile
T3CODE_PROXY_TARGET=http://localhost:8080 pnpm dev:web
```

Open [http://localhost:5733](http://localhost:5733).

For a persistent checkout-local target, use the ignored `.env.local`:

```dotenv
T3CODE_PROXY_TARGET_OVERRIDE=http://localhost:8080
```

`apps/web/vite.config.ts` proxies the prefixes in `packages/shared/src/devProxy.ts`
— `/api` (which covers attachments, served under `/api/assets`), `/oauth`,
`/.well-known`, and the `/ws` upgrade — to that target. Naming a target also puts
the dev server in single-origin mode, which blanks the browser's configured HTTP
and WebSocket endpoints so all traffic stays same-origin at port 5733.

## Expected phase-one behavior

T3 connects to an environment named `Moatless Compose` and renders an empty
shell. Config, lifecycle, auth-access, shell, idle terminal/VCS/preview
subscriptions, `Ack`, interruption, and keepalive frames are implemented.

This phase proves transport compatibility and authentication. It does **not**
yet display Moatless Tasks or Messages, and all write RPCs fail explicitly.
The exhaustive target mapping and the remaining implementation program are in
[T3 Code UI on the Moatless backend](./moatless-backend.md).
