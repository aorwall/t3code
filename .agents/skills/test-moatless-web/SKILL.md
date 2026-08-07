---
name: test-moatless-web
description: Run and test this fork's T3 Code web client against a Moatless Rust backend, including single-origin proxy setup, Moatless cookie-session sign-in at /login, port and allowed-host selection, and reachability checks against /.well-known/t3/environment. Use whenever testing the web client in this repository — it is the fork's product surface and does not use the bundled T3 server or device pairing.
---

# Test Moatless Web

This fork's web client is a front end for a Moatless Rust backend. It reaches
that backend through the Vite dev server's proxy and authenticates with the
Moatless session cookie.

Use this skill for web testing in this repository. The sibling
[`test-t3-app`](../test-t3-app/SKILL.md) skill describes upstream's bundled T3
server and one-time pairing URLs; that stack is not what this fork's web client
talks to, and pairing is decided out here.

## Point the web app at a backend

`pnpm dev:web` starts the web app alone — it does not start a T3 server. Name
the backend it should proxy to:

```bash
pnpm install --frozen-lockfile
T3CODE_PROXY_TARGET=http://localhost:8080 pnpm dev:web
```

For a target that should survive across runs, put it in the ignored
`.env.local` instead, which outranks the environment variable:

```dotenv
T3CODE_PROXY_TARGET_OVERRIDE=http://localhost:8080
```

Naming a target also puts the dev server in single-origin mode: Vite proxies
`/api`, `/oauth`, `/.well-known`, and the `/ws` upgrade (the list in
`packages/shared/src/devProxy.ts`) to that target, and blanks the client's
configured HTTP and WebSocket endpoints so every request stays same-origin.

Never set `VITE_HTTP_URL` or `VITE_WS_URL` for a browser dev run. They bake a
`localhost` backend into the page, which breaks any origin that is not the
developer's own machine — a container, a tailnet address, a preview host.

The web port is `5733` unless `PORT` says otherwise. When the origin is not
loopback, list its host so Vite will serve it:

```bash
PORT=5173 HOST=0.0.0.0 \
  T3CODE_PROXY_TARGET=https://moatless.example.com \
  T3CODE_ALLOWED_HOSTS=.example.com,localhost,127.0.0.1 \
  pnpm --filter @t3tools/web dev
```

Use `pnpm --filter @t3tools/web dev` rather than `pnpm dev:web` when setting
`PORT` or `HOST` directly: the dev runner picks its own ports and deletes an
inherited `HOST` so Vite's HMR socket cannot be pinned to the wrong address.

## Confirm the backend before testing the UI

Ask the backend who it is. A wrong or unreachable proxy target looks like an
ordinary empty app, so check the transport before reading anything into the UI:

```bash
curl -s localhost:5733/.well-known/t3/environment
```

A working target answers with the environment's `label`, `environmentId`,
`serverVersion`, and its `capabilities` map. That map is the backend's own
statement of what it implements; a surface whose capability is absent or `false`
is expected to be missing from the UI, and is not a bug to chase.

## Sign in with the Moatless session cookie

The client has no pairing step. Unauthenticated, `/api/auth/session` answers
`401` and the app redirects to its own `/login` route, which reads
`/api/v1/auth/mode` and renders one of two things:

- `mode: "password"` — a username and password form, posted to
  `/api/v1/auth/password/login`.
- `mode: "oauth"` — a sign-in link to the `loginUrl` the backend named, such as
  `/api/v1/auth/github-app`.

Complete that flow once in the browser context you will test in. The cookie is
host-scoped and sent with `credentials: "include"`, so it is reused across ports
on the same host — signing in against the backend's own origin authenticates the
dev server too, and no API key is ever exposed to browser JavaScript.

Where the flow lands after signing in is remembered in `sessionStorage` under
`t3code:moatless-auth:return-to`, so a deep link survives the round trip.

## Keep the environment while iterating

Treat the whole testing loop, not one verification pass, as the lifecycle
boundary. Keep the dev process, its port, and the signed-in browser tab alive
while the user may ask for follow-up changes, and reuse them on a later turn
after checking the process is still up. Tell the user the environment is still
available and give its URL; the URL is not a secret here, because the session
lives in a cookie rather than in the link.

## Troubleshoot

- Empty app and no environment label: the proxy target is wrong or down. Curl
  `/.well-known/t3/environment` and fix the target before touching the UI.
- Blocked host, or Vite refusing the request: add the origin's host to
  `T3CODE_ALLOWED_HOSTS`.
- HMR dialing the wrong machine while the page itself loads: an inherited `HOST`
  or a `VITE_*` URL reached Vite. Unset them and use single-origin mode.
- Redirected to `/login` on every navigation: the session cookie is missing or
  expired. Sign in again rather than retrying the navigation.
- A surface missing entirely: check its capability in the environment payload
  before assuming the client is broken.
