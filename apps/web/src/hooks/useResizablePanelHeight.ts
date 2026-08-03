import * as Schema from "effect/Schema";
import {
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { getLocalStorageItem, setLocalStorageItem } from "~/hooks/useLocalStorage";

const HeightSchema = Schema.Finite;

const PREVIEW_PANEL_HEIGHT_STORAGE_KEY = "t3code:preview-panel-height";
const PREVIEW_PANEL_MIN_HEIGHT = 200;
const PREVIEW_PANEL_MAX_HEIGHT_FRACTION = 0.7;
const PREVIEW_PANEL_DEFAULT_HEIGHT = 380;

/** Upper bound for the panel's height, leaving the chat the rest of the viewport. */
export function getPreviewPanelMaxHeight(viewportHeight: number): number {
  return Math.floor(viewportHeight * PREVIEW_PANEL_MAX_HEIGHT_FRACTION);
}

/**
 * Height the panel takes when the pointer travels from `start` to `position`.
 * The panel is anchored to the bottom, so it grows as the pointer moves up
 * against it. Unclamped; the hook applies the bounds.
 */
export function resizedHeightForPointer(options: {
  readonly start: number;
  readonly startHeight: number;
  readonly position: number;
}): number {
  return options.startHeight + (options.start - options.position);
}

export interface ResizablePanelHeightHandlers {
  readonly onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  readonly onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void;
  readonly onPointerUp: (event: ReactPointerEvent<HTMLElement>) => void;
  readonly onPointerCancel: (event: ReactPointerEvent<HTMLElement>) => void;
}

/**
 * Height state for the right panel split off the bottom of the screen, dragged
 * by a handle on its top edge.
 *
 * Same rules as `useResizableWidth` beside it — read from localStorage on
 * mount, commit on drag-end rather than on every rAF tick, clamp against the
 * live viewport — under its own storage key, so flipping orientation restores
 * the size that orientation last had instead of reusing a width as a height.
 *
 * Fork addition, kept beside the width hook rather than folded into it: that
 * one is upstream's and keeps merging cleanly while this one sits next door.
 */
export function useResizablePanelHeight(): {
  readonly height: number;
  readonly handlers: ResizablePanelHeightHandlers;
} {
  const maxHeight = useViewportClampedMaxHeight();

  const clamp = useCallback(
    (value: number): number => {
      if (!Number.isFinite(value)) return PREVIEW_PANEL_DEFAULT_HEIGHT;
      return Math.max(PREVIEW_PANEL_MIN_HEIGHT, Math.min(maxHeight, value));
    },
    [maxHeight],
  );

  // No cross-tab subscription: panel height is per-window state.
  const [height, setHeight] = useState<number>(() => {
    if (typeof window === "undefined") return PREVIEW_PANEL_DEFAULT_HEIGHT;
    try {
      const stored = getLocalStorageItem(PREVIEW_PANEL_HEIGHT_STORAGE_KEY, HeightSchema);
      return clamp(stored ?? PREVIEW_PANEL_DEFAULT_HEIGHT);
    } catch (error) {
      console.error("Could not read persisted panel height.", error);
      return PREVIEW_PANEL_DEFAULT_HEIGHT;
    }
  });

  const clampedHeight = clamp(height);

  const dragStateRef = useRef<{
    pointerId: number;
    startY: number;
    startHeight: number;
    pending: number;
    rafId: number | null;
    target: HTMLElement;
  } | null>(null);

  const releasePointer = useCallback((pointerId: number) => {
    const state = dragStateRef.current;
    if (!state) return;
    if (state.rafId !== null) {
      cancelAnimationFrame(state.rafId);
    }
    try {
      if (state.target.hasPointerCapture(pointerId)) {
        state.target.releasePointerCapture(pointerId);
      }
    } catch {
      // pointer may already be released; harmless.
    }
    document.body.style.removeProperty("cursor");
    document.body.style.removeProperty("user-select");
    dragStateRef.current = null;
  }, []);

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      const target = event.currentTarget;
      try {
        target.setPointerCapture(event.pointerId);
      } catch {
        return;
      }
      document.body.style.cursor = "row-resize";
      document.body.style.userSelect = "none";
      dragStateRef.current = {
        pointerId: event.pointerId,
        startY: event.clientY,
        startHeight: clampedHeight,
        pending: clampedHeight,
        rafId: null,
        target,
      };
    },
    [clampedHeight],
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const state = dragStateRef.current;
      if (!state || state.pointerId !== event.pointerId) return;
      event.preventDefault();
      state.pending = clamp(
        resizedHeightForPointer({
          start: state.startY,
          startHeight: state.startHeight,
          position: event.clientY,
        }),
      );
      if (state.rafId !== null) return;
      state.rafId = requestAnimationFrame(() => {
        const active = dragStateRef.current;
        if (!active) return;
        active.rafId = null;
        setHeight(active.pending);
      });
    },
    [clamp],
  );

  const onPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const state = dragStateRef.current;
      if (!state || state.pointerId !== event.pointerId) return;
      const finalHeight = clamp(state.pending);
      releasePointer(event.pointerId);
      // Commit once at drag-end to avoid 60Hz localStorage writes.
      try {
        setLocalStorageItem(PREVIEW_PANEL_HEIGHT_STORAGE_KEY, finalHeight, HeightSchema);
      } catch (error) {
        console.error("Could not persist panel height.", error);
      }
      setHeight(finalHeight);
    },
    [clamp, releasePointer],
  );

  const onPointerCancel = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const state = dragStateRef.current;
      if (!state || state.pointerId !== event.pointerId) return;
      // Don't persist a cancelled drag; revert to the start height.
      releasePointer(event.pointerId);
      setHeight(state.startHeight);
    },
    [releasePointer],
  );

  return {
    height: clampedHeight,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel },
  };
}

/**
 * Track viewport height so the panel's upper bound follows it. Resize-aware so
 * dragging the OS window shorter re-clamps the stored height on the next
 * render (the hook's clamp picks this up automatically).
 */
function useViewportClampedMaxHeight(): number {
  const [vh, setVh] = useState(() => (typeof window === "undefined" ? 800 : window.innerHeight));
  useEffect(() => {
    if (typeof window === "undefined") return;
    let frame = 0;
    const onResize = () => {
      // Coalesce resize bursts into one state update per frame.
      if (frame !== 0) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        setVh(window.innerHeight);
      });
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      if (frame !== 0) window.cancelAnimationFrame(frame);
    };
  }, []);
  return getPreviewPanelMaxHeight(vh);
}
