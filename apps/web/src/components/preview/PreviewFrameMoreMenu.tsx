"use client";

import { MoreVertical } from "lucide-react";

import { Button } from "~/components/ui/button";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "~/components/ui/menu";
import { Tooltip, TooltipPopup, TooltipTrigger } from "~/components/ui/tooltip";

/**
 * Fork-only. The three-dot menu for a preview shown in a hosted iframe.
 * A sibling of upstream's {@link PreviewMoreMenu}, not a branch in it: most of that menu calls the
 * Electron preview bridge, and guarding it for a bridgeless browser would re-indent the file and
 * turn every later upstream edit into a conflict. Only reload and viewport switching survive here.
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
