/**
 * Fork-only: the composer banner that reports the commands a thread's agent
 * handed to `moat cmd`.
 *
 * The sandbox status pill in the right panel already shows these, but the panel
 * is collapsed or absent exactly when someone is watching the conversation — so
 * a build running behind an ended turn leaves no trace in the thread itself.
 * This puts one line above the composer while any registered command runs.
 *
 * It reads the same sandbox-status atom the pill does (keyed by thread, so the
 * two share one subscription and one poll), and returns `null` when nothing is
 * running — which is the common case, so the banner stays out of the way.
 */
import type { ScopedThreadRef } from "@t3tools/contracts";
import { TerminalIcon } from "lucide-react";
import { useMemo } from "react";

import type { ComposerBannerStackItem } from "../chat/ComposerBannerStack";
import { formatElapsed, runningCommands } from "./commandDisplay";
import { useSandboxAvailability } from "./useSandboxAvailability";

export function useSandboxCommandsBanner(
  threadRef: ScopedThreadRef | null,
): ComposerBannerStackItem | null {
  const { status } = useSandboxAvailability(threadRef);
  const commands = status.data?.commands;

  return useMemo<ComposerBannerStackItem | null>(() => {
    const running = runningCommands(commands);
    if (running.length === 0 || threadRef === null) {
      return null;
    }
    // One clock read shared across the rows, so every elapsed in the line is
    // measured against the same instant. It refreshes when the status does.
    const nowMs = Date.now();
    const summary = running
      .map((command) => `${command.label} (${formatElapsed(command.startedAtUnixMs, nowMs)})`)
      .join(", ");

    return {
      id: `sandbox-commands:${threadRef.threadId}`,
      variant: "default",
      priority: "activity",
      icon: <TerminalIcon className="size-3.5" aria-hidden="true" />,
      title:
        running.length === 1
          ? "1 command running"
          : `${running.length} commands running`,
      description: summary,
    };
  }, [commands, threadRef]);
}
