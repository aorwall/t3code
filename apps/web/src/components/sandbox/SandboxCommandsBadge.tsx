/**
 * Fork-only: a badge for the commands a thread's agent registered through
 * `moat cmd`.
 *
 * The agent reports `idle` the moment its turn ends, so a thread running a
 * 40-minute build behind an ended turn looks finished. This is the one place
 * that says otherwise: it counts the still-running commands and names them,
 * reading the `commands` the sandbox status now carries.
 *
 * Elapsed is computed here from `startedAtUnixMs`, never sent by the server —
 * a server-side elapsed would change on every read and turn the status push,
 * which sends only what moved, into one that never falls quiet. It refreshes
 * whenever the status does (a poll or a push), which is often enough for a
 * minute-scale build; there is no per-second timer, so nothing repaints
 * continuously.
 */
import type { CommandSummary } from "@t3tools/contracts";
import { TerminalIcon } from "lucide-react";

import { cn } from "~/lib/utils";

import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import { formatElapsed, runningCommands } from "./commandDisplay";

interface SandboxCommandsBadgeProps {
  readonly commands: readonly CommandSummary[] | undefined;
  readonly className?: string | undefined;
}

export function SandboxCommandsBadge({ commands, className }: SandboxCommandsBadgeProps) {
  const running = runningCommands(commands);
  if (running.length === 0) {
    return null;
  }

  // A single clock read per render, shared across the rows, so every elapsed
  // in one tooltip is measured against the same instant.
  const nowMs = Date.now();

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <div
            className={cn(
              "flex shrink-0 items-center gap-1 rounded-md border border-border/70 bg-background px-1.5 py-1 text-xs font-medium text-muted-foreground shadow-xs",
              className,
            )}
          >
            <TerminalIcon className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="tabular-nums">
              {running.length} running {running.length === 1 ? "command" : "commands"}
            </span>
          </div>
        }
      />
      <TooltipPopup side="top" className="max-w-80">
        <ul className="flex flex-col gap-1">
          {running.map((command) => (
            <li key={command.id} className="flex items-baseline justify-between gap-3">
              <code className="min-w-0 truncate text-foreground">{command.label}</code>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {formatElapsed(command.startedAtUnixMs, nowMs)}
              </span>
            </li>
          ))}
        </ul>
      </TooltipPopup>
    </Tooltip>
  );
}
