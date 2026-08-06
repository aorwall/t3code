import { describe, expect, it } from "vite-plus/test";

import { repositoryProviderIcon } from "./repositoryProvider";

describe("repositoryProviderIcon", () => {
  it("uses the declared provider when there is one", () => {
    expect(repositoryProviderIcon({ provider: "github", remoteUrl: null })).toBe("github");
    expect(repositoryProviderIcon({ provider: "gitlab", remoteUrl: null })).toBe("gitlab");
  });

  it("lets the declared provider win over a remote that says otherwise", () => {
    // A self-hosted GitLab behind a vanity domain is why the field exists.
    expect(
      repositoryProviderIcon({ provider: "gitlab", remoteUrl: "https://code.acme.dev/a/b.git" }),
    ).toBe("gitlab");
  });

  it("falls back to plain git for a provider with no mark of its own", () => {
    expect(repositoryProviderIcon({ provider: "gitness", remoteUrl: null })).toBe("git");
  });

  it("reads the host when the provider was never stamped", () => {
    expect(
      repositoryProviderIcon({ provider: null, remoteUrl: "https://github.com/acme/api.git" }),
    ).toBe("github");
    // Omitted rather than null: both shapes reach this from the wire.
    expect(repositoryProviderIcon({ remoteUrl: "https://gitlab.com/acme/api" })).toBe("gitlab");
    expect(
      repositoryProviderIcon({ provider: null, remoteUrl: "https://bitbucket.org/acme/api" }),
    ).toBe("bitbucket");
    expect(
      repositoryProviderIcon({ provider: null, remoteUrl: "https://dev.azure.com/acme/_git/api" }),
    ).toBe("azure-devops");
  });

  it("reads the host out of an ssh remote too", () => {
    expect(
      repositoryProviderIcon({ provider: null, remoteUrl: "git@github.com:acme/api.git" }),
    ).toBe("github");
    expect(
      repositoryProviderIcon({ provider: null, remoteUrl: "git@gitlab.acme.dev:acme/api.git" }),
    ).toBe("gitlab");
  });

  it("strips credentials rather than reading them as the host", () => {
    expect(
      repositoryProviderIcon({ provider: null, remoteUrl: "https://user:pw@github.com/acme/api" }),
    ).toBe("github");
  });

  it("matches whole labels, so a host that merely contains the word is not the host", () => {
    expect(
      repositoryProviderIcon({ provider: null, remoteUrl: "https://git.acme.dev/github/api.git" }),
    ).toBe("git");
    expect(
      repositoryProviderIcon({ provider: null, remoteUrl: "https://notgithub.com/acme/api" }),
    ).toBe("git");
  });

  it("falls back to plain git when there is nothing to read", () => {
    expect(repositoryProviderIcon({ provider: null, remoteUrl: null })).toBe("git");
    expect(repositoryProviderIcon({ provider: null, remoteUrl: "   " })).toBe("git");
    expect(repositoryProviderIcon({ provider: null, remoteUrl: "/srv/repos/api" })).toBe("git");
  });
});
