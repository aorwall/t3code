/**
 * Fork-only: the thread details panel's sandbox row, standing where upstream shows the workspace
 * kind (`FEATURES.worktreeSelection`). One status line plus the lifecycle actions the state allows.
 * Cleanup stays in the Sandbox panel: it deletes the workspace.
 */
import type { ScopedThreadRef } from "@t3tools/contracts";
import { LoaderCircleIcon } from "lucide-react";

import { useEnvironment } from "~/state/environments";

import { THREAD_DETAILS_PANEL_ICON_CLASS } from "../chat/threadDetailsPanelStyles";
import { ThreadDetailsControl } from "../chat/ThreadDetailsControl";
import { Menu, MenuItem, MenuItemLabel, MenuPopup, MenuTrigger } from "../ui/menu";
import { toastManager } from "../ui/toast";
import { SandboxCommandsBadge } from "./SandboxCommandsBadge";
import { ACTION_ICONS, ACTION_LABELS, ACTION_ORDER, STATUS_PRESENTATION } from "./SandboxPanel";
import { SandboxDot } from "./SandboxPanelPrimitives";
import { sandboxActionsFor, type SandboxAction } from "./sandboxPanelFormat";
import { useSandboxAction } from "./useSandboxAction";
import { useSandboxAvailability } from "./useSandboxAvailability";

// Start and stop are served wherever sandbox status is; the rest only where
// the server advertises `sandboxDetail`.
const LIFECYCLE_ACTIONS: ReadonlySet<SandboxAction> = new Set(["start", "stop"]);

export function SandboxDetailsRow({ threadRef }: { readonly threadRef: ScopedThreadRef }) {
  const { status } = useSandboxAvailability(threadRef);
  const environment = useEnvironment(threadRef.environmentId);
  const controlsSupported =
    environment?.serverConfig?.environment.capabilities.sandboxDetail === true;
  const { run, pending } = useSandboxAction(threadRef, status.refresh);

  const sandboxStatus = status.data?.sandboxStatus ?? null;
  const presentation = sandboxStatus ? STATUS_PRESENTATION[sandboxStatus] : null;
  const available = sandboxActionsFor(status.isPending ? null : sandboxStatus);
  const offered = ACTION_ORDER.filter(
    (action) =>
      action !== "cleanup" &&
      available.has(action) &&
      (controlsSupported || LIFECYCLE_ACTIONS.has(action)),
  );
  const moving =
    pending !== null ||
    status.isPending ||
    sandboxStatus === "initializing" ||
    sandboxStatus === "removing";

  const onAction = async (action: SandboxAction) => {
    const failure = await run(action);
    if (failure === null) return;
    toastManager.add({
      type: "error",
      title: `Could not ${ACTION_LABELS[action].toLowerCase()} the sandbox`,
      description: failure,
    });
  };

  return (
    <Menu highlightItemOnHover={false}>
      <MenuTrigger render={<ThreadDetailsControl part="select" aria-label="Sandbox actions" />}>
        <span className="flex size-4 shrink-0 items-center justify-center">
          {moving ? (
            <LoaderCircleIcon className={`${THREAD_DETAILS_PANEL_ICON_CLASS} animate-spin`} />
          ) : (
            <SandboxDot tone={status.error ? "danger" : (presentation?.tone ?? "muted")} />
          )}
        </span>
        <span className="min-w-0 flex-1 truncate">
          Sandbox
          <span className="ms-1.5 font-normal text-muted-foreground">
            {status.error ? "Unavailable" : (presentation?.label ?? "Checking")}
          </span>
        </span>
        <SandboxCommandsBadge commands={status.data?.commands} nowMs={status.dataUpdatedAt} />
      </MenuTrigger>
      <MenuPopup align="end" className="w-(--anchor-width)">
        {offered.length > 0 ? (
          offered.map((action) => {
            const Icon = ACTION_ICONS[action];
            return (
              <MenuItem
                key={action}
                disabled={pending !== null}
                onClick={() => void onAction(action)}
              >
                <Icon />
                <MenuItemLabel>{ACTION_LABELS[action]}</MenuItemLabel>
              </MenuItem>
            );
          })
        ) : (
          <MenuItem disabled>
            <MenuItemLabel>
              {status.error ?? "Nothing to do while the sandbox is moving."}
            </MenuItemLabel>
          </MenuItem>
        )}
      </MenuPopup>
    </Menu>
  );
}
