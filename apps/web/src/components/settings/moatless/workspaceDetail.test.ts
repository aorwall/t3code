import { describe, expect, it } from "vite-plus/test";

import type {
  RepositoryResponse,
  WorkspaceRepoResponse,
  WorkspaceResponse,
} from "@t3tools/moatless-api/generated/model";

import {
  availableRepositories,
  filterRepositories,
  formatSetupCommands,
  parseSetupCommands,
  placementRows,
  repositoryNameFromRemote,
  shortenRemote,
  workspaceProvenance,
} from "./workspaceDetail";

function workspace(overrides: Partial<WorkspaceResponse> = {}): WorkspaceResponse {
  return {
    id: "ws_1",
    kind: "blank",
    name: "api",
    repos: [],
    scope: "global",
    ...overrides,
  };
}

function placement(overrides: Partial<WorkspaceRepoResponse> = {}): WorkspaceRepoResponse {
  return {
    id: "pl_1",
    isPrimary: false,
    position: 0,
    repositoryId: "r1",
    workspaceId: "ws_1",
    ...overrides,
  };
}

function repository(overrides: Partial<RepositoryResponse> = {}): RepositoryResponse {
  return {
    id: "r1",
    kind: "git",
    name: "api",
    scope: "global",
    ...overrides,
  };
}

describe("workspaceProvenance", () => {
  it("locks a workspace git still declares", () => {
    const result = workspaceProvenance(
      workspace({ source: "git", sourceConfigPath: ".moatless/workspaces.json" }),
    );

    expect(result.isLocked).toBe(true);
    expect(result.isOverridden).toBe(false);
    expect(result.configPath).toBe(".moatless/workspaces.json");
  });

  it("offers a restore once a git-declared workspace has been overridden", () => {
    const result = workspaceProvenance(
      workspace({
        source: "manual",
        syncedFromGit: false,
        sourceRepositoryId: "r1",
        sourceConfigPath: ".moatless/workspaces.json",
      }),
    );

    expect(result.isLocked).toBe(false);
    expect(result.isOverridden).toBe(true);
  });

  it("says nothing about git for a workspace that was never declared in it", () => {
    const result = workspaceProvenance(workspace({ source: "manual" }));

    expect(result.isLocked).toBe(false);
    expect(result.isOverridden).toBe(false);
  });
});

describe("placementRows", () => {
  it("puts the primary repository first and the rest in mount order", () => {
    const rows = placementRows(
      workspace({
        repos: [
          placement({ id: "pl_b", repositoryId: "r2", position: 1 }),
          placement({ id: "pl_c", repositoryId: "r3", position: 2 }),
          placement({ id: "pl_a", repositoryId: "r1", position: 3, isPrimary: true }),
        ],
      }),
      [
        repository({ id: "r1", name: "api" }),
        repository({ id: "r2", name: "web" }),
        repository({ id: "r3", name: "infra" }),
      ],
    );

    expect(rows.map((row) => row.name)).toEqual(["api", "web", "infra"]);
  });

  it("names the remote, an overridden branch and a mount, and nothing else", () => {
    const [row] = placementRows(
      workspace({ repos: [placement({ branch: "next", mountName: "vendor/api" })] }),
      [repository({ remoteUrl: "https://github.com/acme/api.git" })],
    );

    expect(row?.detail).toBe("github.com/acme/api · next · mounted at vendor/api");
  });

  it("says nothing about the branch when the placement uses the repository default", () => {
    const [row] = placementRows(workspace({ repos: [placement()] }), [
      repository({ remoteUrl: "https://github.com/acme/api", defaultBranch: "main" }),
    ]);

    expect(row?.detail).toBe("github.com/acme/api");
  });

  it("carries the repository's host so the row can mark it", () => {
    const [row] = placementRows(workspace({ repos: [placement()] }), [
      repository({ remoteUrl: "https://github.com/acme/api.git" }),
    ]);

    expect(row?.icon).toBe("github");
  });

  it("keeps a placement whose repository the catalog has never heard of", () => {
    const [row] = placementRows(workspace({ repos: [placement({ repositoryId: "r_gone" })] }), []);

    expect(row?.isDangling).toBe(true);
    expect(row?.name).toBe("r_gone");
    // Plain git rather than nothing: the row still needs a mark, and there is
    // no repository to read a host from.
    expect(row?.icon).toBe("git");
  });
});

describe("shortenRemote", () => {
  it("drops the scheme and the .git suffix", () => {
    expect(shortenRemote("https://github.com/acme/api.git")).toBe("github.com/acme/api");
  });

  it("reads an scp-style remote as a path", () => {
    expect(shortenRemote("git@github.com:acme/api.git")).toBe("github.com/acme/api");
  });

  it("leaves a bare path alone", () => {
    expect(shortenRemote("acme/api")).toBe("acme/api");
  });
});

describe("repositoryNameFromRemote", () => {
  it("offers the last path segment", () => {
    expect(repositoryNameFromRemote("https://github.com/acme/api.git")).toBe("api");
    expect(repositoryNameFromRemote("git@github.com:acme/api.git")).toBe("api");
  });

  it("offers nothing rather than a guess for an empty field", () => {
    expect(repositoryNameFromRemote("")).toBe("");
  });
});

describe("availableRepositories", () => {
  it("hides what the workspace already contains", () => {
    const available = availableRepositories(
      workspace({ repos: [placement({ repositoryId: "r1" })] }),
      [repository({ id: "r1", name: "api" }), repository({ id: "r2", name: "web" })],
    );

    expect(available.map((repo) => repo.id)).toEqual(["r2"]);
  });
});

describe("filterRepositories", () => {
  const catalog = [
    repository({ id: "r1", name: "api", remoteUrl: "https://github.com/acme/api" }),
    repository({ id: "r2", name: "web", remoteUrl: "https://gitlab.com/acme/web" }),
  ];

  it("matches the remote as well as the name, so a pasted URL finds it", () => {
    expect(filterRepositories(catalog, "gitlab").map((repo) => repo.id)).toEqual(["r2"]);
  });

  it("returns everything for an empty query", () => {
    expect(filterRepositories(catalog, "  ")).toHaveLength(2);
  });
});

describe("setup commands", () => {
  it("drops blank lines so a trailing newline is not sent as a command", () => {
    expect(parseSetupCommands("pnpm install\n\n  pnpm build  \n")).toEqual([
      "pnpm install",
      "pnpm build",
    ]);
  });

  it("round-trips what the API returned", () => {
    expect(parseSetupCommands(formatSetupCommands(["a", "b"]))).toEqual(["a", "b"]);
  });

  it("shows an empty field for a workspace with no setup", () => {
    expect(formatSetupCommands(null)).toBe("");
  });
});
