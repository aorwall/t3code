import { describe, expect, it } from "vite-plus/test";

import { buildThreadActionMenuItems, type ThreadActionMenuState } from "./threadActionMenu.logic";

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
  isFollowed: true,
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
            // Fork: the visibility and follow items.
            "make-public",
            "unfollow",
            "archive",
            "delete",
          ]
        : [
            "pin",
            "settle",
            "snooze",
            "rename",
            "regenerate-title",
            "auto-settle",
            // Fork: the visibility and follow items.
            "make-public",
            "unfollow",
            "archive",
            "delete",
          ];
      expect(items.filter((item) => item.disabled).map((item) => item.id)).toEqual(expected);
      expect(
        items.find((item) => item.id === "snooze")?.children?.every((child) => child.disabled) ??
          true,
      ).toBe(true);
    },
  );

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
      "delete",
    ]);
  });

  it("keeps delete last and destructive, after archive", () => {
    const items = buildThreadActionMenuItems({ ...baseState, branch: "main" });
    const deleteItem = items.at(-1);
    expect(deleteItem).toMatchObject({ id: "delete", destructive: true, icon: "trash" });
    const archiveItem = items.at(-2);
    expect(archiveItem?.id).toBe("archive");
    // Fork: the visibility item opens the group, so it carries the separator
    // and everything below it in the group goes without.
    expect(archiveItem?.separatorBefore).toBe(false);
    expect(items.at(-3)?.id).toBe("unfollow");
    expect(items.at(-3)?.separatorBefore).toBe(false);
    expect(items.find((item) => item.id === "make-public")?.separatorBefore).toBe(true);
    expect(archiveItem?.destructive).toBeFalsy();
  });

  it("disables archive and turning into a project while the thread is running", () => {
    const items = buildThreadActionMenuItems({
      ...baseState,
      isRunning: true,
      canTurnIntoProject: true,
    });
    expect(items.find((item) => item.id === "archive")?.disabled).toBe(true);
    expect(items.find((item) => item.id === "turn-into-project")?.disabled).toBe(true);
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

  // Fork: opening a thread does not follow it, so the menu is the only way in
  // and out, directly below the visibility item.
  it.each([
    { isFollowed: true, id: "unfollow", label: "Unfollow thread", icon: "bell-off" },
    { isFollowed: false, id: "follow", label: "Follow thread", icon: "bell" },
  ])("offers $id below the visibility item when followed is $isFollowed", (row) => {
    const state = { ...baseState, isFollowed: row.isFollowed };
    const items = buildThreadActionMenuItems(state);
    const index = items.findIndex((item) => item.id === row.id);
    expect(items[index]).toMatchObject({ label: row.label, icon: row.icon });
    expect(items[index - 1]?.id).toBe("make-public");
    expect(ids(state)).not.toContain(row.isFollowed ? "follow" : "unfollow");

    const unsupported = ids({ ...state, supports: { ...state.supports, follow: false } });
    expect(unsupported).not.toContain("follow");
    expect(unsupported).not.toContain("unfollow");
  });

  it("disables only rename where no inline title editor exists", () => {
    const items = buildThreadActionMenuItems({ ...baseState, canRename: false });
    expect(items.filter((item) => item.disabled).map((item) => item.id)).toEqual(["rename"]);
  });
});
