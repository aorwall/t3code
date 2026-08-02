import { describe, expect, it } from "vite-plus/test";

import {
  clampDragOffset,
  closedOffset,
  resolveBackdropProgress,
  resolveDragAxis,
  resolveDragClaim,
  resolveSnapOpen,
  SIDEBAR_DRAG_DIRECTION_LOCK,
} from "./mobileSidebarDrag";

describe("resolveDragAxis", () => {
  it("stays undecided until the touch clears the lock threshold", () => {
    expect(resolveDragAxis(SIDEBAR_DRAG_DIRECTION_LOCK - 1, SIDEBAR_DRAG_DIRECTION_LOCK - 1)).toBe(
      "undecided",
    );
  });

  it("locks to the dominant axis once either delta clears it", () => {
    expect(resolveDragAxis(40, 5)).toBe("horizontal");
    expect(resolveDragAxis(-40, 5)).toBe("horizontal");
    expect(resolveDragAxis(5, 40)).toBe("vertical");
  });

  it("gives a diagonal tie to the scroll, so the list keeps moving", () => {
    expect(resolveDragAxis(20, 20)).toBe("vertical");
  });
});

describe("resolveDragClaim", () => {
  it("takes any touch while open, so the drawer can be dragged shut", () => {
    expect(
      resolveDragClaim({
        clientX: 300,
        isOpen: true,
        panelWidth: 340,
        side: "left",
        viewportWidth: 390,
      }),
    ).toEqual({ base: 0, fromEdge: false });
  });

  it("takes a closed-state touch only at its own edge", () => {
    const closed = { isOpen: false, panelWidth: 340, viewportWidth: 390 } as const;

    expect(resolveDragClaim({ ...closed, clientX: 8, side: "left" })).toEqual({
      base: -340,
      fromEdge: true,
    });
    expect(resolveDragClaim({ ...closed, clientX: 200, side: "left" })).toBeNull();
    expect(resolveDragClaim({ ...closed, clientX: 384, side: "right" })).toEqual({
      base: 340,
      fromEdge: true,
    });
    expect(resolveDragClaim({ ...closed, clientX: 200, side: "right" })).toBeNull();
  });
});

describe("clampDragOffset", () => {
  it("never travels past open or past closed", () => {
    expect(clampDragOffset({ base: -340, deltaX: 900, panelWidth: 340, side: "left" })).toBe(0);
    expect(clampDragOffset({ base: 0, deltaX: -900, panelWidth: 340, side: "left" })).toBe(-340);
    expect(clampDragOffset({ base: 340, deltaX: -900, panelWidth: 340, side: "right" })).toBe(0);
    expect(clampDragOffset({ base: 0, deltaX: 900, panelWidth: 340, side: "right" })).toBe(340);
  });

  it("follows the finger in between", () => {
    expect(clampDragOffset({ base: -340, deltaX: 100, panelWidth: 340, side: "left" })).toBe(-240);
  });
});

describe("resolveSnapOpen", () => {
  it("completes a drag released past halfway and springs back short of it", () => {
    expect(resolveSnapOpen({ offset: -100, panelWidth: 340 })).toBe(true);
    expect(resolveSnapOpen({ offset: -300, panelWidth: 340 })).toBe(false);
    expect(resolveSnapOpen({ offset: 100, panelWidth: 340 })).toBe(true);
    expect(resolveSnapOpen({ offset: 300, panelWidth: 340 })).toBe(false);
  });

  it("reads an unmeasured panel as closed rather than dividing by zero", () => {
    expect(resolveSnapOpen({ offset: 0, panelWidth: 0 })).toBe(false);
  });
});

describe("resolveBackdropProgress", () => {
  it("pins to the committed state when no drag is live", () => {
    expect(resolveBackdropProgress({ isOpen: true, offset: null, panelWidth: 340 })).toBe(1);
    expect(resolveBackdropProgress({ isOpen: false, offset: null, panelWidth: 340 })).toBe(0);
  });

  it("tracks the panel mid-drag", () => {
    expect(resolveBackdropProgress({ isOpen: false, offset: -170, panelWidth: 340 })).toBe(0.5);
    expect(resolveBackdropProgress({ isOpen: true, offset: 170, panelWidth: 340 })).toBe(0.5);
  });
});

describe("closedOffset", () => {
  it("parks the panel one width off its own edge", () => {
    expect(closedOffset(340, "left")).toBe(-340);
    expect(closedOffset(340, "right")).toBe(340);
  });
});
