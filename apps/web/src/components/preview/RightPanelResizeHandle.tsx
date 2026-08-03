import type { ResizableWidthHandlers } from "~/hooks/useResizableWidth";
import { cn } from "~/lib/utils";

interface Props {
  handlers: ResizableWidthHandlers;
  /** Fork: edge of the panel the handle sits on — its left edge, or its top edge. */
  edge?: "left" | "top";
  className?: string;
}

/**
 * Hit target for resizing an edge-anchored panel — its left edge when the
 * panel sits beside the chat, its top edge when the panel sits under it.
 *
 * - Sits on top of the panel's border with a 4px overlap on each side so the
 *   user can grab a few pixels off the edge without aiming.
 * - Visual indicator is a 1px line that lights up on hover/active to mirror
 *   VS Code / Cursor.
 */
export function RightPanelResizeHandle({ handlers, edge = "left", className }: Props) {
  const horizontal = edge === "top";
  return (
    <div
      role="separator"
      aria-orientation={horizontal ? "horizontal" : "vertical"}
      className={cn(
        "group absolute z-20 select-none",
        horizontal
          ? "inset-x-0 -top-1 h-2 cursor-row-resize"
          : "inset-y-0 -left-1 w-2 cursor-col-resize",
        className,
      )}
      {...handlers}
    >
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute bg-transparent transition-colors duration-150 group-hover:bg-border group-active:bg-primary/60",
          horizontal
            ? "inset-x-0 top-1/2 h-px -translate-y-1/2"
            : "inset-y-0 left-1/2 w-px -translate-x-1/2",
        )}
      />
    </div>
  );
}
