# `moatless-t3` image

The T3 Code web app (`@t3tools/web`) built and served as a static SPA, published
as `aorwall/moatless-t3:latest` for the Moatless Helm chart to deploy.

## What is in it

nginx and `apps/web/dist`. Nothing else — no Node runtime, no T3 server, no
proxy. Roughly 19 MB of assets on top of `nginx:1.31-alpine`.

## What is deliberately not in it

**A backend proxy.** In the Moatless deployment the SPA and the backend share
one host, and Traefik decides which of the two answers a request: `/api`, `/ws`,
`/.well-known/t3` and `/oauth/token` go to the backend, everything else comes
here. If nginx also proxied those prefixes, a path would have two possible
answers depending on which layer matched it first, and the two would drift.

The consequence is that running this image on its own gives you the app shell
and a bootstrap that never completes. That is the image working, not failing.
For a local end-to-end run use the Vite dev server against a Moatless backend
instead — see [`docs/integrations/moatless-local-development.md`](../docs/integrations/moatless-local-development.md).

**A configurable backend URL.** The client derives both the HTTP and the
WebSocket origin from `window.location.origin`, so there is no runtime setting
to get wrong and no per-environment rebuild.

## Building locally

From the repository root:

```bash
docker build -f docker/Dockerfile -t aorwall/moatless-t3:latest .
docker run --rm -p 8081:80 aorwall/moatless-t3:latest
curl -sf localhost:8081/health
```

The build installs only `@t3tools/web` and its workspace dependencies (4 of the
16 projects), so it does not pull Electron or Expo.

### Build arguments

| Arg                    | Default       | Effect                                                                                                                                                                                                                                                                                       |
| ---------------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MOATLESS_BASE_URL`    | `same-origin` | Any non-empty value tells `apps/web/vite.config.ts` the backend is Moatless: it bakes `VITE_MOATLESS_PROXY_AUTH` and pins the client to single-origin. The value itself is only ever dialled by the dev server, which this image does not run. Set it empty for a stock non-Moatless bundle. |
| `T3CODE_WEB_SOURCEMAP` | `0`           | `1` ships source maps (~37 MB, and the full application source with them).                                                                                                                                                                                                                   |
| `NODE_VERSION`         | `24.18.1`     | Builder image tag. Must satisfy the root `engines.node`.                                                                                                                                                                                                                                     |
| `NGINX_VERSION`        | `1.31`        | Runtime image tag.                                                                                                                                                                                                                                                                           |
| `APK_SECURITY_REFRESH` | a date        | Bump to invalidate the `apk upgrade` layer for a CVE rebuild.                                                                                                                                                                                                                                |
| `SOURCE_COMMIT`        | `unknown`     | Recorded as `org.opencontainers.image.revision`.                                                                                                                                                                                                                                             |

## Publishing

`.github/workflows/build-moatless-t3-image.yml`. Pull requests build without
publishing; pushes to `main` publish `:latest` and `:sha-<short>`; a manual run
can publish any tag.

## Changing the nginx config

`docker/nginx.conf` is copied to `/etc/nginx/conf.d/default.conf` and validated
with `nginx -t` during the image build, so a syntax error fails the build rather
than the first request. The security headers live in a separate include because
nginx's `add_header` does not merge: any location that sets a header of its own
drops everything inherited from the server block, which is exactly what the
cache-control locations do.
