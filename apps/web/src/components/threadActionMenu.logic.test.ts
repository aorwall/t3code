import { describe, expect, it } from "vite-plus/test";

import {
  buildDraftActionMenuItems,
  buildThreadActionMenuItems,
  type ThreadActionMenuState,
} from "./threadActionMenu.logic";

const baseState: ThreadActionMenuState = {
  canOperate: true,
  branch: null,
  projectFilter: null,
  isPinned: false,
  isSettled: false,
  autoSettleEnabled: true,
  isSnoozed: false,
  canSnoozeNow: true,
  isRegeneratingTitle: false,
  isRunning: false,
  isPublic: false,
  supports: {
    settlement: true,
    autoSettleOptOut: true,
    snooze: true,
    pinning: true,
    titleRegeneration: true,
    visibility: true,
    follow: true,
  },
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
  it.each([false, true])(
    "disables both lifecycle directions without permission (reversed: %s)",
    (reversed) => {
      const items = buildThreadActionMenuItems({
        ...baseState,
        canOperate: false,
        isPinned: reversed,
        isSettled: reversed,
        isSnoozed: reversed,
      });
      const expected = reversed
        ? [
            "unpin",
            "unsettle",
            "unsnooze",
            "rename",
            "regenerate-title",
            "auto-settle",
            // Fork: the visibility and follow items, and no Delete
            // (FEATURES.threadDeletion is off).
            "make-public",
            "unfollow",
            "archive",
          ]
        : [
            "pin",
            "settle",
            "snooze",
            "rename",
            "regenerate-title",
            "auto-settle",
            // Fork: the visibility and follow items, and no Delete
            // (FEATURES.threadDeletion is off).
            "make-public",
            "unfollow",
            "archive",
          ];
      expect(items.filter((item) => item.disabled).map((item) => item.id)).toEqual(expected);
      expect(
        items.find((item) => item.id === "snooze")?.children?.every((child) => child.disabled) ??
          true,
      ).toBe(true);
    },
  );

  it("preserves local actions and restores mutations after a grant", () => {
    const denied = buildThreadActionMenuItems({ ...baseState, canOperate: false, branch: "main" });
    expect(denied.filter((item) => !item.disabled).map((item) => item.id)).toEqual([
      "new-thread-on-branch",
      "mark-unread",
      "copy",
      "project-settings",
    ]);
    const allowed = buildThreadActionMenuItems({ ...baseState, canOperate: true });
    expect(allowed.every((item) => !item.disabled)).toBe(true);
  });

  it("hides lifecycle items when the environment lacks the capabilities", () => {
    // Fork: `delete` is gated behind FEATURES.threadDeletion (off) and `archive`
    // is always offered, so the tail is archive rather than upstream's delete.
    // `project-settings` stays — it is not fork-gated.
    expect(
      ids({
        ...baseState,
        supports: {
          settlement: false,
          autoSettleOptOut: false,
          snooze: false,
          pinning: false,
          titleRegeneration: false,
          visibility: false,
          follow: false,
        },
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
    // Fork: the visibility item opens the archive group, so it is what follows
    // project-settings when the environment supports it.
    expect(items.slice(copyIndex + 2).map((item) => item.id)).toEqual([
      "make-public",
      "unfollow",
      "archive",
    ]);
  });

  it("offers project filtering only for surfaces with a scoped thread list", () => {
    expect(ids(baseState)).not.toContain("filter-by-project");
    expect(
      buildThreadActionMenuItems({
        ...baseState,
        projectFilter: { label: "Beta Project", isActive: false },
      }).find((item) => item.id === "filter-by-project"),
    ).toMatchObject({ label: "Filter by Beta Project", icon: "folder-tree" });
  });

  it("offers the way back to all projects once the list is scoped", () => {
    const items = buildThreadActionMenuItems({
      ...baseState,
      projectFilter: { label: "Beta Project", isActive: true },
    });
    const filterIndex = items.findIndex((candidate) => candidate.id === "filter-by-project");
    expect(items[filterIndex]).toMatchObject({ label: "Show all projects", icon: "folder-tree" });
    expect(items[filterIndex - 1]?.id).toBe("mark-unread");
    expect(items[filterIndex + 1]?.id).toBe("auto-settle");
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

  it("offers auto-settle as a submenu with the current option checked", () => {
    const find = (state: ThreadActionMenuState) =>
      buildThreadActionMenuItems(state).find((item) => item.id === "auto-settle");
    const on = find(baseState);
    expect(on?.label).toBe("Auto-settle behavior");
    expect(on?.children?.map((child) => [child.id, child.checked])).toEqual([
      ["auto-settle:enabled", true],
      ["auto-settle:disabled", false],
    ]);
    const off = find({ ...baseState, autoSettleEnabled: false });
    expect(off?.children?.map((child) => child.checked)).toEqual([false, true]);
    // Sits with the per-thread settings after Mark unread, not the lifecycle verbs.
    const items = buildThreadActionMenuItems(baseState);
    expect(items[items.findIndex((item) => item.id === "mark-unread") + 1]?.id).toBe("auto-settle");
    expect(
      ids({ ...baseState, supports: { ...baseState.supports, autoSettleOptOut: false } }),
    ).not.toContain("auto-settle");
  });

  it("disables snooze when the thread cannot snooze, keeping presets visible", () => {
    const snooze = buildThreadActionMenuItems({ ...baseState, canSnoozeNow: false }).find(
      (item) => item.id === "snooze",
    );
    expect(snooze?.disabled).toBe(true);
    expect(snooze?.children?.map((child) => child.id)).toEqual(["snooze:hour", "snooze:custom"]);
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
    // Fork: the visibility item opens the group, so it carries the separator
    // and everything below it in the group goes without.
    expect(archiveItem?.separatorBefore).toBe(false);
    expect(items.at(-2)?.id).toBe("unfollow");
    expect(items.at(-2)?.separatorBefore).toBe(false);
    expect(items.find((item) => item.id === "make-public")?.separatorBefore).toBe(true);
    expect(archiveItem?.destructive).toBeFalsy();
    expect(items.map((item) => item.id)).not.toContain("delete");
  });

  it("keeps archive available even when the environment lacks every other capability", () => {
    expect(
      ids({
        ...baseState,
        supports: {
          settlement: false,
          autoSettleOptOut: false,
          snooze: false,
          pinning: false,
          titleRegeneration: false,
          visibility: false,
          follow: false,
        },
      }),
    ).toContain("archive");
  });

  it("disables archive while the thread is running", () => {
    const archiveItem = buildThreadActionMenuItems({ ...baseState, isRunning: true }).find(
      (item) => item.id === "archive",
    );
    expect(archiveItem?.disabled).toBe(true);
  });

  // Fork: the visibility item names the level the click moves to, and is the
  // only indicator of the current one — the sidebar row carries no badge.
  it("offers the visibility level the thread is not on", () => {
    expect(buildThreadActionMenuItems(baseState)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "make-public", label: "Make public", icon: "globe" }),
      ]),
    );
    expect(ids(baseState)).not.toContain("make-private");

    expect(buildThreadActionMenuItems({ ...baseState, isPublic: true })).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "make-private", label: "Make private", icon: "lock" }),
      ]),
    );
    expect(ids({ ...baseState, isPublic: true })).not.toContain("make-public");
  });

  it("omits visibility entirely when the environment does not support it", () => {
    const withoutVisibility = ids({
      ...baseState,
      isPublic: true,
      supports: { ...baseState.supports, visibility: false },
    });
    expect(withoutVisibility).not.toContain("make-public");
    expect(withoutVisibility).not.toContain("make-private");
  });

  // Fork: the item opens the archive group, so the group's separator moves to
  // it and has to fall to whatever heads the group when it is absent.
  it("opens the archive group with the visibility item", () => {
    const items = buildThreadActionMenuItems(baseState);
    const visibilityIndex = items.findIndex((item) => item.id === "make-public");
    expect(items[visibilityIndex]?.separatorBefore).toBe(true);
    expect(items[visibilityIndex + 1]?.id).toBe("unfollow");

    const withoutVisibility = buildThreadActionMenuItems({
      ...baseState,
      supports: { ...baseState.supports, visibility: false },
    });
    expect(withoutVisibility.find((item) => item.id === "unfollow")?.separatorBefore).toBe(true);
    expect(withoutVisibility.find((item) => item.id === "archive")?.separatorBefore).toBe(false);

    const withNeither = buildThreadActionMenuItems({
      ...baseState,
      supports: { ...baseState.supports, visibility: false, follow: false },
    });
    expect(withNeither.find((item) => item.id === "archive")?.separatorBefore).toBe(true);
  });

  // Fork: a listing holds what the viewer follows, and opening a thread by link
  // adds it, so the way back out sits directly below the visibility item.
  it("offers unfollow below the visibility item, gated on the capability", () => {
    const items = buildThreadActionMenuItems(baseState);
    const unfollowIndex = items.findIndex((item) => item.id === "unfollow");
    expect(items[unfollowIndex]).toMatchObject({ label: "Unfollow thread", icon: "bell-off" });
    expect(items[unfollowIndex - 1]?.id).toBe("make-public");

    expect(ids({ ...baseState, supports: { ...baseState.supports, follow: false } })).not.toContain(
      "unfollow",
    );
  });
});

describe("buildDraftActionMenuItems", () => {
  it("offers only the copy values the draft has", () => {
    const items = buildDraftActionMenuItems({ hasPath: false, hasBranch: true, hasProject: true });
    expect(items[0]).toMatchObject({ id: "copy", disabled: false });
    expect(items[0]?.children?.map((item) => item.id)).toEqual(["copy-branch"]);

    const noCopy = buildDraftActionMenuItems({
      hasPath: false,
      hasBranch: false,
      hasProject: true,
    });
    expect(noCopy[0]).toMatchObject({ id: "copy", disabled: true, children: [] });
  });

  it("drops project settings without a project and keeps discard last", () => {
    const items = buildDraftActionMenuItems({ hasPath: true, hasBranch: false, hasProject: false });
    expect(items.map((item) => item.id)).toEqual(["copy", "discard"]);
    expect(items.at(-1)).toMatchObject({ label: "Discard draft", destructive: true });
  });
});
