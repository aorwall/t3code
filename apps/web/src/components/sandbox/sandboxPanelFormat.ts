/**
 * Fork-only: the sandbox panel's pure presentation rules.
 *
 * Separated from the panel so the decisions that are easy to get wrong — which
 * control a lifecycle state may offer, which of a container's four reason
 * fields explains it, what a missing metric renders as — are testable without a
 * render.
 */
import type {
  SandboxContainerInfo,
  SandboxImageInfo,
  SandboxRuntimeEventInfo,
  SandboxRuntimeStatus,
} from "@t3tools/contracts";

/** A lifecycle transition the panel offers, named for the RPC behind it. */
export type SandboxAction = "start" | "stop" | "restart" | "redeploy" | "cleanup";

/**
 * Which transitions make sense from a lifecycle state.
 *
 * `restart` replaces the pod and `redeploy` rebuilds the deployment, so both
 * need one to exist: neither is offered before the sandbox has ever been
 * created. `cleanup` deletes the workspace archives as well, so it stays
 * available for a sandbox that is stopped — that is the state someone reaches
 * before deciding they are finished with the thread.
 */
export function sandboxActionsFor(status: SandboxRuntimeStatus | null): ReadonlySet<SandboxAction> {
  switch (status) {
    case "ready":
      return new Set<SandboxAction>(["stop", "restart", "redeploy", "cleanup"]);
    case "stopped":
      return new Set<SandboxAction>(["start", "redeploy", "cleanup"]);
    case "error":
      return new Set<SandboxAction>(["start", "restart", "redeploy", "cleanup"]);
    case "not_created":
    case "removed":
      return new Set<SandboxAction>(["start"]);
    // A sandbox mid-transition is offered nothing: every one of these would
    // race the transition already under way.
    case "initializing":
    case "removing":
    case null:
      return new Set<SandboxAction>();
  }
}

/** Actions the person has to confirm, because no other action undoes them. */
export const SANDBOX_CONFIRM_ACTIONS: ReadonlySet<SandboxAction> = new Set<SandboxAction>([
  "redeploy",
  "cleanup",
]);

export const SANDBOX_ACTION_CONFIRMATIONS: Readonly<Record<string, string>> = {
  redeploy:
    "Rebuild this sandbox's deployment from the repository's current config? The workspace is kept, but everything running in the sandbox stops.",
  cleanup:
    "Remove this sandbox and delete its archives? The workspace cannot be recovered afterwards.",
};

/**
 * The choices the idle-stop setter offers, in minutes.
 *
 * `0` disables the idle stop, which is the backend's own encoding rather than a
 * sentinel invented here.
 */
export const IDLE_TIMEOUT_CHOICES: ReadonlyArray<{
  readonly minutes: number;
  readonly label: string;
}> = [
  { minutes: 15, label: "15 minutes" },
  { minutes: 60, label: "1 hour" },
  { minutes: 720, label: "12 hours" },
  { minutes: 1440, label: "24 hours" },
  { minutes: 0, label: "Never" },
];

/** Renders a value the setter does not offer as well as one it does. */
export function formatIdleTimeout(minutes: number): string {
  const choice = IDLE_TIMEOUT_CHOICES.find((entry) => entry.minutes === minutes);
  if (choice) return choice.label;
  if (minutes < 60) return `${minutes} minutes`;
  const hours = minutes / 60;
  return Number.isInteger(hours) ? `${hours} hours` : `${minutes} minutes`;
}

/**
 * The part of an image reference worth reading in a narrow panel.
 *
 * The registry host and the repository path are the same on every sandbox in a
 * deployment; the tag is what a redeploy changes.
 */
export function shortImageRef(ref: string): string {
  const lastSlash = ref.lastIndexOf("/");
  return lastSlash === -1 ? ref : ref.slice(lastSlash + 1);
}

/** Null renders as an em dash, never as a zero; see the contract module doc. */
export function formatCpu(millicores: number | null): string {
  return millicores === null ? "—" : `${millicores}m`;
}

export function formatMemory(mb: number | null): string {
  if (mb === null) return "—";
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GiB` : `${Math.round(mb)} MiB`;
}

/**
 * The pod's totals, or null where no container reported a number.
 *
 * A sum over the containers that did report would understate the pod, so a
 * partial answer is treated as no answer.
 */
export function totalContainerResources(containers: ReadonlyArray<SandboxContainerInfo>): {
  readonly cpuMillicores: number | null;
  readonly memoryMb: number | null;
} {
  const sum = (pick: (container: SandboxContainerInfo) => number | null) =>
    containers.length > 0 && containers.every((container) => pick(container) !== null)
      ? containers.reduce((total, container) => total + (pick(container) ?? 0), 0)
      : null;
  return {
    cpuMillicores: sum((container) => container.cpuMillicores),
    memoryMb: sum((container) => container.memoryMb),
  };
}

/**
 * Why a container is not running, from whichever of the runtime's four reason
 * fields applies.
 *
 * A crash-looping container is `waiting` now and says nothing about the crash,
 * so the previous run's reason is what explains it — which is why the `last`
 * pair is read before giving up.
 */
export function containerReason(container: SandboxContainerInfo): string | null {
  if (container.state === "running") return null;
  const exit = (code: number | null) => (code === null ? "" : ` (exit ${code})`);
  if (container.waitingReason !== null) {
    return container.lastTerminatedReason === null
      ? container.waitingReason
      : `${container.waitingReason} after ${container.lastTerminatedReason}${exit(container.lastExitCode)}`;
  }
  if (container.terminatedReason !== null) {
    return `${container.terminatedReason}${exit(container.exitCode)}`;
  }
  if (container.lastTerminatedReason !== null) {
    return `${container.lastTerminatedReason}${exit(container.lastExitCode)}`;
  }
  return null;
}

/**
 * Anything that is not a warning is neutral.
 *
 * Deliberately a substring-free equality on the lowercased word rather than a
 * literal union: the value is the runtime's, and an unrecognized one must read
 * as ordinary rather than as an alarm.
 */
export function eventIsWarning(event: SandboxRuntimeEventInfo): boolean {
  return event.severity?.toLowerCase() === "warning";
}

/**
 * Whether the Image section has anything worth saying about freshness.
 *
 * `upToDate` is null where the deployment publishes no latest tag to compare
 * against, which is not the same as being behind one.
 */
export function imageUpdateAvailable(image: SandboxImageInfo): boolean {
  return image.upToDate === false;
}
