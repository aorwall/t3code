/**
 * Sandbox - Schemas for a thread's hosted execution environment lifecycle.
 *
 * This surface is only about whether the environment exists and whether it is
 * available. Preview server declarations and runtime rows live in `servers.ts`.
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
 * `unknown` is a real answer and not a gap: the sandbox is up but the agent
 * could not be reached, which is different from it being idle. A gap is the
 * key being absent — either the sandbox is not up, or the server predates
 * `capabilities.sandboxAgentStatus`.
 */
export const SandboxAgentStatus = Schema.Literals(["running", "waiting", "idle", "unknown"]);
export type SandboxAgentStatus = typeof SandboxAgentStatus.Type;

export const SandboxStatusResult = Schema.Struct({
  sandboxStatus: SandboxRuntimeStatus,
  /** Absent whenever the environment is not up, so it is `optionalKey` rather
      than nullable — a `null` would fail the decode of the whole result. */
  agentStatus: Schema.optionalKey(SandboxAgentStatus),
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
 * The thread's sandbox is not running, so the request needed one and there
 * wasn't one.
 *
 * Typed rather than a message because it is the rare failure a client can
 * answer on its own: the sandbox is startable, the person already said what
 * they wanted, and `sandbox.start` plus a wait is the whole remedy. Reporting
 * the sentence instead would make every caller re-derive that from prose.
 */
export class SandboxNotRunningError extends Schema.TaggedErrorClass<SandboxNotRunningError>()(
  "SandboxNotRunningError",
  {
    threadId: Schema.String,
  },
) {
  override get message() {
    return `The sandbox is not running for thread: ${this.threadId}`;
  }
}
