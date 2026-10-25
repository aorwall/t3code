/**
 * Sandbox - Schemas for a thread's hosted execution environment lifecycle.
 *
 * This surface is only about whether the environment exists and whether it is
 * available.
 *
 * @module Sandbox
 */
import { Schema } from "effect";
import { ThreadId } from "./baseSchemas.ts";

/** The lifecycle state of a thread's hosted execution environment. */
export const SandboxRuntimeStatus = Schema.Literals([
  "not_created",
  "initializing",
  "ready",
  "stopped",
  "removing",
  "removed",
  "error",
]);
export type SandboxRuntimeStatus = typeof SandboxRuntimeStatus.Type;

export const SandboxStatusInput = Schema.Struct({
  threadId: ThreadId,
});
export type SandboxStatusInput = typeof SandboxStatusInput.Type;

/**
 * What the agent inside the environment reports it is doing.
 *
 * `unknown` means the sandbox is up but the agent is unreachable, which is not idle. A gap
 * is the key being absent: sandbox not up, or no `capabilities.sandboxAgentStatus`.
 */
export const SandboxAgentStatus = Schema.Literals(["running", "waiting", "idle", "unknown"]);
export type SandboxAgentStatus = typeof SandboxAgentStatus.Type;

/** Lifecycle of a command the agent registered through `moat cmd`. */
export const ManagedCommandState = Schema.Literals(["running", "exited", "timedOut", "killed"]);
export type ManagedCommandState = typeof ManagedCommandState.Type;

/**
 * A long-running command the agent handed to the sandbox with `moat cmd`.
 *
 * The agent reports `idle` while one runs, so `agentStatus` alone cannot tell finished from
 * mid-build. Fields are instants, never elapsed durations: recomputing elapsed per read
 * would change every poll and the push would never fall quiet.
 */
export const CommandSummary = Schema.Struct({
  id: Schema.String,
  /** Human label, defaulted by the sandbox to a prefix of the command line. */
  label: Schema.String,
  state: ManagedCommandState,
  startedAtUnixMs: Schema.Number,
  /** When the sandbox kills it for outliving its deadline. */
  deadlineUnixMs: Schema.Number,
  /** Set once terminal; 124 is a timeout kill, matching coreutils `timeout`. */
  exitCode: Schema.NullOr(Schema.Number),
});
export type CommandSummary = typeof CommandSummary.Type;

export const SandboxStatusResult = Schema.Struct({
  sandboxStatus: SandboxRuntimeStatus,
  /** Absent whenever the environment is not up, so it is `optionalKey` rather
      than nullable — a `null` would fail the decode of the whole result. */
  agentStatus: Schema.optionalKey(SandboxAgentStatus),
  /** Fork: why the sandbox is where it is, when the runtime said. Absent for
      the same reason `agentStatus` is, and the sandbox panel's Status section
      is the only thing that renders it. */
  sandboxError: Schema.optionalKey(Schema.String),
  /** The commands registered through `moat cmd`, running and recently
      finished. Absent — not `[]` — when none are registered or the server
      predates `capabilities.sandboxCommands`, so a client reads its presence
      as "this server reports commands" and its contents as "these are live". */
  commands: Schema.optionalKey(Schema.Array(CommandSummary)),
});
export type SandboxStatusResult = typeof SandboxStatusResult.Type;

export const SandboxStartInput = SandboxStatusInput;
export type SandboxStartInput = typeof SandboxStartInput.Type;
export const SandboxStartResult = SandboxStatusResult;
export type SandboxStartResult = typeof SandboxStartResult.Type;

export const SandboxStopInput = SandboxStatusInput;
export type SandboxStopInput = typeof SandboxStopInput.Type;
export const SandboxStopResult = SandboxStatusResult;
export type SandboxStopResult = typeof SandboxStopResult.Type;

export const SandboxStatusSubscribeInput = SandboxStatusInput;
export type SandboxStatusSubscribeInput = typeof SandboxStatusSubscribeInput.Type;

/**
 * The thread's sandbox is not running, but the request needed one.
 *
 * Typed because a client can remedy it alone: `sandbox.start` plus a wait.
 */
export class SandboxNotRunningError extends Schema.TaggedError<SandboxNotRunningError>()(
  "SandboxNotRunningError",
  {
    threadId: Schema.String,
  },
) {
  override get message() {
    return `The sandbox is not running for thread: ${this.threadId}`;
  }
}
