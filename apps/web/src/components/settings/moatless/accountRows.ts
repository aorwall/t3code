/**
 * Fork-only. What the Account page says about each credential the viewer holds.
 *
 * Every rule that decides a label, an affordance or a URL lives here rather than
 * in the panel, because each one is a claim about the backend's model — which
 * `auth_method` means what, when a PAT is an override rather than the only
 * credential — and those are worth pinning in a test.
 */

import type {
  CodexAgentHarnessCredentialStatusResponse,
  GitHubProviderTokenStatusResponse,
  SecretMetadataResponse,
} from "@t3tools/moatless-api/generated/model";

/** Env var the sandbox reads to authenticate Claude Code. */
export const CLAUDE_TOKEN_SECRET_KEY = "CLAUDE_CODE_OAUTH_TOKEN";

/**
 * `provider_tokens.auth_method` values. Named after the GitHub App that issued
 * a token, never after a way of signing in: a viewer who authenticated through
 * OIDC still holds `github_app` once they connect.
 */
const AUTH_METHOD_APP_USER = "github_app";
const AUTH_METHOD_APP_INSTALLATION = "github_app_installation";

/** How the viewer's GitHub credential was obtained, in the page's terms. */
export type GithubCredentialKind = "none" | "app" | "installation" | "pat";

export interface GithubCredential {
  readonly kind: GithubCredentialKind;
  readonly label: string;
  readonly description: string;
  /** The account the credential acts as, when the backend recorded one. */
  readonly login: string | null;
}

/**
 * What the viewer is currently presenting to GitHub.
 *
 * A PAT override outranks the App credential behind it, so it is reported as
 * the PAT it is — describing the stashed App token would name a credential no
 * git operation uses.
 */
export function githubCredential(
  status: GitHubProviderTokenStatusResponse | null,
): GithubCredential {
  const login = status?.login ?? null;
  if (status === null || !status.connected) {
    return {
      kind: "none",
      label: "Not connected",
      description: "Tasks you run cannot reach private repositories.",
      login: null,
    };
  }
  if (status.hasPatOverride || status.tokenType === "pat") {
    return {
      kind: "pat",
      label: "Personal access token",
      description: status.hasPatOverride
        ? "Used instead of your GitHub App credential for every repository."
        : "Used for every repository you reach.",
      login,
    };
  }
  if (status.authMethod === AUTH_METHOD_APP_INSTALLATION) {
    return {
      kind: "installation",
      label: "GitHub App installation",
      description: "Acts as the app, scoped to what each organization granted it.",
      login,
    };
  }
  if (status.authMethod === AUTH_METHOD_APP_USER) {
    return {
      kind: "app",
      label: "GitHub App",
      description: "Acts as you, on repositories the app is installed on. Renews itself.",
      login,
    };
  }
  return {
    kind: "pat",
    label: "Stored token",
    description: "Used for every repository you reach.",
    login,
  };
}

/**
 * Whether to offer the app flow. False leaves a token the only way in, which is
 * what the deployment has configured — not something the page can work around.
 */
export function canConnectGithubApp(status: GitHubProviderTokenStatusResponse | null): boolean {
  return status?.appConnectAvailable === true;
}

/**
 * The label for the app-authorization button, or `null` when this viewer has no
 * app flow worth offering.
 *
 * Offered beside a personal access token rather than instead of one. A token
 * overrides the app credential; it does not replace the option of having one.
 * Authorizing while a token is set stashes the app credential, and
 * `hasPatOverride` then offers the switch to it — so without this the only way
 * to reach the app is deleting the token first and trusting it comes back.
 */
export function githubConnectLabel(
  status: GitHubProviderTokenStatusResponse | null,
): string | null {
  if (!canConnectGithubApp(status)) {
    return null;
  }
  switch (githubCredential(status).kind) {
    case "none":
      return "Connect GitHub";
    // Reauthorizing is how an expired or narrowed credential is repaired, so it
    // is offered while one is already in place.
    case "app":
      return "Reauthorize";
    case "pat":
      return "Connect GitHub App";
    // An installation acts as the app itself, not as the viewer, so there is no
    // user authorization here to run.
    case "installation":
      return null;
  }
}

