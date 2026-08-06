import { describe, expect, it } from "vite-plus/test";

import { matchesInvalidationPrefix } from "./query";

describe("matchesInvalidationPrefix", () => {
  it("refreshes the key itself", () => {
    expect(matchesInvalidationPrefix("workspaces", "workspaces")).toBe(true);
  });

  it("refreshes every detail under a list", () => {
    // Adding a repository to a workspace changes the workspace and the row that
    // summarises it. A caller that had to name both would miss one.
    expect(matchesInvalidationPrefix("workspaces/ws_1", "workspaces")).toBe(true);
  });

  it("does not refresh an unrelated key that starts with the same characters", () => {
    expect(matchesInvalidationPrefix("workspaces-archive", "workspaces")).toBe(false);
  });

  it("does not refresh a sibling namespace", () => {
    expect(matchesInvalidationPrefix("repositories", "workspaces")).toBe(false);
  });

  it("does not refresh a parent from a child", () => {
    expect(matchesInvalidationPrefix("workspaces", "workspaces/ws_1")).toBe(false);
  });
});
