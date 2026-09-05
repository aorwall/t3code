import type { VcsStatusResult } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { resolveForkThreadPr } from "./threadPullRequest";

const PR = {
  number: 42,
  title: "Add widgets",
  url: "https://github.com/acme/web/pull/42",
  baseRef: "main",
  headRef: "feat/widgets",
  state: "open",
} as NonNullable<VcsStatusResult["pr"]>;

function status(overrides: Partial<VcsStatusResult>): VcsStatusResult {
  return {
    isRepo: true,
    hasPrimaryRemote: true,
    isDefaultRef: false,
    refName: "codex/some-work",
    hasWorkingTreeChanges: false,
    workingTree: { files: [], insertions: 0, deletions: 0 },
    hasUpstream: true,
    aheadCount: 0,
    behindCount: 0,
    pr: null,
    ...overrides,
  } as VcsStatusResult;
}

describe("resolveForkThreadPr", () => {
  it("reports the bound pull request while the checkout sits on an unrelated branch", () => {
    expect(resolveForkThreadPr(status({ refName: "codex/some-work", pr: PR }))).toEqual(PR);
  });

  it("reports the bound pull request with no branch checked out at all", () => {
    expect(resolveForkThreadPr(status({ refName: null, pr: PR }))).toEqual(PR);
  });

  it("reports nothing when the task is bound to no pull request", () => {
    expect(resolveForkThreadPr(status({ pr: null }))).toBeNull();
  });

  it("reports nothing before the status has arrived", () => {
    expect(resolveForkThreadPr(null)).toBeNull();
  });
});
