import { WS_METHODS } from "@t3tools/contracts";
import { Atom } from "effect/unstable/reactivity";

import type { EnvironmentRegistry } from "../connection/registry.ts";
import { createEnvironmentRpcCommand, createEnvironmentRpcQueryAtomFamily } from "./runtime.ts";

/**
 * How often an open thread re-reads its own scripts. A thread's scripts change
 * when an agent declares one mid-turn, which is minutes apart, so this is a
 * poll rather than a subscription and the backend holds nothing per viewer.
 */
export const THREAD_SCRIPT_REFRESH_INTERVAL_MS = 15_000;

/**
 * Atoms for host-driven project scripts.
 *
 * `run` asks the environment to run one of a project's declared scripts inside
 * its sandbox — the environment hosts it in a named terminal and, when the
 * script serves a port, publishes that port and returns its URL. The command
 * resolves to `{ terminalId, url }`: attach to the terminal to see the console,
 * open the URL when one comes back.
 *
 * Only environments advertising the `workspaceScripts` capability answer this;
 * every other one leaves the client on its own `terminal.open` + `terminal.write`
 * path.
 *
 * `listForThread` is the fork's read under the `taskScripts` capability: every
 * script one thread can run, its own declarations merged over its project's.
 * Environments without that capability answer `UnsupportedMethodError` and the
 * client shows the project's scripts alone.
 */
export function createScriptsEnvironmentAtoms<R, E>(
  runtime: Atom.AtomRuntime<EnvironmentRegistry | R, E>,
) {
  return {
    run: createEnvironmentRpcCommand(runtime, {
      label: "environment-data:scripts:run",
      tag: WS_METHODS.scriptsRun,
    }),
    listForThread: createEnvironmentRpcQueryAtomFamily(runtime, {
      label: "environment-data:scripts:listForThread",
      tag: WS_METHODS.scriptsListForThread,
      staleTimeMs: 5_000,
      refreshIntervalMs: THREAD_SCRIPT_REFRESH_INTERVAL_MS,
    }),
  };
}