/**
 * Where to send the browser to authorize the app.
 *
 * `returnTo` is absolute because the callback lands on the backend's own host,
 * which is not necessarily this one; the backend rejects an origin it does not
 * trust and falls back to its configured frontend.
 */
export function githubConnectUrl(returnTo: string): string {
  return `/api/v1/auth/github-app/connect?return_to=${encodeURIComponent(returnTo)}`;
}

/** What a finished connect reported, read off the URL it returned to. */
export type GithubConnectOutcome =
  | { readonly tone: "success"; readonly message: string }
  | { readonly tone: "error"; readonly message: string };

/**
 * Read the outcome the backend appended, or `null` when this page load is not
 * the tail of a connect.
 */
export function githubConnectOutcome(search: string): GithubConnectOutcome | null {
  const outcome = new URLSearchParams(search).get("githubConnect");
  switch (outcome) {
    case "connected":
      return { tone: "success", message: "GitHub connected." };
    case "pat_override":
      return {
        tone: "success",
        // Saying "connected" here would describe a credential no git operation
        // reaches: the token still wins until it is removed.
        message:
          "GitHub authorized, but your personal access token is still the credential in use.",
      };
    case "denied":
      // Not a failure — the person declined on GitHub's screen. Saying so is
      // still better than returning them to an unchanged page with no reply.
      return { tone: "error", message: "GitHub authorization was cancelled. Nothing was changed." };
    case "session_changed":
      // The backend refuses to write one person's GitHub account onto
      // whoever is signed in now, which on a shared browser is a different
      // person than the one who started.
      return {
        tone: "error",
        message:
          "Your session changed while GitHub was authorizing. Nothing was changed — try again.",
      };
    case "empty_token":
      return { tone: "error", message: "GitHub returned no token. Nothing was changed." };
    case "error":
      return { tone: "error", message: "Could not connect GitHub. Try again." };
    default:
      return null;
  }
}

/** The same URL with the outcome stripped, so a reload does not re-announce it. */
export function withoutConnectOutcome(url: string): string {
  const parsed = new URL(url);
  parsed.searchParams.delete("githubConnect");
  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

/**
 * The viewer's stored Claude Code token, or `null` when there is none to use.
 *
 * A disabled secret reads as absent: it is not delivered to a sandbox, so
 * showing it as configured would promise a credential no task receives.
 */
export function claudeTokenSecret(
  secrets: ReadonlyArray<SecretMetadataResponse> | null,
): SecretMetadataResponse | null {
  return (
    secrets?.find((secret) => secret.key === CLAUDE_TOKEN_SECRET_KEY && secret.enabled) ?? null
  );
}

export interface CodexState {
  readonly connected: boolean;
  readonly needsReconnect: boolean;
  readonly label: string;
  readonly detail: string | null;
}

/**
 * What the viewer's Codex credential is doing.
 *
 * A permanent refresh failure is its own state rather than a flavour of
 * disconnected: the row is still there, and the way out is signing in again
 * rather than choosing a save path.
 */
export function codexState(status: CodexAgentHarnessCredentialStatusResponse | null): CodexState {
  if (status === null || !status.connected) {
    return {
      connected: false,
      needsReconnect: false,
      label: "Not connected",
      detail: null,
    };
  }
  const detail = [status.email, status.planType].filter((part) => Boolean(part)).join(" · ");
  if (status.needsReconnect === true) {
    return {
      connected: true,
      needsReconnect: true,
      label: "Sign in again",
      detail: detail.length > 0 ? detail : null,
    };
  }
  return {
    connected: true,
    needsReconnect: false,
    label: "Connected",
    detail: detail.length > 0 ? detail : null,
  };
}

/** Whether `value` is worth sending as an `auth.json` blob. */
export function isCodexAuthJson(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length === 0) return false;
  try {
    const parsed: unknown = JSON.parse(trimmed);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed);
  } catch {
    return false;
  }
}
