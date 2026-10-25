/**
 * The fetch mutator every generated Moatless call goes through. Fork-only.
 *
 * Same-origin and cookie-authenticated: no bearer token, no CORS preflight. It returns a failed
 * response instead of throwing, so the compiler sees each declared non-2xx branch; narrow on
 * `status` at the call site. A transport failure (DNS, TLS, abort) still throws.
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

/**
 * A failure that is neither of the two below. Nothing here raises it; it keeps a caller's
 * error channel a tagged union that can still hold a value from outside this contract.
 */
export class MoatlessUnexpectedError extends Error {
  readonly _tag = "MoatlessUnexpectedError";

  constructor(message: string, options?: { readonly cause?: unknown }) {
    super(message, options);
    this.name = "MoatlessUnexpectedError";
  }
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
 * `response.statusText` is empty under HTTP/2, which would give a blank toast, so prefer
 * the server's own words in the four shapes this API returns.
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
 * Where `/api` lives. Empty by default: the backend is reached on the origin that served
 * the app. Set via `configureMoatlessApi` rather than `import.meta.env`, so this package
 * needs no bundler-specific types.
 */
let baseUrl = "";

export function configureMoatlessApi(options: { readonly baseUrl?: string }): void {
  baseUrl = options.baseUrl ?? "";
}

function requestOrigin(): string {
  return typeof window === "undefined" ? "http://localhost" : window.location.origin;
}

const CSRF_COOKIE = "moatless_csrf";

/**
 * Echo the `moatless_csrf` cookie back as `X-CSRF-Token`.
 *
 * The backend gates unsafe methods behind this double-submit header; without it a
 * PATCH/POST/PUT/DELETE gets 403 `CSRF validation failed`.
 */
function withCsrfToken(init?: HeadersInit): Headers {
  const headers = new Headers(init);
  if (typeof document !== "undefined") {
    const token = document.cookie
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${CSRF_COOKIE}=`))
      ?.slice(CSRF_COOKIE.length + 1);
    if (token) {
      headers.set("X-CSRF-Token", token);
    }
  }
  return headers;
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
    response = await fetch(href, {
      ...options,
      headers: withCsrfToken(options?.headers),
      credentials: "include",
    });
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
 * Narrow a generated response union to its success branch, raising `MoatlessRequestError`
 * otherwise. For call sites with no status-specific recovery; those that handle a status
 * should switch on `status` instead.
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

/** Every way a call through this client fails, as one tagged union. */
export type MoatlessError = MoatlessRequestError | MoatlessTransportError | MoatlessUnexpectedError;

/** Any thrown value as the tagged union above. */
export function asMoatlessError(cause: unknown): MoatlessError {
  if (cause instanceof MoatlessRequestError) return cause;
  if (cause instanceof MoatlessTransportError) return cause;
  if (cause instanceof MoatlessUnexpectedError) return cause;
  return new MoatlessUnexpectedError(cause instanceof Error ? cause.message : String(cause), {
    cause,
  });
}
