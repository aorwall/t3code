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

export const SandboxStatusResult = Schema.Struct({
  sandboxStatus: SandboxRuntimeStatus,
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
