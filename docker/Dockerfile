# syntax=docker/dockerfile:1.9

# moatless-t3 — the T3 Code web app as a static SPA image.
#
# Published as: aorwall/moatless-t3:latest (see
# .github/workflows/build-moatless-t3-image.yml).
#
# The image contains nothing but built assets and nginx. It does not proxy to
# the Moatless backend: in the Moatless Helm chart the SPA and the backend sit
# behind one Traefik host, which routes /api, /ws, /.well-known/t3 and
# /oauth/token to the backend and everything else here. Adding a proxy in nginx
# as well would give the same path two answers depending on which layer saw it
# first. Serving this image on its own therefore gets a working shell and a
# failing bootstrap — that is expected, not a broken image.
#
# Build from the repository root:
#
#   docker build -f docker/Dockerfile -t aorwall/moatless-t3:latest .

ARG NODE_VERSION=24.18.1
ARG NGINX_VERSION=1.31

# Named so the image is referenced once and pulled once: the builder borrows
# its CA bundle, and the runtime stage is built from it.
FROM nginx:${NGINX_VERSION}-alpine AS nginx-base

# ---------------------------------------------------------------------------
# Builder
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION}-slim AS builder

ENV CI=1 \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0

WORKDIR /src

# node:24-slim carries no system trust store, and `vp build` constructs an HTTP
# client at startup unconditionally — with an empty store it does not fail the
# request, it panics before the build begins. Taking the bundle from the nginx
# image costs nothing, since that image is already being pulled for the runtime
# stage.
#
# Note for anyone reaching for apt here instead: the CI runners deny all
# outbound traffic except 443/TCP (the arc-runners egress allowlist in
# soap-platform-gitops), and Debian's default sources are plain HTTP, so
# `apt-get update` does not fail fast — it hangs until it times out.
COPY --from=nginx-base /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
ENV SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt \
    SSL_CERT_DIR=/etc/ssl/certs

# pnpm version comes from the `packageManager` field, not from this line.
RUN corepack enable

COPY . .

# `--filter @t3tools/web...` installs the web app and its workspace
# dependencies (4 of 16 projects) rather than the whole monorepo, which would
# also pull Electron and Expo for apps this image does not contain.
#
# `--ignore-scripts` skips every lifecycle script. What they produce — the
# patched TypeScript binary for the language service, esbuild's and msgpackr's
# native bits — serves typechecking and tests, not `vp build`: the bundle this
# produces is byte-for-byte the same as one built with the scripts run. Skipping
# them also drops the build's only dependency on git, which the root `prepare`
# needs for `vp config` and node:24-slim does not carry.
RUN --mount=type=cache,target=/pnpm-store \
    pnpm install --frozen-lockfile --ignore-scripts --store-dir /pnpm-store --filter @t3tools/web...

# A non-empty proxy target is how apps/web/vite.config.ts is told that the
# backend is Moatless: it bakes VITE_MOATLESS_PROXY_AUTH (the client then
# checks /api/v1/auth/me for the Moatless session cookie instead of T3's own
# bootstrap route) and forces single-origin mode, so VITE_HTTP_URL/VITE_WS_URL
# stay empty and the client derives both from window.location.origin. Only the
# dev server ever dials the value itself, and this image does not run one —
# hence the deliberately non-URL default. Set it to `` to build a stock
# non-Moatless bundle.
ARG MOATLESS_BASE_URL=same-origin

# Source maps are ~37 MB and inline the full application source. Off by default
# for a published image; set to 1 for a build you intend to debug.
ARG T3CODE_WEB_SOURCEMAP=0

RUN MOATLESS_BASE_URL="${MOATLESS_BASE_URL}" \
    T3CODE_WEB_SOURCEMAP="${T3CODE_WEB_SOURCEMAP}" \
    pnpm --filter @t3tools/web build

# The MSW service worker is copied out of apps/web/public by the build but is
# only ever registered by the dev mock setup. Shipping a request interceptor to
# production is worth avoiding even though nothing here registers it.
RUN rm -f apps/web/dist/mockServiceWorker.js

# ---------------------------------------------------------------------------
# Runtime
# ---------------------------------------------------------------------------
FROM nginx-base

# Pull the latest patched Alpine packages on top of the base image. Bump the
# date to invalidate this layer and force `apk upgrade` to re-pull the newest
# security fixes for a CVE rebuild (same convention as moatless-frontend).
ARG APK_SECURITY_REFRESH=2026-07-31
RUN echo "OS security refresh: ${APK_SECURITY_REFRESH}" \
    && apk upgrade --no-cache

# Copy nginx configuration as an envsubst template. The base image entrypoint
# renders /etc/nginx/templates/*.template into /etc/nginx/conf.d/ at startup,
# substituting ${CSP_FRAME_SRC} (nginx's own $vars are left untouched — the
# entrypoint only substitutes names present in the environment).
COPY docker/nginx.conf /etc/nginx/templates/default.conf.template
COPY docker/nginx-security-headers.conf /etc/nginx/security-headers.conf
COPY --from=builder /src/apps/web/dist /usr/share/nginx/html

# Remove the base image's stock server config. The rendered template is the only
# config; if the entrypoint cannot write it, nginx must fail its probe loudly
# rather than silently serve the stock block (which 200s `/` but 404s every SPA
# deep link).
RUN rm -f /etc/nginx/conf.d/default.conf

# CSP frame-src value. The preview panel embeds per-task sandbox servers in a
# cross-origin iframe, so 'self' alone blocks them. Defaults to the external
# https preview URLs; local http clusters override it (e.g. to also allow
# http://*.preview.moatless.localhost).
ENV CSP_FRAME_SRC="https:"

# Fail the build, not the first request, on a malformed config. envsubst mirrors
# what the base image entrypoint does at startup: render the template into
# conf.d, test it, then drop the rendered copy so the entrypoint re-renders it
# from the runtime environment on boot. The single-name filter keeps nginx's own
# $vars ($uri, $request_method, …) literal.
RUN envsubst '${CSP_FRAME_SRC}' \
        < /etc/nginx/templates/default.conf.template \
        > /etc/nginx/conf.d/default.conf \
    && nginx -t \
    && rm -f /etc/nginx/conf.d/default.conf

ARG SOURCE_COMMIT=unknown
LABEL org.opencontainers.image.title="moatless-t3" \
      org.opencontainers.image.description="T3 Code web app served as a static SPA against the Moatless backend" \
      org.opencontainers.image.source="https://github.com/soaplabs/t3code" \
      org.opencontainers.image.revision="${SOURCE_COMMIT}"

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
