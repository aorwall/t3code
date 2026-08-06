import { describe, expect, it } from "vite-plus/test";

import type { RepositoryResponse, WorkspaceResponse } from "@t3tools/moatless-api/generated/model";

import { compareWorkspaces, summarizeWorkspace } from "./workspaceSummary";

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

function placement(repositoryId: string, position: number) {
  return {
    id: `pl_${repositoryId}`,
    isPrimary: position === 0,
    position,
    repositoryId,
    workspaceId: "ws_1",
  };
}

function repository(overrides: Partial<RepositoryResponse> & { id: string }): RepositoryResponse {
  return {
    kind: "git",
    name: overrides.id,
    scope: "global",
    ...overrides,
  };
}

const CATALOG: RepositoryResponse[] = [
  repository({ id: "r1", name: "api", provider: "github" }),
  repository({ id: "r2", name: "web", provider: "gitlab" }),
];

describe("summarizeWorkspace", () => {
  it("says a workspace has no repositories rather than counting to zero", () => {
    const summary = summarizeWorkspace(workspace(), CATALOG);
    expect(summary.repositories).toEqual([]);
    expect(summary.emptyDetail).toBe("No repositories");
  });

  it("names every repository instead of counting them", () => {
    const summary = summarizeWorkspace(
      workspace({ repos: [placement("r1", 0), placement("r2", 1)] }),
      CATALOG,
    );

    expect(summary.repositories.map((row) => row.name)).toEqual(["api", "web"]);
    expect(summary.emptyDetail).toBeNull();
  });

  it("carries each repository's host so the row can mark it", () => {
    const summary = summarizeWorkspace(
      workspace({ repos: [placement("r1", 0), placement("r2", 1)] }),
      CATALOG,
    );

    expect(summary.repositories.map((row) => row.icon)).toEqual(["github", "gitlab"]);
  });

  it("puts the primary repository first however it was positioned", () => {
    const summary = summarizeWorkspace(
      workspace({
        repos: [
          { ...placement("r2", 0), isPrimary: false },
          { ...placement("r1", 1), isPrimary: true },
        ],
      }),
      CATALOG,
    );

    expect(summary.repositories.map((row) => row.name)).toEqual(["api", "web"]);
  });

  it("keeps a placement the catalog cannot resolve, named by its id", () => {
    // A repository can be deleted while a workspace still places it, and the
    // row is where someone would go to notice that.
    const summary = summarizeWorkspace(workspace({ repos: [placement("r_gone", 0)] }), CATALOG);

    expect(summary.repositories).toEqual([
      { repositoryId: "r_gone", name: "r_gone", icon: "git", isPrimary: true },
    ]);
  });

  it("names repositories by id when the catalog has not loaded at all", () => {
    const summary = summarizeWorkspace(workspace({ repos: [placement("r1", 0)] }), []);
    expect(summary.repositories.map((row) => row.name)).toEqual(["r1"]);
  });

  it("says nothing about the image the workspace runs", () => {
    const summary = summarizeWorkspace(
      workspace({ repos: [placement("r1", 0)], dockerImage: "node:22" }),
      CATALOG,
    );

    expect(JSON.stringify(summary)).not.toContain("node:22");
  });

  it("treats either git signal as git-sourced", () => {
    expect(summarizeWorkspace(workspace({ source: "git" }), CATALOG).isGitSourced).toBe(true);
    expect(summarizeWorkspace(workspace({ syncedFromGit: true }), CATALOG).isGitSourced).toBe(true);
    expect(summarizeWorkspace(workspace({ source: "manual" }), CATALOG).isGitSourced).toBe(false);
  });
});

describe("compareWorkspaces", () => {
  it("sinks deleted workspaces below live ones whatever they are called", () => {
    const rows = [
      summarizeWorkspace(workspace({ id: "a", name: "aaa", deleted: true }), CATALOG),
      summarizeWorkspace(workspace({ id: "b", name: "zzz" }), CATALOG),
      summarizeWorkspace(workspace({ id: "c", name: "mmm" }), CATALOG),
    ].sort(compareWorkspaces);

    expect(rows.map((row) => row.name)).toEqual(["mmm", "zzz", "aaa"]);
  });
});
