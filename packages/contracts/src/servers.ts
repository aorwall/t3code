/**
 * Servers - Schemas for the preview servers a thread's environment declares.
 *
 * A hosted environment declares its servers in repository config (a dev server,
 * a docs site, an API) and runs each as its own container. These schemas
 * describe them as reads only: what is declared, what state the runtime reports,
 * and what one is printing. Nothing here starts, stops or reconfigures a server.
 *
 * Field names are taken verbatim from the host's own server record, so the
 * server side is a rename-free serialization of what it already assembles.
 *
 * @module Servers
 */
import { Schema } from "effect";
import { ThreadId, TrimmedNonEmptyString } from "./baseSchemas.ts";

/**
 * The state the runtime reports for one server container.
 *
 * `installing` and `starting` are distinct because a dev server that is
 * fetching dependencies is not the same wait as one that has started and is
 * not yet answering its port.
 */
export const ServerRuntimeStatus = Schema.Literals([
  "stopped",
  "installing",
  "starting",
  "started",
  "failed",
]);
export type ServerRuntimeStatus = typeof ServerRuntimeStatus.Type;

/** The state of the environment the servers run in. */
export const ServerSandboxStatus = Schema.Literals([
  "not_created",
  "initializing",
  "ready",
  "stopped",
  "removing",
  "removed",
  "error",
]);
export type ServerSandboxStatus = typeof ServerSandboxStatus.Type;

/**
 * One declared server.
 *
 * `url` is null until the runtime has somewhere to point at, which is the
 * ordinary case for a server whose environment was never started. `error` and
 * `detail` are null unless the status is `failed`, and are the two halves of
 * why: a short reason and whatever the runtime said underneath it.
 */
export const ThreadServer = Schema.Struct({
  name: TrimmedNonEmptyString,
  label: TrimmedNonEmptyString,
  port: Schema.Int.check(Schema.isGreaterThan(0)).check(Schema.isLessThan(65536)),
  status: ServerRuntimeStatus,
  url: Schema.NullOr(TrimmedNonEmptyString),
  error: Schema.NullOr(Schema.String),
  detail: Schema.NullOr(Schema.String),
  default: Schema.Boolean,
});
export type ThreadServer = typeof ThreadServer.Type;

export const ServersListInput = Schema.Struct({
  threadId: ThreadId,
});
export type ServersListInput = typeof ServersListInput.Type;

/**
 * Every server the thread declares, whether or not any of them is running.
 *
 * The list is config-first: a thread whose environment has never been
 * provisioned answers with its declared servers, all `stopped` and without a
 * URL, rather than with nothing.
 */
export const ServersListResult = Schema.Struct({
  servers: Schema.Array(ThreadServer),
  sandboxStatus: ServerSandboxStatus,
});
export type ServersListResult = typeof ServersListResult.Type;

export const SandboxStatusInput = ServersListInput;
export type SandboxStatusInput = typeof SandboxStatusInput.Type;
export const SandboxStatusResult = Schema.Struct({
  sandboxStatus: ServerSandboxStatus,
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

export const ServerStatusSubscribeInput = Schema.Struct({
  threadId: ThreadId,
});
export type ServerStatusSubscribeInput = typeof ServerStatusSubscribeInput.Type;

/**
 * A full server list, never a delta — a subscriber that misses a message
 * loses nothing.
 */
export const ServerStatusSnapshot = Schema.Struct({
  threadId: TrimmedNonEmptyString,
  servers: Schema.Array(ThreadServer),
  observedAt: Schema.String,
});
export type ServerStatusSnapshot = typeof ServerStatusSnapshot.Type;

export const ServerLogsSubscribeInput = Schema.Struct({
  threadId: ThreadId,
  name: TrimmedNonEmptyString,
  /** Read the previous instance's log instead of the running one's. */
  previous: Schema.optional(Schema.Boolean),
});
export type ServerLogsSubscribeInput = typeof ServerLogsSubscribeInput.Type;

/**
 * One log line. Nothing is retained server-side, so a subscriber that
 * reconnects receives only new lines and the gap is not backfilled.
 */
export const ServerLogLine = Schema.Struct({
  threadId: TrimmedNonEmptyString,
  name: TrimmedNonEmptyString,
  line: Schema.String,
});
export type ServerLogLine = typeof ServerLogLine.Type;
