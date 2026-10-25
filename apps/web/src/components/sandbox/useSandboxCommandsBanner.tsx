/**
 * Fork-only: the composer banner reporting commands a thread's agent handed to `moat cmd`.
 * The right panel is collapsed exactly when someone watches the conversation, so a build behind an
 * ended turn needs a line above the composer. Reads the same sandbox-status atom as the pill (one
 * subscription) and returns `null` when nothing runs.
 */
import type { ScopedThreadRef } from "@t3tools/contracts";
import { TerminalIcon } from "lucide-react";

import type { ComposerBannerStackItem } from "../chat/ComposerBannerStack";
import { formatElapsed, runningCommands } from "./commandDisplay";
import { useSandboxAvailability } from "./useSandboxAvailability";

export function useSandboxCommandsBanner(
  threadRef: ScopedThreadRef | null,
): ComposerBannerStackItem | null {
  const { status } = useSandboxAvailability(threadRef);
  const running = runningCommands(status.data?.commands);
  if (running.length === 0 || threadRef === null) {
    return null;
  }
  // The query's own timestamp, not a fresh clock read: every elapsed in the
  // line is measured against the same instant, and it refreshes when the
  // status does, with no timer of its own.
  const nowMs = status.dataUpdatedAt;
  const summary = running
    .map((command) => `${command.label} (${formatElapsed(command.startedAtUnixMs, nowMs)})`)
    .join(", ");

  return {
    id: `sandbox-commands:${threadRef.threadId}`,
    variant: "default",
    priority: "activity",
    icon: <TerminalIcon className="size-3.5" aria-hidden="true" />,
    title: running.length === 1 ? "1 command running" : `${running.length} commands running`,
    description: summary,
  };
}
