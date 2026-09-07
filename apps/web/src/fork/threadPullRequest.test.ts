import type { ThreadLinkedPullRequest, VcsStatusResult } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import {
  forkAdditionalPullRequests,
  forkPullRequestKey,
  forkPullRequestMenuRows,
  forkPullRequestRepoLabel,
  forkShownPullRequestRepository,
  forkThreadPullRequests,
  resolveForkThreadPr,
} from "./threadPullRequest";

function linked(repository: string, number: number): ThreadLinkedPullRequest {
  return {
    projectId: "ws-a",
    repository,
    number,
    url: `https://github.com/${repository}/pull/${number}`,
  } as ThreadLinkedPullRequest;
}

const FIRST = linked("acme/web", 7);
const SECOND = linked("acme/web", 42);

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

describe("forkThreadPullRequests", () => {
  it("returns the server's ordered list when it carries one", () => {
    expect(
      forkThreadPullRequests({ linkedPullRequest: FIRST, linkedPullRequests: [FIRST, SECOND] }),
    ).toEqual([FIRST, SECOND]);
  });

  it("stands the single reference in as a list of one for an older server", () => {
    expect(forkThreadPullRequests({ linkedPullRequest: SECOND })).toEqual([SECOND]);
  });

  it("is empty for a thread bound to nothing", () => {
    expect(forkThreadPullRequests({ linkedPullRequest: null })).toEqual([]);
    expect(forkThreadPullRequests(null)).toEqual([]);
  });
});

describe("forkAdditionalPullRequests", () => {
  it("drops the one already on screen by number, wherever it sits in the list", () => {
    expect(forkAdditionalPullRequests([FIRST, SECOND], { number: FIRST.number })).toEqual([SECOND]);
  });

  it("keeps the whole list when nothing is on screen yet", () => {
    expect(forkAdditionalPullRequests([FIRST, SECOND], null)).toEqual([FIRST, SECOND]);
  });
});

describe("forkPullRequestMenuRows", () => {
  it("lists them only once there is more than one to disambiguate", () => {
    expect(forkPullRequestMenuRows({ linkedPullRequests: [FIRST, SECOND] })).toEqual([
      FIRST,
      SECOND,
    ]);
  });

  it("keeps upstream's single row for one or none", () => {
    expect(forkPullRequestMenuRows({ linkedPullRequests: [FIRST] })).toEqual([]);
    expect(forkPullRequestMenuRows(null)).toEqual([]);
  });
});

describe("forkPullRequestRepoLabel", () => {
  it("drops the owner", () => {
    expect(forkPullRequestRepoLabel("acme/web")).toBe("web");
  });

  it("keeps the last segment of a nested path, and a bare name as it stands", () => {
    expect(forkPullRequestRepoLabel("acme/group/web")).toBe("web");
    expect(forkPullRequestRepoLabel("web")).toBe("web");
  });
});

describe("forkShownPullRequestRepository", () => {
  it("reads the repository off the bound list by number", () => {
    expect(forkShownPullRequestRepository([FIRST, SECOND], { number: SECOND.number })).toBe(
      "acme/web",
    );
  });

  it("reports nothing for a number the list does not carry, or nothing on screen", () => {
    expect(forkShownPullRequestRepository([FIRST], { number: SECOND.number })).toBeNull();
    expect(forkShownPullRequestRepository([FIRST], null)).toBeNull();
  });
});

describe("forkPullRequestKey", () => {
  it("keys on repository and number so two repos at the same number stay distinct", () => {
    expect(forkPullRequestKey(FIRST)).toBe("acme/web#7");
    expect(forkPullRequestKey(linked("acme/api", 7))).toBe("acme/api#7");
  });
});
