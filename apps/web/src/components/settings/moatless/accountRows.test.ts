import { describe, expect, it } from "vite-plus/test";

import type {
  CodexAgentHarnessCredentialStatusResponse,
  GitHubProviderTokenStatusResponse,
  SecretMetadataResponse,
} from "@t3tools/moatless-api/generated/model";

import {
  CLAUDE_TOKEN_SECRET_KEY,
  canConnectGithubApp,
  claudeTokenSecret,
  codexState,
  githubConnectLabel,
  githubConnectOutcome,
  githubConnectUrl,
  githubCredential,
  isCodexAuthJson,
  withoutConnectOutcome,
} from "./accountRows";

function github(
  overrides: Partial<GitHubProviderTokenStatusResponse>,
): GitHubProviderTokenStatusResponse {
  return {
    connected: true,
    hasPatOverride: false,
    appConnectAvailable: true,
    ...overrides,
  };
}

function secret(overrides: Partial<SecretMetadataResponse>): SecretMetadataResponse {
  return {
    id: "s_1",
    key: CLAUDE_TOKEN_SECRET_KEY,
    kind: "env",
    scope: "user",
    source: "inline_encrypted",
    enabled: true,
    updatedAt: "2026-01-01T00:00:00Z",
    version: 1,
    ...overrides,
  };
}

describe("githubCredential", () => {
  it("names an app credential by the app, not by how the viewer signed in", () => {
    const credential = githubCredential(github({ authMethod: "github_app", login: "ada" }));
    expect(credential.kind).toBe("app");
    expect(credential.login).toBe("ada");
  });

  it("reports the token in use when a PAT stands in front of an app credential", () => {
    // The stashed app token reaches nothing until the override is removed, so
    // describing it here would name a credential no git operation uses.
    const credential = githubCredential(
      github({ authMethod: "secret_ref", tokenType: "pat", hasPatOverride: true }),
    );
    expect(credential.kind).toBe("pat");
    expect(credential.description).toContain("instead of your GitHub App");
  });

  it("distinguishes a PAT that is the only credential from one that overrides", () => {
    const credential = githubCredential(github({ authMethod: "secret_ref", tokenType: "pat" }));
    expect(credential.kind).toBe("pat");
    expect(credential.description).not.toContain("instead of");
  });

  it("separates an installation from an app user token — they act as different accounts", () => {
    expect(githubCredential(github({ authMethod: "github_app_installation" })).kind).toBe(
      "installation",
    );
  });

  it("reads a disconnected status and a missing one alike", () => {
    expect(githubCredential(null).kind).toBe("none");
    expect(githubCredential(github({ connected: false })).kind).toBe("none");
  });

  it("keeps an unknown auth method usable rather than reporting nothing connected", () => {
    // A row whose method this build does not know is still a credential the
    // sandbox will present; calling it "not connected" would invite a reconnect
    // that overwrites a working one.
    const credential = githubCredential(github({ authMethod: "manual" }));
    expect(credential.kind).toBe("pat");
  });
});

describe("canConnectGithubApp", () => {
  it("offers the app flow only where the deployment configured it", () => {
    expect(canConnectGithubApp(github({ appConnectAvailable: true }))).toBe(true);
    expect(canConnectGithubApp(github({ appConnectAvailable: false }))).toBe(false);
    expect(canConnectGithubApp(null)).toBe(false);
  });
});

describe("githubConnectLabel", () => {
  it("offers the app flow to someone who already set a token", () => {
    // A token overrides the app credential; it does not replace the option of
    // having one. Without this the only way to reach the app is deleting the
    // token first and trusting it comes back.
    expect(githubConnectLabel(github({ authMethod: "secret_ref", tokenType: "pat" }))).toBe(
      "Connect GitHub App",
    );
  });

  it("still offers it when the token already overrides a stashed app credential", () => {
    expect(
      githubConnectLabel(
        github({ authMethod: "secret_ref", tokenType: "pat", hasPatOverride: true }),
      ),
    ).toBe("Connect GitHub App");
  });

  it("names the app flow for what it does to each starting point", () => {
    expect(githubConnectLabel(github({ connected: false }))).toBe("Connect GitHub");
    expect(githubConnectLabel(github({ authMethod: "github_app" }))).toBe("Reauthorize");
  });

  it("offers nothing where the deployment has no app to authorize", () => {
    expect(githubConnectLabel(github({ appConnectAvailable: false }))).toBeNull();
    expect(githubConnectLabel(null)).toBeNull();
  });

  it("offers nothing against an installation — it acts as the app, not the viewer", () => {
    expect(githubConnectLabel(github({ authMethod: "github_app_installation" }))).toBeNull();
  });
});

