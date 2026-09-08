/**
 * Sandbox detail — everything the sandbox panel shows beside the lifecycle
 * state.
 *
 * Fork-only. Upstream has no sandbox to describe: a thread runs on the machine
 * the server runs on. A Moatless thread runs in a pod that can be restarted,
 * redeployed, reaped for idleness, or found holding a container that will not
 * start, and this is the read that says which.
 *
 * Deliberately separate from `SandboxStatusResult` in `sandbox.ts` rather than
 * more keys on it. That result backs an always-open subscription every client
 * holds for its status indicator, and this one is read at a tenth the rate by
 * the one panel that is open. Widening the indicator's shape would make every
 * client pay for a panel it is not showing.
 *
 * **Every runtime-sourced section is absent rather than empty.** A
 * docker-compose deployment serves no containers and no events, and a
 * Kubernetes one without metrics-server serves no per-container metrics. The
 * panel hides a section it was sent nothing for, instead of rendering zeroes
 * that read as measurements.
 *
 * @module SandboxDetail
 */
import { Schema } from "effect";
import { ThreadId } from "./baseSchemas.ts";

export const SandboxDetailInput = Schema.Struct({
  threadId: ThreadId,
});
export type SandboxDetailInput = typeof SandboxDetailInput.Type;

/**
 * Where the backend is trying to take the sandbox, which is not where it is.
 *
 * `SandboxRuntimeStatus` reports the pod; this reports the persisted intent
 * behind it. They disagree for as long as a transition takes, and the panel
 * reads that disagreement as "moving" rather than showing one of them alone.
 */
export const SandboxDesiredState = Schema.Literals(["running", "stopped", "removed"]);
export type SandboxDesiredState = typeof SandboxDesiredState.Type;

/**
 * What the sandbox runs, and what a redeploy would give it.
 *
 * The two halves come from different places: `current` is the running pod's and
 * `latest` is the deployment config's, so either can be known while the other
 * is not. `upToDate` is set only when both are.
 */
export const SandboxImageInfo = Schema.Struct({
  current: Schema.NullOr(Schema.String),
  latest: Schema.NullOr(Schema.String),
  upToDate: Schema.NullOr(Schema.Boolean),
});
export type SandboxImageInfo = typeof SandboxImageInfo.Type;

/** A container's state as the runtime reports it, normalized by the backend. */
export const SandboxContainerState = Schema.Literals([
  "running",
  "waiting",
  "terminated",
  "unknown",
]);
export type SandboxContainerState = typeof SandboxContainerState.Type;

/**
 * One container in the thread's sandbox pod.
 *
 * The `last*` pair describes the previous run of this container, which is the
 * only place a crash-looping container's exit reason survives — the current run
 * is `waiting` and says nothing about why.
 */
export const SandboxContainerInfo = Schema.Struct({
  name: Schema.String,
  state: SandboxContainerState,
  restartCount: Schema.Int,
  exitCode: Schema.NullOr(Schema.Int),
  terminatedReason: Schema.NullOr(Schema.String),
  lastExitCode: Schema.NullOr(Schema.Int),
  lastTerminatedReason: Schema.NullOr(Schema.String),
  waitingReason: Schema.NullOr(Schema.String),
  /** Null where the runtime publishes no metrics, so the panel shows no
      number rather than a zero that reads as an idle container. */
  cpuMillicores: Schema.NullOr(Schema.Number),
  memoryMb: Schema.NullOr(Schema.Number),
});
export type SandboxContainerInfo = typeof SandboxContainerInfo.Type;

/**
 * One thing the runtime did to the sandbox: a scheduling failure, an image
 * pull, a crash-loop back-off.
 *
 * `severity` is the runtime's own word and is not narrowed to literals here.
 * Kubernetes writes `Normal` and `Warning` today; a value neither of those must
 * not fail the decode and blank the whole panel, so the client treats anything
 * that is not a warning as neutral.
 */
export const SandboxRuntimeEventInfo = Schema.Struct({
  reason: Schema.String,
  message: Schema.String,
  severity: Schema.NullOr(Schema.String),
  /** How many times the runtime collapsed this event into one row. */
  count: Schema.NullOr(Schema.Int),
  lastTimestamp: Schema.NullOr(Schema.String),
});
export type SandboxRuntimeEventInfo = typeof SandboxRuntimeEventInfo.Type;

/**
 * The sandbox panel's read.
 *
 * The first two keys describe the thread and are always answered. The rest
 * describe a running sandbox and are absent when there is nothing to describe;
 * see the module doc.
 */
export const SandboxDetailResult = Schema.Struct({
  desiredState: SandboxDesiredState,
  /** How long the sandbox may sit idle before the reaper stops it. `0`
      disables the idle stop entirely. */
  idleTimeoutMinutes: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  image: Schema.optionalKey(SandboxImageInfo),
  containers: Schema.optionalKey(Schema.Array(SandboxContainerInfo)),
  runtimeEvents: Schema.optionalKey(Schema.Array(SandboxRuntimeEventInfo)),
});
export type SandboxDetailResult = typeof SandboxDetailResult.Type;

export const SandboxDetailSubscribeInput = SandboxDetailInput;
export type SandboxDetailSubscribeInput = typeof SandboxDetailSubscribeInput.Type;

export const SandboxRestartInput = SandboxDetailInput;
export type SandboxRestartInput = typeof SandboxRestartInput.Type;

export const SandboxRedeployInput = SandboxDetailInput;
export type SandboxRedeployInput = typeof SandboxRedeployInput.Type;

export const SandboxCleanupInput = SandboxDetailInput;
export type SandboxCleanupInput = typeof SandboxCleanupInput.Type;

export const SandboxSetIdleTimeoutInput = Schema.Struct({
  threadId: ThreadId,
  /** `0` disables the idle stop. Negative is refused by the server. */
  minutes: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
});
export type SandboxSetIdleTimeoutInput = typeof SandboxSetIdleTimeoutInput.Type;

/**
 * The accepted value, echoed back.
 *
 * Deliberately not the whole detail result: the write goes through the thread
 * command sink and the panel's subscription re-reads the rest on its own tick.
 */
export const SandboxSetIdleTimeoutResult = Schema.Struct({
  idleTimeoutMinutes: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
});
export type SandboxSetIdleTimeoutResult = typeof SandboxSetIdleTimeoutResult.Type;
