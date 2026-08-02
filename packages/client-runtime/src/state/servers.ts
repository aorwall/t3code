import { type ServerLogLine, WS_METHODS } from "@t3tools/contracts";
import * as Stream from "effect/Stream";
import { Atom } from "effect/unstable/reactivity";

import type { EnvironmentRegistry } from "../connection/registry.ts";
import {
  createEnvironmentRpcCommand,
  createEnvironmentRpcQueryAtomFamily,
  createEnvironmentRpcSubscriptionAtomFamily,
} from "./runtime.ts";

/**
 * How many log lines one subscription keeps. A starting dev server can print
 * thousands, and a view that renders all of them stops being readable long
 * before it stops being affordable.
 */
export const SERVER_LOG_LINE_LIMIT = 2_000;

export interface ServerLogBuffer {
  readonly name: string;
  readonly lines: readonly string[];
  /** Lines dropped off the front, so the view can say the log is truncated. */
  readonly dropped: number;
}

const EMPTY_LOG_BUFFER: ServerLogBuffer = { name: "", lines: [], dropped: 0 };

/**
 * Fold each line into the buffer the view renders.
 *
 * The subscription atom holds the latest emitted value, so accumulating here
 * rather than in the component is what makes a remounted panel keep the lines
 * it already received.
 */
export function appendServerLogLine(
  buffer: ServerLogBuffer,
  event: ServerLogLine,
): readonly [ServerLogBuffer, ReadonlyArray<ServerLogBuffer>] {
  const appended = [...buffer.lines, event.line];
  const overflow = Math.max(0, appended.length - SERVER_LOG_LINE_LIMIT);
  const next: ServerLogBuffer = {
    name: event.name,
    lines: overflow === 0 ? appended : appended.slice(overflow),
    dropped: buffer.dropped + overflow,
  };
  return [next, [next]];
}

export function createServersEnvironmentAtoms<R, E>(
  runtime: Atom.AtomRuntime<EnvironmentRegistry | R, E>,
) {
  return {
    list: createEnvironmentRpcQueryAtomFamily(runtime, {
      label: "environment-data:servers:list",
      tag: WS_METHODS.serversList,
      staleTimeMs: 5_000,
    }),
    sandboxStatus: createEnvironmentRpcQueryAtomFamily(runtime, {
      label: "environment-data:sandbox:status",
      tag: WS_METHODS.sandboxStatus,
      staleTimeMs: 5_000,
    }),
    startSandbox: createEnvironmentRpcCommand(runtime, {
      label: "environment-data:sandbox:start",
      tag: WS_METHODS.sandboxStart,
    }),
    stopSandbox: createEnvironmentRpcCommand(runtime, {
      label: "environment-data:sandbox:stop",
      tag: WS_METHODS.sandboxStop,
    }),
    status: createEnvironmentRpcSubscriptionAtomFamily(runtime, {
      label: "environment-data:servers:status",
      tag: WS_METHODS.subscribeServerStatus,
    }),
    logs: createEnvironmentRpcSubscriptionAtomFamily(runtime, {
      label: "environment-data:servers:logs",
      tag: WS_METHODS.serversSubscribeLogs,
      transform: (stream) =>
        stream.pipe(Stream.mapAccum(() => EMPTY_LOG_BUFFER, appendServerLogLine)),
    }),
  };
}
