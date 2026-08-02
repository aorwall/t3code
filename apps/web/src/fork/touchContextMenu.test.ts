import { describe, expect, it } from "vite-plus/test";

import {
  CONTEXT_MENU_SUPPRESSION_MS,
  exceedsLongPressTolerance,
  LONG_PRESS_DURATION_MS,
  LONG_PRESS_MOVE_TOLERANCE,
  startsLongPress,
} from "./touchContextMenu";

describe("startsLongPress", () => {
  it("arms for touch and pen, never for a mouse", () => {
    expect(startsLongPress("touch")).toBe(true);
    expect(startsLongPress("pen")).toBe(true);
    expect(startsLongPress("mouse")).toBe(false);
  });
});

describe("exceedsLongPressTolerance", () => {
  it("keeps a still finger inside the tolerance", () => {
    expect(exceedsLongPressTolerance(0, 0)).toBe(false);
    expect(exceedsLongPressTolerance(LONG_PRESS_MOVE_TOLERANCE, LONG_PRESS_MOVE_TOLERANCE)).toBe(
      false,
    );
  });

  it("releases the press once it travels on either axis, in either direction", () => {
    expect(exceedsLongPressTolerance(LONG_PRESS_MOVE_TOLERANCE + 1, 0)).toBe(true);
    expect(exceedsLongPressTolerance(-(LONG_PRESS_MOVE_TOLERANCE + 1), 0)).toBe(true);
    expect(exceedsLongPressTolerance(0, LONG_PRESS_MOVE_TOLERANCE + 1)).toBe(true);
    expect(exceedsLongPressTolerance(0, -(LONG_PRESS_MOVE_TOLERANCE + 1))).toBe(true);
  });
});

describe("suppression window", () => {
  it("outlasts the platform's own long-press delay", () => {
    // Chrome on Android raises `contextmenu` around 500 ms, which is after our
    // menu is already open. The window has to still be closing that event by
    // then or the sidebar shows two menus and keeps neither.
    expect(CONTEXT_MENU_SUPPRESSION_MS).toBeGreaterThan(LONG_PRESS_DURATION_MS + 100);
  });
});
