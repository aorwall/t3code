import * as React from "react";

/**
 * Reaching a row's context menu with a finger.
 *
 * The sidebar's per-thread actions — settle, un-settle, snooze, rename, delete
 * — live in exactly two places, and a touch device can reach neither: the
 * inline buttons appear on `:hover`, and the full menu opens on `contextmenu`.
 * A long press is the touch idiom for "the other button", so this turns one
 * into the same `contextmenu` call the mouse makes, leaving every menu item,
 * its wiring and its call sites untouched.
 *
 * `useTouchContextMenu` returns the props for a row, `onContextMenu` included,
 * so a call site swaps one attribute for one spread.
 */

/** How long a finger must rest before the press counts as a menu request. */
export const LONG_PRESS_DURATION_MS = 450;

/** Travel (px) that reclassifies a press as a scroll or a drag. */
export const LONG_PRESS_MOVE_TOLERANCE = 10;

/**
 * How long a fired long press keeps suppressing `contextmenu`.
 *
 * Chrome on Android raises its own `contextmenu` about 500 ms into a press —
 * after ours has already opened a menu. Left alone that second event both
 * opens a duplicate and, because the imperative fallback menu closes itself on
 * any `contextmenu` outside its own stack, closes the first one. Wide enough
 * to cover the gap, short enough that a deliberate right-click straight
 * afterwards still works.
 */
export const CONTEXT_MENU_SUPPRESSION_MS = 700;

/**
 * Whether a pointer should arm the press timer.
 *
 * A mouse already has a right-click, and arming for one would make a held
 * left-button — the start of a drag-select — open a menu.
 */
export function startsLongPress(pointerType: string): boolean {
  return pointerType !== "mouse";
}

export function exceedsLongPressTolerance(
  deltaX: number,
  deltaY: number,
  tolerance: number = LONG_PRESS_MOVE_TOLERANCE,
): boolean {
  return Math.abs(deltaX) > tolerance || Math.abs(deltaY) > tolerance;
}

/** The subset of a mouse event the sidebars' `onContextMenu` handlers read. */
interface ContextMenuEventShape {
  preventDefault: () => void;
  clientX: number;
  clientY: number;
}

export interface TouchContextMenuProps {
  onContextMenu: React.MouseEventHandler<HTMLElement>;
  onPointerDown: React.PointerEventHandler<HTMLElement>;
  onPointerMove: React.PointerEventHandler<HTMLElement>;
  onPointerUp: React.PointerEventHandler<HTMLElement>;
  onPointerCancel: React.PointerEventHandler<HTMLElement>;
  onClickCapture: React.MouseEventHandler<HTMLElement>;
}

/**
 * Silence the platform's own `contextmenu` for a moment.
 *
 * On `window` and in the capture phase, so it runs ahead of both React's root
 * listener and the fallback menu's document-level one — `preventDefault` alone
 * would stop the native menu and still let those two see the event.
 */
function suppressNativeContextMenu(durationMs: number): void {
  const suppress = (event: Event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
  };
  window.addEventListener("contextmenu", suppress, true);
  setTimeout(() => window.removeEventListener("contextmenu", suppress, true), durationMs);
}

/**
 * Row props that open `onContextMenu`'s menu on a long press as well as on a
 * right-click. Spread them where `onContextMenu={handler}` was.
 */
export function useTouchContextMenu(
  onContextMenu: React.MouseEventHandler<HTMLElement>,
): TouchContextMenuProps {
  const handlerRef = React.useRef(onContextMenu);
  handlerRef.current = onContextMenu;

  const press = React.useRef({
    timer: null as ReturnType<typeof setTimeout> | null,
    startX: 0,
    startY: 0,
    // Set when a long press opened the menu: that press must not also count as
    // a tap on the row, which would navigate away from the menu it just
    // opened.
    fired: false,
  });

  const cancel = React.useCallback(() => {
    if (press.current.timer !== null) {
      clearTimeout(press.current.timer);
      press.current.timer = null;
    }
  }, []);

  React.useEffect(() => cancel, [cancel]);

  const onPointerDown = React.useCallback<React.PointerEventHandler<HTMLElement>>(
    (event) => {
      press.current.fired = false;
      cancel();
      if (!startsLongPress(event.pointerType)) return;

      const target = event.currentTarget;
      // iOS decides at touch-start whether a long press raises its own
      // selection callout, so it has to be off before the timer starts. The
      // row keeps its normal selection behaviour outside the press.
      target.style.setProperty("-webkit-touch-callout", "none");

      const { clientX, clientY } = event;
      press.current.startX = clientX;
      press.current.startY = clientY;
      press.current.timer = setTimeout(() => {
        press.current.timer = null;
        press.current.fired = true;
        target.style.removeProperty("-webkit-touch-callout");
        suppressNativeContextMenu(CONTEXT_MENU_SUPPRESSION_MS);
        // The handlers this feeds read `preventDefault`, `clientX` and
        // `clientY` and nothing else, so a plain object stands in for the
        // synthetic event React would otherwise have to be tricked into
        // producing.
        const syntheticEvent: ContextMenuEventShape = {
          clientX,
          clientY,
          preventDefault: () => {},
        };
        handlerRef.current(syntheticEvent as unknown as React.MouseEvent<HTMLElement>);
      }, LONG_PRESS_DURATION_MS);
    },
    [cancel],
  );

  const onPointerMove = React.useCallback<React.PointerEventHandler<HTMLElement>>(
    (event) => {
      if (press.current.timer === null) return;
      if (
        exceedsLongPressTolerance(
          event.clientX - press.current.startX,
          event.clientY - press.current.startY,
        )
      ) {
        cancel();
      }
    },
    [cancel],
  );

  const onPointerEnd = React.useCallback<React.PointerEventHandler<HTMLElement>>(
    (event) => {
      cancel();
      event.currentTarget.style.removeProperty("-webkit-touch-callout");
    },
    [cancel],
  );

  const onClickCapture = React.useCallback<React.MouseEventHandler<HTMLElement>>((event) => {
    if (!press.current.fired) return;
    press.current.fired = false;
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const handleContextMenu = React.useCallback<React.MouseEventHandler<HTMLElement>>(
    (event) => {
      // A platform that raises `contextmenu` on its own — Chrome on Android —
      // gets to be the one that opens the menu; the pending timer would
      // otherwise open a second.
      cancel();
      handlerRef.current(event);
    },
    [cancel],
  );

  return {
    onClickCapture,
    onContextMenu: handleContextMenu,
    onPointerCancel: onPointerEnd,
    onPointerDown,
    onPointerMove,
    onPointerUp: onPointerEnd,
  };
}
