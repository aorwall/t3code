import { describe, expect, it } from "vite-plus/test";

import type { ForgejoProviderTokenStatusResponse } from "@t3tools/moatless-api/generated/model";

import {
  canConnectForgejoOauth,
  forgejoConnectHost,
  forgejoConnectLabel,
  forgejoConnectOutcome,
  forgejoConnectUrl,
  forgejoCredential,
  forgejoHost,
} from "./forgejoRows";

function forgejo(
  overrides: Partial<ForgejoProviderTokenStatusResponse>,
): ForgejoProviderTokenStatusResponse {
  return {
    host: "git.example.com",
    connected: true,
    hasPatOverride: false,
    oauthAvailable: true,
    ...overrides,
  };
}

describe("forgejoHost", () => {
  it("reads the same instance out of a bare host and a pasted URL", () => {
    expect(forgejoHost("git.example.com")).toBe("git.example.com");
    expect(forgejoHost(" https://git.example.com/owner/repo ")).toBe("git.example.com");
    expect(forgejoHost("HTTP://Git.Example.COM/")).toBe("git.example.com");
  });

  it("drops what the backend drops, so a typed host matches a listed one", () => {
    expect(forgejoHost("git.example.com/?ref=main#top")).toBe("git.example.com");
    expect(forgejoHost("git.example.com.")).toBe("git.example.com");
  });

  it("keeps the port — it is part of which instance this is", () => {
    expect(forgejoHost("http://git.example.com:3000/owner")).toBe("git.example.com:3000");
  });

  it("reports nothing for a value that names no host", () => {
    expect(forgejoHost("")).toBe("");
    expect(forgejoHost("   ")).toBe("");
    expect(forgejoHost("https://")).toBe("");
  });
});

describe("forgejoCredential", () => {
  it("reads a disconnected status and a missing one alike", () => {
    expect(forgejoCredential(null).kind).toBe("none");
    expect(forgejoCredential(forgejo({ connected: false })).kind).toBe("none");
  });

  it("names an authorized credential for what it does", () => {
    const credential = forgejoCredential(forgejo({ authMethod: "forgejo_oauth" }));
    expect(credential.kind).toBe("oauth");
    expect(credential.description).toContain("renews itself");
  });

  it("reports the token in use when a PAT stands in front of an authorization", () => {
    // The stashed credential reaches nothing until the override is removed, so
    // describing it here would name one no git operation uses.
    const credential = forgejoCredential(
      forgejo({ authMethod: "forgejo_oauth", hasPatOverride: true }),
    );
    expect(credential.kind).toBe("pat");
    expect(credential.description).toContain("instead of your authorized credential");
  });

  it("distinguishes a PAT that is the only credential from one that overrides", () => {
    const credential = forgejoCredential(forgejo({ authMethod: "secret_ref" }));
    expect(credential.kind).toBe("pat");
    expect(credential.description).not.toContain("instead of");
  });

  it("keeps an unknown auth method usable rather than reporting nothing connected", () => {
    // A row whose method this build does not know is still a credential the
    // sandbox will present; calling it "not connected" would invite a reconnect
    // that overwrites a working one.
    expect(forgejoCredential(forgejo({ authMethod: "manual" })).kind).toBe("pat");
  });
});

describe("canConnectForgejoOauth", () => {
  it("offers the OAuth flow only for an instance an administrator registered", () => {
    expect(canConnectForgejoOauth(forgejo({ oauthAvailable: true }))).toBe(true);
    expect(canConnectForgejoOauth(forgejo({ oauthAvailable: false }))).toBe(false);
    expect(canConnectForgejoOauth(null)).toBe(false);
  });
});

describe("forgejoConnectLabel", () => {
  it("names the OAuth flow for what it does to each starting point", () => {
    expect(forgejoConnectLabel(forgejo({ connected: false }))).toBe("Connect Forgejo");
    expect(forgejoConnectLabel(forgejo({ authMethod: "forgejo_oauth" }))).toBe("Reauthorize");
  });

  it("offers the OAuth flow to someone who already set a token", () => {
    // A token overrides the authorization; it does not replace the option of
    // holding one. Without this the only way to reach OAuth is deleting the
    // token first and trusting the credential comes back.
    expect(forgejoConnectLabel(forgejo({ authMethod: "secret_ref" }))).toBe(
      "Authorize with Forgejo",
    );
    expect(
      forgejoConnectLabel(forgejo({ authMethod: "forgejo_oauth", hasPatOverride: true })),
    ).toBe("Authorize with Forgejo");
  });

  it("offers nothing for an instance with no OAuth application", () => {
    expect(forgejoConnectLabel(forgejo({ oauthAvailable: false }))).toBeNull();
    expect(forgejoConnectLabel(null)).toBeNull();
  });
});

describe("forgejoConnectUrl", () => {
  it("names the instance and encodes the return URL so its own query survives", () => {
    expect(
      forgejoConnectUrl(
        "git.example.com",
        "https://t3.example/settings/version-control?forgejoHost=x",
      ),
    ).toBe(
      "/api/v1/auth/forgejo/connect?host=git.example.com&return_to=https%3A%2F%2Ft3.example%2Fsettings%2Fversion-control%3FforgejoHost%3Dx",
    );
  });
});

describe("forgejoConnectHost", () => {
  it("recovers the instance the callback ran for — it carries no host of its own", () => {
    expect(forgejoConnectHost("?forgejoConnect=connected&forgejoHost=git.example.com")).toBe(
      "git.example.com",
    );
  });

  it("reports nothing for a page load that carries no instance", () => {
    expect(forgejoConnectHost("")).toBe("");
    expect(forgejoConnectHost("?forgejoConnect=denied")).toBe("");
  });
});

describe("forgejoConnectOutcome", () => {
  it("reads nothing from a page load that is not the tail of a connect", () => {
    expect(forgejoConnectOutcome("")).toBeNull();
    expect(forgejoConnectOutcome("?tab=git")).toBeNull();
    expect(forgejoConnectOutcome("?forgejoConnect=something-else")).toBeNull();
  });

  it("does not call a PAT-blocked authorization a success story", () => {
    const outcome = forgejoConnectOutcome("?forgejoConnect=pat_override");
    expect(outcome?.tone).toBe("success");
    expect(outcome?.message).toContain("still the credential in use");
  });

  it("reports every non-success outcome the backend can send", () => {
    // Anything falling through to `null` returns the person to an unchanged
    // page with no reply, which is the state this whole parameter exists to
    // avoid — so each outcome the backend emits is pinned here.
    for (const outcome of ["error", "denied", "session_changed"]) {
      expect(forgejoConnectOutcome(`?forgejoConnect=${outcome}`)?.tone).toBe("error");
    }
  });

  it("says a cancelled authorization changed nothing", () => {
    expect(forgejoConnectOutcome("?forgejoConnect=denied")?.message).toContain("cancelled");
  });
});
