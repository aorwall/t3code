import { describe, expect, it } from "vite-plus/test";

import type { Loop, LoopConfig, LoopSource } from "@t3tools/moatless-api/generated/model";

import {
  compareLoops,
  filterLoops,
  isScheduleSource,
  isSubscriptionSource,
  loopKindLabel,
  loopProvenance,
  loopSourceSummary,
  loopStateLabel,
} from "./loopRows";

const CONFIG: LoopConfig = {
  agentType: "claude-code",
  repositoryId: "repo_1",
  routingMode: "by_subject",
  tagIds: [],
};

function loop(overrides: Partial<Loop> = {}): Loop {
  return {
    active: false,
    config: CONFIG,
    configSource: "manual",
    createdAt: "2026-01-01T00:00:00Z",
    createdBy: "user_1",
    deleted: false,
    executionState: "paused",
    id: "loop_1",
    kind: "schedule",
    name: "Nightly sweep",
    scope: "global",
    source: { cronExpression: "0 0 * * *" } as unknown as LoopSource,
    syncedFromGit: false,
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

const subscriptionSource = {
  adapterKind: "slack",
  allowDirectSend: false,
  closeTaskOnClose: true,
  connectionId: "conn_1",
  eventFilter: {},
  notifyOnSuccess: false,
  sourceMatcher: "C0123",
  sourceName: "#eng",
} as unknown as LoopSource;

describe("source guards", () => {
  it("recognises a subscription by its adapter kind", () => {
    expect(isSubscriptionSource(subscriptionSource)).toBe(true);
    expect(isScheduleSource(subscriptionSource)).toBe(false);
  });

  it("recognises a schedule by its cron expression", () => {
    const source = { cronExpression: "0 0 * * *" } as unknown as LoopSource;
    expect(isScheduleSource(source)).toBe(true);
    expect(isSubscriptionSource(source)).toBe(false);
  });

  it("treats an empty manual source as neither", () => {
    const source = {} as LoopSource;
    expect(isSubscriptionSource(source)).toBe(false);
    expect(isScheduleSource(source)).toBe(false);
  });
});

describe("loopSourceSummary", () => {
  it("names the adapter and the source name for a subscription", () => {
    expect(loopSourceSummary(loop({ source: subscriptionSource }))).toBe("Slack · #eng");
  });

  it("falls back to the matcher when a subscription has no name", () => {
    const source = { ...(subscriptionSource as object), sourceName: null } as unknown as LoopSource;
    expect(loopSourceSummary(loop({ source }))).toBe("Slack · C0123");
  });

  it("shows the cron expression for a schedule", () => {
    expect(loopSourceSummary(loop())).toBe("Schedule · 0 0 * * *");
  });

  it("reads a manual source as Manual", () => {
    expect(loopSourceSummary(loop({ source: {} as LoopSource }))).toBe("Manual");
  });
});

describe("labels", () => {
  it("labels the subscription kind as Subscription", () => {
    expect(loopKindLabel("adapter_event")).toBe("Subscription");
  });

  it("labels the awaiting-approval state in words", () => {
    expect(loopStateLabel("awaiting_approval")).toBe("Awaiting approval");
  });
});

describe("loopProvenance", () => {
  it("locks a Loop that is synced from git", () => {
    const provenance = loopProvenance(loop({ syncedFromGit: true, configSource: "git" }));
    expect(provenance.isLocked).toBe(true);
    expect(provenance.isOverridden).toBe(false);
  });

  it("marks a git-origin Loop no longer tracking git as overridden", () => {
    const provenance = loopProvenance(
      loop({ syncedFromGit: false, configSource: "manual", sourceConfigPath: ".moatless/loops/x" }),
    );
    expect(provenance.isLocked).toBe(false);
    expect(provenance.isOverridden).toBe(true);
    expect(provenance.configPath).toBe(".moatless/loops/x");
  });

  it("treats a purely manual Loop as neither", () => {
    const provenance = loopProvenance(loop());
    expect(provenance.isLocked).toBe(false);
    expect(provenance.isOverridden).toBe(false);
  });
});

describe("compareLoops", () => {
  it("orders live before deleted, then by name", () => {
    const rows = [
      loop({ id: "a", name: "Zephyr", deleted: false }),
      loop({ id: "b", name: "Apex", deleted: true }),
      loop({ id: "c", name: "Beacon", deleted: false }),
    ];
    const names = [...rows].sort(compareLoops).map((row) => row.name);
    expect(names).toEqual(["Beacon", "Zephyr", "Apex"]);
  });
});

describe("filterLoops", () => {
  const rows = [
    loop({ id: "a", name: "Nightly sweep" }),
    loop({ id: "b", name: "Triage", source: subscriptionSource }),
    loop({ id: "c", name: "Release", kind: "manual", source: {} as unknown as LoopSource }),
  ];

  it("returns every Loop for a blank query", () => {
    expect(filterLoops(rows, "  ")).toHaveLength(3);
  });

  it("matches a name", () => {
    expect(filterLoops(rows, "night").map((row) => row.id)).toEqual(["a"]);
  });

  it("matches where a Loop listens, not only what it is called", () => {
    // "Triage" says nothing about Slack; the row's second line does.
    expect(filterLoops(rows, "slack").map((row) => row.id)).toEqual(["b"]);
  });

  it("matches a schedule by its cron expression", () => {
    expect(filterLoops(rows, "0 0 * * *").map((row) => row.id)).toEqual(["a"]);
  });

  it("does not match on the state badge, which is a status and not an identity", () => {
    // Every fixture Loop is paused, so a state match would return all three.
    expect(filterLoops(rows, "paused")).toEqual([]);
  });
});
