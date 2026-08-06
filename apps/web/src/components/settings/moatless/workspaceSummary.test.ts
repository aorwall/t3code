import { describe, expect, it } from "vite-plus/test";

import type { WorkspaceResponse } from "@t3tools/moatless-api/generated/model";

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

describe("summarizeWorkspace", () => {
  it("says a workspace has no repositories rather than counting to zero", () => {
    expect(summarizeWorkspace(workspace()).detail).toBe("No repositories");
  });

  it("counts repositories in the singular", () => {
    const summary = summarizeWorkspace(workspace({ repos: [placement("r1", 0)] }));
    expect(summary.detail).toBe("1 repository");
  });

  it("joins the count, the image and the server count", () => {
    const summary = summarizeWorkspace(
      workspace({
        repos: [placement("r1", 0), placement("r2", 1)],
        dockerImage: "node:22",
        servers: [
          { name: "web", port: 3000 },
          { name: "api", port: 4000 },
        ],
      }),
    );

    expect(summary.detail).toBe("2 repositories · node:22 · 2 servers");
  });

  it("omits every part the API left null instead of rendering it", () => {
    const summary = summarizeWorkspace(
      workspace({ dockerImage: null, servers: null, repos: [placement("r1", 0)] }),
    );

    expect(summary.detail).toBe("1 repository");
  });

  it("treats either git signal as git-sourced", () => {
    expect(summarizeWorkspace(workspace({ source: "git" })).isGitSourced).toBe(true);
    expect(summarizeWorkspace(workspace({ syncedFromGit: true })).isGitSourced).toBe(true);
    expect(summarizeWorkspace(workspace({ source: "manual" })).isGitSourced).toBe(false);
  });
});

describe("compareWorkspaces", () => {
  it("sinks deleted workspaces below live ones whatever they are called", () => {
    const rows = [
      summarizeWorkspace(workspace({ id: "a", name: "aaa", deleted: true })),
      summarizeWorkspace(workspace({ id: "b", name: "zzz" })),
      summarizeWorkspace(workspace({ id: "c", name: "mmm" })),
    ].sort(compareWorkspaces);

    expect(rows.map((row) => row.name)).toEqual(["mmm", "zzz", "aaa"]);
  });
});
