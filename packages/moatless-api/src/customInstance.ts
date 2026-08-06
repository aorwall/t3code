/**
 * The fetch mutator every generated Moatless call goes through.
 *
 * Same-origin and cookie-authenticated: the Moatless session cookie is already
 * present on this origin, because Traefik matches `PathPrefix('/api')` against
 * the T3 host as well as the app host, and the Vite dev proxy forwards the same
 * prefix. There is no bearer token to attach and no CORS preflight to survive.
 *
 * # Why this returns a failed response instead of throwing
 *
 * Orval's `fetch` client types every declared non-2xx as part of the return
 * union — `createWorkspaceResponseError` is `{ data: ErrorBody; status: 400 |
 * 403 }`, not a thrown value. A mutator that throws on `!response.ok` makes
 * every one of those branches unreachable and hides from the compiler that a
 * 403 is a thing the endpoint says. So this returns the envelope and narrows on
 * `status` at the call site instead.
 *
 * A transport failure — DNS, TLS, offline, aborted — still throws, because
 * there is no envelope to return and no status to narrow on.
 */

/**
 * The envelope orval's generated code expects back. `data` is the decoded body
 * for any status; a 204 carries `null`.
 */
export interface MoatlessResponse<T = unknown> {
  readonly data: T;
  readonly status: number;
  readonly headers: Headers;
}

/** The request never reached a Moatless response. Not an HTTP status. */
export class MoatlessTransportError extends Error {
  readonly _tag = "MoatlessTransportError";
  readonly url: string;
  override readonly cause: unknown;

  constructor(url: string, cause: unknown) {
    super(
      `Could not reach the Moatless backend at ${url}: ${
        cause instanceof Error ? cause.message : String(cause)
      }`,
    );
    this.name = "MoatlessTransportError";
    this.url = url;
    this.cause = cause;
  }
}

/** A response arrived and its status was not one the caller could use. */
export class MoatlessRequestError extends Error {
  readonly _tag = "MoatlessRequestError";
  readonly status: number;
  readonly data: unknown;

  constructor(message: string, status: number, data: unknown) {
    super(message);
    this.name = "MoatlessRequestError";
    this.status = status;
    this.data = data;
  }

  /** The session is gone. The caller signs out rather than showing an error. */
  get isUnauthenticated(): boolean {
    return this.status === 401;
  }

  /**
   * Authenticated and not permitted. Distinct from the above because the
   * recovery differs: signing in again changes nothing, and the cached role
   * that let the control render is what is stale.
   */
  get isForbidden(): boolean {
    return this.status === 403;
  }
}

/**
 * The message to put on a request error.
 *
 * `response.statusText` cannot carry this on its own: HTTP/2 dropped the reason
 * phrase, so browsers report it as an empty string against any HTTP/2
 * deployment. An error built from it alone reaches the UI as a blank toast —
 * the request failed and the screen says nothing about why. The server's own
 * words are preferred, in the four shapes this API returns.
 *
 * Ported from the Moatless repo's `packages/api-client/custom-instance.ts:28`,
 * where those four shapes were established.
 */
export function errorMessage(status: number, statusText: string, body: unknown): string {
  if (typeof body === "object" && body !== null) {
    const data = body as Record<string, unknown>;
    const nested =
      typeof data["error"] === "object" && data["error"] !== null
        ? (data["error"] as Record<string, unknown>)["message"]
        : undefined;
    for (const candidate of [data["error"], nested, data["message"], data["detail"]]) {
      if (typeof candidate === "string" && candidate.length > 0) {
        return candidate;
      }
    }
  }

  return statusText || `Request failed with status ${status}`;
}

/**
 * Where `/api` lives, and how the app tells this package about it.
 *
 * Empty by default, because the backend is reached on whatever origin served
 * the app — which is true for both the browser build and the dev proxy. A build
 * with no useful `window.location.origin` to inherit calls `configureMoatlessApi`
 * at startup.
 *
 * Configured through a function rather than read from `import.meta.env` here so
 * this package needs no bundler-specific ambient types; the app owns its own
 * environment, and this owns the request.
 */
let baseUrl = "";

export function configureMoatlessApi(options: { readonly baseUrl?: string }): void {
  baseUrl = options.baseUrl ?? "";
}

function requestOrigin(): string {
  return typeof window === "undefined" ? "http://localhost" : window.location.origin;
}

export const customInstance = async <T>(
  url: string,
  options?: RequestInit & { params?: Record<string, unknown> },
): Promise<T> => {
  const target = new URL(`${baseUrl}${url}`, requestOrigin());

  if (options?.params) {
    for (const [key, value] of Object.entries(options.params)) {
      if (value !== undefined && value !== null) {
        target.searchParams.append(key, String(value));
      }
    }
  }

  const href = target.toString();
  let response: Response;
  try {
    // The repo-wide Effect rule wants `HttpClient` here. This package is the
    // orval-generated Moatless REST client and is deliberately outside Effect:
    // administration reads are plain HTTP with a cookie, and an `HttpClient`
    // would put a runtime and a layer between orval's generated call and the
    // request it is meant to make.
    // @effect-diagnostics-next-line globalFetch:off
    response = await fetch(href, { ...options, credentials: "include" });
  } catch (cause) {
    throw new MoatlessTransportError(href, cause);
  }

  // 204 has no body, and `response.json()` on an empty one rejects. Deletes
  // and activation clears answer this way.
  const data = response.status === 204 ? null : await response.json().catch(() => null);

  return {
    data,
    status: response.status,
    headers: response.headers,
  } as T;
};

export default customInstance;

/**
 * Narrow a generated response union to its success branch, raising
 * `MoatlessRequestError` for anything else.
 *
 * The union is what makes a declared 403 visible to the compiler; this is for
 * the majority of call sites that have no branch-specific recovery and want the
 * body or a failure. A call site that does handle a status specifically should
 * switch on `status` and never reach this.
 */
export function ok<T>(response: MoatlessResponse<unknown>): T {
  if (response.status >= 200 && response.status < 300) {
    return response.data as T;
  }
  throw new MoatlessRequestError(
    errorMessage(response.status, "", response.data),
    response.status,
    response.data,
  );
}
