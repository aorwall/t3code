import { describe, expect, it } from "vite-plus/test";

import { buildThreadActionMenuItems, type ThreadActionMenuState } from "./threadActionMenu.logic";

const baseState: ThreadActionMenuState = {
  branch: null,
  isPinned: false,
  isSettled: false,
  isSnoozed: false,
  canSnoozeNow: true,
  isRegeneratingTitle: false,
  isRunning: false,
  supports: { settlement: true, snooze: true, pinning: true, titleRegeneration: true },
  snoozePresets: [
    { id: "hour", label: "In 1 hour", whenLabel: "3:00 PM", snoozedUntil: "2026-08-07T15:00:00Z" },
  ],
};

function ids(state: ThreadActionMenuState): string[] {
  return buildThreadActionMenuItems(state).map((item) => item.id);
}

function allIds(state: ThreadActionMenuState): string[] {
  const flatten = (items: ReturnType<typeof buildThreadActionMenuItems>): string[] =>
    items.flatMap((item) => [item.id, ...(item.children ? flatten(item.children) : [])]);
  return flatten(buildThreadActionMenuItems(state));
}

describe("buildThreadActionMenuItems", () => {
  it("hides lifecycle items when the environment lacks the capabilities", () => {
    // Fork: `delete` is gated behind FEATURES.threadDeletion (off) and `archive`
    // is always offered, so the tail is archive rather than upstream's delete.
    // `project-settings` stays — it is not fork-gated.
    expect(
      ids({
        ...baseState,
        supports: { settlement: false, snooze: false, pinning: false, titleRegeneration: false },
      }),
    ).toEqual(["rename", "mark-unread", "copy", "project-settings", "archive"]);
  });

  it("groups project settings with utility actions before archive", () => {
    const items = buildThreadActionMenuItems(baseState);
    const copyIndex = items.findIndex((item) => item.id === "copy");
    expect(items[copyIndex + 1]).toMatchObject({
      id: "project-settings",
      label: "Project settings",
      icon: "settings",
    });
    expect(items[copyIndex + 2]?.id).toBe("archive");
  });

  it("includes branch items only for threads with a branch", () => {
    const withBranch = allIds({ ...baseState, branch: "feat/menu" });
    expect(withBranch).toContain("new-thread-on-branch");
    expect(withBranch).toContain("copy-branch");
    expect(allIds(baseState)).not.toContain("new-thread-on-branch");
    expect(allIds(baseState)).not.toContain("copy-branch");
  });

  it("flips lifecycle labels with thread state", () => {
    expect(ids({ ...baseState, isPinned: true, isSettled: true, isSnoozed: true })).toEqual(
      expect.arrayContaining(["unpin", "unsettle", "unsnooze"]),
    );
    expect(ids(baseState)).toEqual(expect.arrayContaining(["pin", "settle", "snooze"]));
  });

  it("disables snooze when the thread cannot snooze, keeping presets visible", () => {
    const snooze = buildThreadActionMenuItems({ ...baseState, canSnoozeNow: false }).find(
      (item) => item.id === "snooze",
    );
    expect(snooze?.disabled).toBe(true);
    expect(snooze?.children?.map((child) => child.id)).toEqual(["snooze:hour"]);
  });

  it("disables title regeneration while one is in flight", () => {
    const item = buildThreadActionMenuItems({ ...baseState, isRegeneratingTitle: true }).find(
      (candidate) => candidate.id === "regenerate-title",
    );
    expect(item).toMatchObject({ label: "Regenerating…", disabled: true });
  });

  // Fork: deletion is gated off (FEATURES.threadDeletion), so upstream's
  // destructive delete item is absent and archive is the last item instead.
  it("keeps archive last, non-destructive, and omits the gated delete item", () => {
    const items = buildThreadActionMenuItems({ ...baseState, branch: "main" });
    const archiveItem = items.at(-1);
    expect(archiveItem?.id).toBe("archive");
    expect(archiveItem?.icon).toBe("archive");
    expect(archiveItem?.separatorBefore).toBe(true);
    expect(archiveItem?.destructive).toBeFalsy();
    expect(items.map((item) => item.id)).not.toContain("delete");
  });

  it("keeps archive available even when the environment lacks every other capability", () => {
    expect(
      ids({
        ...baseState,
        supports: { settlement: false, snooze: false, pinning: false, titleRegeneration: false },
      }),
    ).toContain("archive");
  });

  it("disables archive while the thread is running", () => {
    const archiveItem = buildThreadActionMenuItems({ ...baseState, isRunning: true }).find(
      (item) => item.id === "archive",
    );
    expect(archiveItem?.disabled).toBe(true);
  });
});
