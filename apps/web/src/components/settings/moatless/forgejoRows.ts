/**
 * Fork-only. What the Version control page says about the viewer's Forgejo
 * instances.
 *
 * Apart from `accountRows` because Forgejo is self-hosted: there is no single
 * account to read, so every rule here takes one instance's status, which the
 * deployment's own list of registered instances supplies.
 */

import type { ForgejoProviderTokenStatusResponse } from "@t3tools/moatless-api/generated/model";

/**
 * The `provider_tokens.auth_method` the OAuth2 flow writes. A stored personal
 * access token writes `secret_ref` instead.
 */
const AUTH_METHOD_FORGEJO_OAUTH = "forgejo_oauth";

/** The query parameter the connect flow returns the instance in. */
export const FORGEJO_HOST_PARAM = "forgejoHost";

/**
 * The host part of a value that may carry a whole URL, so it names the same
 * instance the backend does. Empty when the value names no host.
 *
 * Drops a scheme, a path, a query, a fragment and a trailing dot, which is what
 * the backend's own `normalize_host` drops. A host this disagrees with is a
 * host the page cannot match against the list it was given.
 *
 * The port is kept: `git.example.com:3000` is a different instance from
 * `git.example.com`, and the backend keys every credential on the whole
 * authority.
 */
export function forgejoHost(value: string): string {
  const withoutScheme = value.trim().replace(/^[a-z][a-z0-9+.-]*:\/\//i, "");
  const authority = withoutScheme.split(/[/?#]/)[0] ?? "";
  return authority.replace(/\.+$/, "").toLowerCase();
}

/** How the viewer's credential for one instance was obtained. */
export type ForgejoCredentialKind = "none" | "oauth" | "pat";

export interface ForgejoCredential {
  readonly kind: ForgejoCredentialKind;
  readonly label: string;
  readonly description: string;
}

/**
 * What the viewer is currently presenting to one instance.
 *
 * A personal access token outranks the OAuth credential behind it, so it is
 * reported as the token it is — describing the stashed credential would name
 * one no git operation uses.
 */
export function forgejoCredential(
  status: ForgejoProviderTokenStatusResponse | null,
): ForgejoCredential {
  if (status === null || !status.connected) {
    return {
      kind: "none",
      label: "Not connected",
      description: "Tasks you run cannot reach repositories on this instance.",
    };
  }
  if (status.authMethod === AUTH_METHOD_FORGEJO_OAUTH && !status.hasPatOverride) {
    return {
      kind: "oauth",
      label: "Authorized",
      description: "Acts as you on this instance, and renews itself.",
    };
  }
  return {
    kind: "pat",
    label: "Personal access token",
    description: status.hasPatOverride
      ? "Used instead of your authorized credential on this instance."
      : "Used for every repository you reach on this instance.",
  };
}

/**
 * Whether to offer the OAuth flow for this instance. False means no
 * administrator registered an OAuth2 application for it, which leaves a
 * personal access token the only way in.
 */
export function canConnectForgejoOauth(status: ForgejoProviderTokenStatusResponse | null): boolean {
  return status?.oauthAvailable === true;
}

/**
 * The label for the authorize button, or `null` when this instance has no
 * OAuth2 application to authorize against.
 *
 * Offered beside a personal access token rather than instead of one, on the
 * same terms as [`accountRows.githubConnectLabel`]: authorizing while a token
 * is set stashes the credential, and `hasPatOverride` then offers the switch
 * back to it.
 */
export function forgejoConnectLabel(
  status: ForgejoProviderTokenStatusResponse | null,
): string | null {
  if (!canConnectForgejoOauth(status)) {
    return null;
  }
  switch (forgejoCredential(status).kind) {
    case "none":
      return "Connect Forgejo";
    // Reauthorizing is how a revoked or narrowed credential is repaired, so it
    // is offered while one is already in place.
    case "oauth":
      return "Reauthorize";
    case "pat":
      return "Authorize with Forgejo";
  }
}

/**
 * Where to send the browser to authorize one instance.
 *
 * `returnTo` is absolute because the callback lands on the backend's own host,
 * which is not necessarily this one; the backend rejects an origin it does not
 * trust and falls back to its configured frontend.
 */
export function forgejoConnectUrl(host: string, returnTo: string): string {
  const params = new URLSearchParams({ host, return_to: returnTo });
  return `/api/v1/auth/forgejo/connect?${params.toString()}`;
}

/**
 * The instance a finished connect came back for.
 *
 * The callback carries no host of its own, so the page puts one in the return
 * URL and reads it back here. Without it the page returns to an empty host
 * field and reports an outcome for an instance it cannot name.
 */
export function forgejoConnectHost(search: string): string {
  return forgejoHost(new URLSearchParams(search).get(FORGEJO_HOST_PARAM) ?? "");
}

/** What a finished connect reported, read off the URL it returned to. */
export type ForgejoConnectOutcome =
  | { readonly tone: "success"; readonly message: string }
  | { readonly tone: "error"; readonly message: string };

/**
 * Read the outcome the backend appended, or `null` when this page load is not
 * the tail of a connect.
 */
export function forgejoConnectOutcome(search: string): ForgejoConnectOutcome | null {
  const outcome = new URLSearchParams(search).get("forgejoConnect");
  switch (outcome) {
    case "connected":
      return { tone: "success", message: "Forgejo connected." };
    case "pat_override":
      return {
        tone: "success",
        // Saying "connected" here would describe a credential no git operation
        // reaches: the token still wins until it is removed.
        message:
          "Forgejo authorized, but your personal access token is still the credential in use.",
      };
    case "denied":
      // Not a failure — the person declined on the instance's screen. Saying so
      // is still better than returning them to an unchanged page with no reply.
      return {
        tone: "error",
        message: "Forgejo authorization was cancelled. Nothing was changed.",
      };
    case "session_changed":
      // The backend refuses to write one person's Forgejo account onto whoever
      // is signed in now, which on a shared browser is a different person than
      // the one who started.
      return {
        tone: "error",
        message:
          "Your session changed while Forgejo was authorizing. Nothing was changed — try again.",
      };
    case "error":
      return { tone: "error", message: "Could not connect Forgejo. Try again." };
    default:
      return null;
  }
}
