/**
 * Fork-only. Moatless serves `subscribeWorktreeSetup` as a sandbox's start: the
 * stage ids are upstream's and the steps behind them the sandbox's. A turn sent
 * while the sandbox starts queues, so the start never holds the composer.
 */
import type { WorktreeSetupPhase, WorktreeSetupStageId } from "@t3tools/contracts";

/** Whether a running setup holds sends back. Upstream's does until the agent starts. */
export const SANDBOX_SETUP_BLOCKS_SEND = false;

/** Whether the card offers "Work locally": a Moatless thread has no local checkout. */
export const SANDBOX_SETUP_OFFERS_WORK_LOCALLY = false;

export function sandboxSetupStageLabel(id: WorktreeSetupStageId): string {
  switch (id) {
    case "fetch":
      return "Start sandbox";
    case "checkout":
      return "Check out repository";
    case "submodules":
      return "Fetch plugins";
    case "agent":
      return "Start agent";
    case "setup-script":
      return "Run setup commands";
  }
}

export function sandboxSetupHeaderLabel(phase: WorktreeSetupPhase): string {
  switch (phase) {
    case "running":
      return "Starting sandbox…";
    case "done":
      return "Sandbox ready";
    case "failed":
      return "Sandbox start failed";
    case "cancelled":
      return "Sandbox start cancelled";
  }
}