describe("githubConnectUrl", () => {
  it("encodes the return URL so its own query survives the round trip", () => {
    expect(githubConnectUrl("https://t3.example/settings/account?tab=git")).toBe(
      "/api/v1/auth/github-app/connect?return_to=https%3A%2F%2Ft3.example%2Fsettings%2Faccount%3Ftab%3Dgit",
    );
  });
});

describe("githubConnectOutcome", () => {
  it("reads nothing from a page load that is not the tail of a connect", () => {
    expect(githubConnectOutcome("")).toBeNull();
    expect(githubConnectOutcome("?tab=git")).toBeNull();
    expect(githubConnectOutcome("?githubConnect=something-else")).toBeNull();
  });

  it("does not call a PAT-blocked authorization a success story", () => {
    const outcome = githubConnectOutcome("?githubConnect=pat_override");
    expect(outcome?.tone).toBe("success");
    expect(outcome?.message).toContain("still the credential in use");
  });

  it("reports every non-success outcome the backend can send", () => {
    // Anything falling through to `null` returns the person to an unchanged
    // page with no reply, which is the state this whole parameter exists to
    // avoid — so each outcome the backend emits is pinned here.
    for (const outcome of ["error", "empty_token", "denied", "session_changed"]) {
      expect(githubConnectOutcome(`?githubConnect=${outcome}`)?.tone).toBe("error");
    }
  });

  it("says a cancelled authorization changed nothing", () => {
    expect(githubConnectOutcome("?githubConnect=denied")?.message).toContain("cancelled");
  });
});

describe("withoutConnectOutcome", () => {
  it("strips only the outcome, so a reload does not re-announce it", () => {
    expect(
      withoutConnectOutcome("https://t3.example/settings/account?githubConnect=connected"),
    ).toBe("/settings/account");
    expect(
      withoutConnectOutcome("https://t3.example/settings/account?tab=git&githubConnect=connected"),
    ).toBe("/settings/account?tab=git");
  });

  it("strips every provider's parameters, not just the one being connected", () => {
    // The return URL a section builds is the URL every other section's
    // parameters would otherwise ride back in on.
    expect(
      withoutConnectOutcome(
        "https://t3.example/settings/account?forgejoConnect=denied&forgejoHost=git.example.com",
      ),
    ).toBe("/settings/account");
  });
});

describe("claudeTokenSecret", () => {
  it("reads a disabled secret as absent — a sandbox never receives it", () => {
    expect(claudeTokenSecret([secret({ enabled: false })])).toBeNull();
  });

  it("finds the token by its env var name and ignores everything else", () => {
    expect(claudeTokenSecret([secret({ key: "OTHER" })])).toBeNull();
    expect(claudeTokenSecret([secret({})])?.key).toBe(CLAUDE_TOKEN_SECRET_KEY);
    expect(claudeTokenSecret(null)).toBeNull();
  });
});

describe("codexState", () => {
  function codex(
    overrides: Partial<CodexAgentHarnessCredentialStatusResponse>,
  ): CodexAgentHarnessCredentialStatusResponse {
    return { connected: true, ...overrides };
  }

  it("treats a permanent refresh failure as its own state, not as disconnected", () => {
    const state = codexState(codex({ needsReconnect: true, email: "ada@example.com" }));
    expect(state.connected).toBe(true);
    expect(state.needsReconnect).toBe(true);
    expect(state.detail).toBe("ada@example.com");
  });

  it("joins the account facts it has and reports none when it has neither", () => {
    expect(codexState(codex({ email: "ada@example.com", planType: "pro" })).detail).toBe(
      "ada@example.com · pro",
    );
    expect(codexState(codex({})).detail).toBeNull();
  });

  it("reads a disconnected status and a missing one alike", () => {
    expect(codexState(null).connected).toBe(false);
    expect(codexState(codex({ connected: false })).connected).toBe(false);
  });
});

describe("isCodexAuthJson", () => {
  it("accepts a JSON object and rejects anything the backend cannot use", () => {
    expect(isCodexAuthJson('{"tokens":{}}')).toBe(true);
    expect(isCodexAuthJson("  ")).toBe(false);
    expect(isCodexAuthJson("not json")).toBe(false);
    // A bare array or scalar parses but is not an auth blob.
    expect(isCodexAuthJson("[]")).toBe(false);
    expect(isCodexAuthJson("42")).toBe(false);
    expect(isCodexAuthJson("null")).toBe(false);
  });
});
