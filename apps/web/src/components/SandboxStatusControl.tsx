/**
 * Fork-only: what the thread's sandbox is doing, in one line.
 *
 * An indicator, not a control. It renders inside the launcher card and the "+"
 * menu entry that open the sandbox surface, both of which are buttons, so it
 * holds no button of its own: every sandbox action lives in the surface it
 * points at.
 */
import type { SandboxStatusResult } from "@t3tools/contracts";
import { AlertTriangleIcon, LoaderCircleIcon } from "lucide-react";

import { cn } from "~/lib/utils";
import type { EnvironmentQueryView } from "~/state/query";

import { SandboxCommandsBadge } from "./sandbox/SandboxCommandsBadge";
import { Tooltip, TooltipPopup, TooltipTrigger } from "./ui/tooltip";

type SandboxStatus = SandboxStatusResult["sandboxStatus"];

const STATUS_TONES: Record<SandboxStatus, "muted" | "warning" | "error"> = {
  not_created: "warning",
  initializing: "muted",
  ready: "muted",
  stopped: "warning",
  removing: "muted",
  removed: "warning",
  error: "error",
};

interface SandboxStatusControlProps {
  readonly status: EnvironmentQueryView<SandboxStatusResult>;
  readonly className?: string | undefined;
  /**
   * Drop the status text and the pill chrome, for hosts that have already said
   * what this is about. The text moves to the hover title.
   */
  readonly compact?: boolean | undefined;
}

export function SandboxStatusControl({ status, className, compact }: SandboxStatusControlProps) {
  const sandboxStatus = status.data?.sandboxStatus ?? null;
  const tone = status.error
    ? "error"
    : status.isPending
      ? "muted"
      : sandboxStatus === null
        ? "warning"
        : STATUS_TONES[sandboxStatus];
  const label =
    status.isPending && !status.error
      ? "Checking sandbox status"
      : sandboxStatus === "ready"
        ? "Sandbox running"
        : "Sandbox unavailable";

  const control = (
    <div
      aria-live="polite"
      className={cn(
        "flex min-w-0 shrink-0 items-center gap-2",
        !compact && "rounded-md border border-border/70 bg-background px-2 py-1 shadow-xs",
        !compact && tone === "error" && "border-destructive/35 bg-destructive/5",
        !compact && tone === "warning" && "border-warning/35 bg-warning/5",
        className,
      )}
    >
      {status.isPending || sandboxStatus === "initializing" || sandboxStatus === "removing" ? (
        <LoaderCircleIcon className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
      ) : tone === "error" ? (
        <AlertTriangleIcon className="size-3.5 shrink-0 text-destructive" />
      ) : (
        <span
          className={cn(
            "size-2 shrink-0 rounded-full",
            // The launcher shows this while everything is fine, so a running
            // sandbox has to look like one rather than like a warning.
            sandboxStatus === "ready" ? "bg-success" : "bg-warning",
          )}
        />
      )}
      <div
        className={cn("min-w-0 truncate text-xs font-medium text-foreground", compact && "sr-only")}
      >
        {label}
      </div>
      {/* The commands the agent handed to `moat cmd`, so a build running behind
          an ended turn is not mistaken for a finished thread. Renders nothing
          when none are running. */}
      <SandboxCommandsBadge commands={status.data?.commands} />
    </div>
  );

  if (!compact) return control;

  return (
    <Tooltip>
      <TooltipTrigger render={control} />
      <TooltipPopup side="top">{label}</TooltipPopup>
    </Tooltip>
  );
}
