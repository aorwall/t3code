import { ThreadId, type ThreadPullRequestLink } from "@t3tools/contracts";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";

import {
  ThreadPullRequestBadgeControl,
  ThreadPullRequestsMiniList,
  ThreadWorktreeIndicator,
  linkedPullRequestSnapshotStatus,
} from "./ThreadStatusIndicators";

describe("ThreadWorktreeIndicator", () => {
  it("renders the worktree folder and branch in an accessible label", () => {
    const markup = renderToStaticMarkup(
      <ThreadWorktreeIndicator
        thread={{
          id: ThreadId.make("thread-1"),
          branch: "feature/sidebar-indicator",
          worktreePath: "/tmp/worktrees/sidebar-indicator",
        }}
      />,
    );

    expect(markup).toContain('role="img"');
    expect(markup).toContain(
      'aria-label="Worktree: sidebar-indicator (feature/sidebar-indicator)"',
    );
    expect(markup).toContain('data-testid="thread-worktree-thread-1"');
  });

  it.each([null, "", "   "])("renders nothing for an absent worktree path", (worktreePath) => {
    const markup = renderToStaticMarkup(
      <ThreadWorktreeIndicator
        thread={{
          id: ThreadId.make("thread-1"),
          branch: "main",
          worktreePath,
        }}
      />,
    );

    expect(markup).toBe("");
  });
});

// Fork: the badge lists a Task's pull requests, which rarely stack.
describe("a badge for several pull requests", () => {
  const link = (number: number): ThreadPullRequestLink => ({
    host: "github.com",
    repository: "acme/web",
    number,
    url: `https://github.com/acme/web/pull/${number}`,
    source: "manual",
    linkedAt: "2026-01-01T00:00:00Z",
    stack: null,
    snapshot: {
      state: "open",
      title: `Change ${number}`,
      headBranch: `feature-${number}`,
      baseBranch: "main",
      isDraft: false,
      updatedAt: null,
      syncedAt: "2026-01-02T00:00:00Z",
    },
  });

  function badgeMarkup(pullRequests: ReadonlyArray<ThreadPullRequestLink>): string {
    return renderToStaticMarkup(
      <ThreadPullRequestBadgeControl
        variant="ghost"
        badge={{ kind: "pull-request", others: pullRequests.length - 1, state: "open" }}
        number={pullRequests[0]?.number}
        url={pullRequests[0]?.url}
        status={null}
        pullRequests={pullRequests}
        onOpenStack={() => {}}
        onOpenPullRequest={() => {}}
        onOpenLink={() => {}}
      />,
    );
  }

  it("opens a list rather than the primary", () => {
    const markup = badgeMarkup([link(41), link(42)]);

    expect(markup).toContain("<button");
    expect(markup).not.toContain("href=");
    // Upstream's badge counts every linked pull request rather than the extras
    // beside a named primary, so two links read `+2`, not `#41 +1`.
    expect(markup).toContain("+2");
  });

  it("stays a link to the one pull request it names", () => {
    const markup = badgeMarkup([link(41)]);

    expect(markup).toContain('href="https://github.com/acme/web/pull/41"');
  });

  it("gives each listed pull request its own link", () => {
    const markup = renderToStaticMarkup(
      <ThreadPullRequestsMiniList pullRequests={[link(41), link(42)]} onSelect={() => {}} />,
    );

    expect(markup).toContain('href="https://github.com/acme/web/pull/41"');
    expect(markup).toContain('href="https://github.com/acme/web/pull/42"');
    expect(markup).toContain("Change 42");
  });

  it("is text where the sidebar hovers it", () => {
    const markup = renderToStaticMarkup(
      <ThreadPullRequestsMiniList pullRequests={[link(41), link(42)]} />,
    );

    expect(markup).not.toContain("href=");
    expect(markup).toContain("Change 41");
  });
});

describe("linked pull request snapshots", () => {
  const link: ThreadPullRequestLink = {
    host: "gitlab.example.com",
    repository: "acme/web",
    number: 42,
    url: "https://gitlab.example.com/acme/web/-/merge_requests/42",
    source: "manual",
    linkedAt: "2026-01-01T00:00:00Z",
    stack: null,
    snapshot: null,
  };
  it("keeps unsynced links unknown", () => {
    expect(linkedPullRequestSnapshotStatus(link)).toBeNull();
  });
  it("uses the snapshot state and branches with the linked identity", () => {
    const result = linkedPullRequestSnapshotStatus({
      ...link,
      snapshot: {
        state: "merged",
        title: "Change",
        headBranch: "feature",
        baseBranch: "main",
        isDraft: false,
        updatedAt: "2026-01-02T00:00:00Z",
        syncedAt: "2026-01-03T00:00:00Z",
      },
    });
    expect(result).toEqual({
      pr: {
        number: 42,
        url: link.url,
        title: "Change",
        state: "merged",
        isDraft: false,
        headRef: "feature",
        baseRef: "main",
        updatedAt: "2026-01-02T00:00:00Z",
      },
      sourceControlProvider: { kind: "gitlab", name: "gitlab", baseUrl: "" },
    });
  });
});
