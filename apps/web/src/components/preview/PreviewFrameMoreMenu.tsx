"use client";

import { MoreVertical } from "lucide-react";

import { Button } from "~/components/ui/button";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "~/components/ui/menu";
import { Tooltip, TooltipPopup, TooltipTrigger } from "~/components/ui/tooltip";

/**
 * Fork-only. The three-dot menu for a preview shown in a hosted iframe.
 *
 * A sibling of upstream's {@link PreviewMoreMenu} rather than a branch inside
 * it. Almost everything that menu offers — DevTools, the separate always-on-top
 * window, emulated zoom and colour scheme, clearing storage — is a call on the
 * Electron preview bridge, and a browser has no bridge to call. Teaching
 * upstream's component to render without one meant loosening two of its props
 * to optional and wrapping four of its blocks in guards, which re-indents most
 * of the file and turns every later upstream edit to that menu into a conflict.
 *
 * What survives the trip to a frame is what a frame can actually do: reload the
 * page, and switch between filling the panel and a fixed viewport. Two items do
 * not justify that cost, so they live here and `PreviewView` picks the menu that
 * matches its surface.
 */
export function PreviewFrameMoreMenu({
  hardReloadDisabled,
  onHardReload,
  deviceToolbarVisible,
  onToggleDeviceToolbar,
}: {
  /** No tab, or a page that never rendered — nothing to reload. */
  readonly hardReloadDisabled: boolean;
  /** Replaces the frame element, which is the only reload a host can force. */
  readonly onHardReload: () => void;
  /** Fixed viewport modes expose the device toolbar and resize rails. */
  readonly deviceToolbarVisible: boolean;
  /** Switches between fill-panel mode and a fixed responsive viewport. */
  readonly onToggleDeviceToolbar: () => void;
}) {
  return (
    <Menu>
      <Tooltip>
        <TooltipTrigger
          render={
            <MenuTrigger
              render={
                <Button variant="ghost" size="icon-xs" type="button" aria-label="Preview menu" />
              }
            />
          }
        >
          <MoreVertical />
        </TooltipTrigger>
        <TooltipPopup>More</TooltipPopup>
      </Tooltip>
      <MenuPopup align="end" sideOffset={6} className="min-w-56">
        <MenuItem onClick={onHardReload} disabled={hardReloadDisabled}>
          Hard reload
        </MenuItem>
        <MenuItem onClick={onToggleDeviceToolbar} disabled={hardReloadDisabled}>
          {deviceToolbarVisible ? "Hide device toolbar" : "Show device toolbar"}
        </MenuItem>
      </MenuPopup>
    </Menu>
  );
}
