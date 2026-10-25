/**
 * Pure gesture arithmetic for the fork's draggable mobile sidebar.
 * Offsets are px as the panel is translated: `0` fully open, `-panelWidth` (left side) or
 * `+panelWidth` (right side) fully closed, so one signed number serves both sides.
 */

/** Distance (px) from the screen edge where an opening swipe must start. */
export const SIDEBAR_DRAG_EDGE_SIZE = 24;

/** Minimum travel (px) before a gesture locks into horizontal vs vertical. */
export const SIDEBAR_DRAG_DIRECTION_LOCK = 8;

/** Panel width (px) assumed before the element can be measured (20rem). */
export const SIDEBAR_DRAG_FALLBACK_WIDTH = 320;

export type SidebarDragSide = "left" | "right";

/**
 * Which way a touch is travelling. Undecided until it clears the lock
 * threshold: acting sooner makes a straight-down scroll drag the panel a few
 * px sideways before it gives up.
 */
export type SidebarDragAxis = "undecided" | "horizontal" | "vertical";

export function resolveDragAxis(
  deltaX: number,
  deltaY: number,
  lock: number = SIDEBAR_DRAG_DIRECTION_LOCK,
): SidebarDragAxis {
  if (Math.abs(deltaX) < lock && Math.abs(deltaY) < lock) {
    return "undecided";
  }
  return Math.abs(deltaX) > Math.abs(deltaY) ? "horizontal" : "vertical";
}

/** The closed resting offset for a side: off-screen by one panel width. */
export function closedOffset(panelWidth: number, side: SidebarDragSide): number {
  return side === "left" ? -panelWidth : panelWidth;
}

/**
 * Whether a starting touch is ours, and the offset the drag starts from.
 * Open: any touch may drag, from rest. Closed: only a touch within `edgeSize` of the panel's
 * edge counts, so the swipe reveals the sidebar instead of starting browser back-navigation.
 */
export function resolveDragClaim(input: {
  readonly isOpen: boolean;
  readonly clientX: number;
  readonly panelWidth: number;
  readonly viewportWidth: number;
  readonly side: SidebarDragSide;
  readonly edgeSize?: number;
}): { readonly base: number; readonly fromEdge: boolean } | null {
  if (input.isOpen) {
    return { base: 0, fromEdge: false };
  }

  const edgeSize = input.edgeSize ?? SIDEBAR_DRAG_EDGE_SIZE;
  const withinEdge =
    input.side === "left"
      ? input.clientX <= edgeSize
      : input.clientX >= input.viewportWidth - edgeSize;

  return withinEdge ? { base: closedOffset(input.panelWidth, input.side), fromEdge: true } : null;
}

/**
 * Where the panel sits mid-drag: the starting offset plus how far the finger
 * has moved, clamped so it can never travel past open or past closed.
 */
export function clampDragOffset(input: {
  readonly base: number;
  readonly deltaX: number;
  readonly panelWidth: number;
  readonly side: SidebarDragSide;
}): number {
  const next = input.base + input.deltaX;
  return input.side === "left"
    ? Math.min(0, Math.max(-input.panelWidth, next))
    : Math.max(0, Math.min(input.panelWidth, next));
}

/**
 * Where the panel lands when the finger lifts: whichever end it is nearer.
 * A drag released past the halfway mark completes, anything short of it
 * springs back, so a hesitant swipe never leaves the panel stranded.
 */
export function resolveSnapOpen(input: {
  readonly offset: number;
  readonly panelWidth: number;
}): boolean {
  if (input.panelWidth <= 0) {
    return false;
  }
  return Math.abs(input.offset) < input.panelWidth / 2;
}

/**
 * Backdrop opacity, 0 (closed) → 1 (open). Follows the panel while a drag is
 * live so the scrim darkens under the finger; otherwise it is pinned to the
 * committed state and the CSS transition carries it.
 */
export function resolveBackdropProgress(input: {
  readonly offset: number | null;
  readonly panelWidth: number;
  readonly isOpen: boolean;
}): number {
  if (input.offset === null || input.panelWidth <= 0) {
    return input.isOpen ? 1 : 0;
  }
  const travelled = 1 - Math.abs(input.offset) / input.panelWidth;
  return Math.max(0, Math.min(1, travelled));
}
