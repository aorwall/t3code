import { layerRemoteHttpClient } from "@t3tools/client-runtime/rpc";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { FetchHttpClient, HttpClient, HttpClientRequest } from "effect/http";

import { readDesktopPrimaryBearerToken } from "./desktopAuth";

// Fork: no same-origin gate. Moatless is reached through a single-origin proxy
// or cross-origin with cookies, so every http(s) browser primary uses cookies.
function isBrowserPrimary(): boolean {
  return (
    typeof window !== "undefined" &&
    window.desktopBridge === undefined &&
    window.location.origin.startsWith("http")
  );
}

// Fork: Moatless guards an unsafe cookie-authenticated request with a
// double-submit CSRF token, so one that does not echo the `moatless_csrf`
// cookie in `x-csrf-token` is 403ed by the auth middleware before any handler
// sees it. The cookie is not HttpOnly precisely so this can read it. The
// unsafe HTTP requests are the OTLP export in `observability/clientTracing.ts`
// and the pull request diff, which goes through `lib/runtime.ts`'s client
// (`withSameOriginMoatlessCsrfToken`); every other write rides the `/ws` socket.
const MOATLESS_CSRF_COOKIE = "moatless_csrf";

/** Read per request: a re-login mints a new token under the same cookie. */
function readMoatlessCsrfToken(): string | null {
  if (typeof document === "undefined") {
    return null;
  }
  const value = new RegExp(`(?:^|;\\s*)${MOATLESS_CSRF_COOKIE}=([^;]*)`).exec(document.cookie)?.[1];
  return value === undefined ? null : decodeURIComponent(value);
}

// Fork: see MOATLESS_CSRF_COOKIE.
function withMoatlessCsrfToken(client: HttpClient.HttpClient): HttpClient.HttpClient {
  return client.pipe(
    HttpClient.mapRequest((request) => {
      const token = readMoatlessCsrfToken();
      return token === null ? request : HttpClientRequest.setHeader(request, "x-csrf-token", token);
    }),
  );
}

/**
 * Fork: see MOATLESS_CSRF_COOKIE. For a client that also reaches other hosts,
 * such as the relay: the token goes only to this page's origin, rather than
 * to every host the client calls.
 */
export function withSameOriginMoatlessCsrfToken(
  client: HttpClient.HttpClient,
): HttpClient.HttpClient {
  return client.pipe(
    HttpClient.mapRequest((request) => {
      if (typeof window === "undefined" || !isSameOrigin(request.url)) {
        return request;
      }
      const token = readMoatlessCsrfToken();
      return token === null ? request : HttpClientRequest.setHeader(request, "x-csrf-token", token);
    }),
  );
}

function isSameOrigin(url: string): boolean {
  try {
    return new URL(url, window.location.href).origin === window.location.origin;
  } catch {
    return false;
  }
}

function withPrimaryBearerToken(client: HttpClient.HttpClient): HttpClient.HttpClient {
  return client.pipe(
    HttpClient.mapRequestEffect((request) =>
      Effect.promise(readDesktopPrimaryBearerToken).pipe(
        Effect.map((bearerToken) =>
          bearerToken ? HttpClientRequest.bearerToken(request, bearerToken) : request,
        ),
      ),
    ),
  );
}

export function layerForCurrentOrigin() {
  return Layer.unwrap(
    Effect.sync(() => {
      const layerBase = layerRemoteHttpClient(globalThis.fetch);
      if (isBrowserPrimary()) {
        // Fork: see MOATLESS_CSRF_COOKIE.
        const layerCsrfClient = Layer.effect(
          HttpClient.HttpClient,
          Effect.map(HttpClient.HttpClient, withMoatlessCsrfToken),
        ).pipe(Layer.provide(layerBase));

        return Layer.merge(
          layerCsrfClient,
          Layer.succeed(FetchHttpClient.RequestInit, { credentials: "include" }),
        );
      }

      const layerBearerClient = Layer.effect(
        HttpClient.HttpClient,
        Effect.map(HttpClient.HttpClient, withPrimaryBearerToken),
      ).pipe(Layer.provide(layerBase));

      return Layer.merge(
        layerBearerClient,
        Layer.succeed(FetchHttpClient.RequestInit, { credentials: "omit" }),
      );
    }),
  );
}

export const layer = layerForCurrentOrigin();
