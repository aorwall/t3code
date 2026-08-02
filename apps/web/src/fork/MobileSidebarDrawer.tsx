import * as React from "react";

import { cn } from "~/lib/utils";
import {
  clampDragOffset,
  resolveBackdropProgress,
  resolveDragAxis,
  resolveDragClaim,
  resolveSnapOpen,
  SIDEBAR_DRAG_FALLBACK_WIDTH,
  type SidebarDragSide,
} from "./mobileSidebarDrag";

/** Matches the width upstream's mobile sheet uses, so the two look identical. */
const DRAWER_WIDTH = "calc(100vw - 0.75rem)";

interface MobileSidebarDrawerProps extends React.ComponentProps<"div"> {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly side?: SidebarDragSide;
}

/**
 * The mobile sidebar as a drawer the finger can drag in from the screen edge
 * and back out to dismiss, rather than a sheet that only answers a tap on the
 * trigger. The panel tracks the finger 1:1 and snaps to the nearer end on
 * release; `open` still drives it, so the trigger, the row-click handlers and
 * the keyboard shortcut all keep working unchanged.
 *
 * # Why not a `<dialog>`
 *
 * The equivalent drawer in Moatless' own UI is a native modal `<dialog>`, which
 * buys a focus trap and a backdrop for free. It cannot be that here: a modal
 * dialog makes every node outside it inert, and this sidebar's own menus —
 * Base UI popups, and the imperative context menu in `contextMenuFallback` —
 * portal to `document.body`, which is outside. They would render behind the
 * drawer and ignore taps. Settling a thread from the sidebar on a phone is
 * precisely what this exists to enable, so the drawer is a plain fixed layer
 * and gives up the free focus trap. Escape and a backdrop tap still close it.
 */
export function MobileSidebarDrawer({
  open,
  onOpenChange,
  side = "left",
  className,
  children,
  ...props
}: MobileSidebarDrawerProps) {
  const panelRef = React.useRef<HTMLDivElement>(null);

  // Non-null only while a drag is live. At rest the panel is placed by the
  // open/closed classes so the CSS transition — not React — animates it.
  const [dragOffset, setDragOffset] = React.useState<number | null>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const [panelWidth, setPanelWidth] = React.useState(SIDEBAR_DRAG_FALLBACK_WIDTH);

  React.useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      event.preventDefault();
      onOpenChange(false);
    };

    // Scroll lock: a native modal dialog would do this, and without it the page
    // behind the drawer scrolls under the finger that is dragging it.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onOpenChange, open]);

  React.useEffect(() => {
    const gesture = {
      claimed: false,
      axis: "undecided" as ReturnType<typeof resolveDragAxis>,
      startX: 0,
      startY: 0,
      base: 0,
      width: SIDEBAR_DRAG_FALLBACK_WIDTH,
      offset: 0,
    };

    const handleTouchStart = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (event.touches.length !== 1 || !touch) {
        gesture.claimed = false;
        return;
      }

      const width = panelRef.current?.offsetWidth || SIDEBAR_DRAG_FALLBACK_WIDTH;
      const claim = resolveDragClaim({
        clientX: touch.clientX,
        isOpen: open,
        panelWidth: width,
        side,
        viewportWidth: window.innerWidth,
      });
      if (!claim) {
        gesture.claimed = false;
        return;
      }

      // Claim an edge swipe up front so it drags the drawer instead of starting
      // the browser's overscroll back-navigation. (iOS Safari and Android
      // system edge-back gestures are OS-level and can't be fully suppressed
      // from JS — this is best-effort.)
      if (claim.fromEdge) {
        event.preventDefault();
      }

      setPanelWidth(width);
      gesture.claimed = true;
      gesture.axis = "undecided";
      gesture.startX = touch.clientX;
      gesture.startY = touch.clientY;
      gesture.base = claim.base;
      gesture.width = width;
      gesture.offset = claim.base;
    };

    const handleTouchMove = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!gesture.claimed || !touch) return;

      const deltaX = touch.clientX - gesture.startX;
      const deltaY = touch.clientY - gesture.startY;

      if (gesture.axis === "undecided") {
        gesture.axis = resolveDragAxis(deltaX, deltaY);
        if (gesture.axis === "undecided") return;
        if (gesture.axis === "vertical") {
          // Release the gesture so the thread list can scroll.
          gesture.claimed = false;
          return;
        }
        setIsDragging(true);
      }

      // Own the gesture: no page scroll, no browser back-swipe.
      event.preventDefault();
      gesture.offset = clampDragOffset({
        base: gesture.base,
        deltaX,
        panelWidth: gesture.width,
        side,
      });
      setDragOffset(gesture.offset);
    };

    const handleTouchEnd = () => {
      if (gesture.claimed && gesture.axis === "horizontal") {
        onOpenChange(resolveSnapOpen({ offset: gesture.offset, panelWidth: gesture.width }));
      }
      gesture.claimed = false;
      gesture.axis = "undecided";
      setIsDragging(false);
      setDragOffset(null);
    };

    document.addEventListener("touchstart", handleTouchStart, { passive: false });
    document.addEventListener("touchmove", handleTouchMove, { passive: false });
    document.addEventListener("touchend", handleTouchEnd);
    document.addEventListener("touchcancel", handleTouchEnd);
    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
      document.removeEventListener("touchcancel", handleTouchEnd);
    };
  }, [onOpenChange, open, side]);

  const progress = resolveBackdropProgress({ isOpen: open, offset: dragOffset, panelWidth });
  const isVisible = open || isDragging;

  return (
    <>
      <button
        aria-label="Close sidebar"
        className={cn(
          "fixed inset-0 z-50 bg-background/60 backdrop-blur-xs",
          isDragging ? "transition-none" : "transition-opacity duration-200",
          isVisible ? "pointer-events-auto" : "pointer-events-none",
        )}
        onClick={() => onOpenChange(false)}
        style={{ opacity: isVisible ? progress : 0 }}
        tabIndex={-1}
        type="button"
      />
      <div
        aria-label="Sidebar"
        className={cn(
          "fixed inset-y-0 z-50 flex h-dvh w-(--sidebar-width) flex-col overflow-x-hidden overscroll-x-none bg-sidebar surface-grain pt-safe pb-safe text-sidebar-foreground",
          side === "left" ? "left-0 pl-safe" : "right-0 pr-safe",
          isDragging ? "transition-none" : "transition-transform duration-200 ease-in-out",
          // At rest the resting place is a class, not a px offset: `panelWidth`
          // is only measured once a touch lands, so a px transform would put
          // the closed panel at the fallback width and leave a sliver of it on
          // screen until the first drag.
          dragOffset === null &&
            (open ? "translate-x-0" : side === "left" ? "-translate-x-full" : "translate-x-full"),
          !isVisible && "pointer-events-none",
          className,
        )}
        data-mobile="true"
        data-sidebar="sidebar"
        data-slot="sidebar"
        inert={!isVisible}
        ref={panelRef}
        role="dialog"
        style={
          {
            "--sidebar-width": DRAWER_WIDTH,
            ...(dragOffset === null ? {} : { transform: `translate3d(${dragOffset}px, 0, 0)` }),
          } as React.CSSProperties
        }
        {...props}
      >
        {children}
      </div>
    </>
  );
}
