import { WS_METHODS } from "@t3tools/contracts";
import { Atom } from "effect/reactivity";

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
 * `run` resolves to `{ terminalId, url }` and only answers on `workspaceScripts` environments;
 * others leave the client on `terminal.open` + `terminal.write`. `listForThread` needs
 * `taskScripts`; without it (`UnsupportedMethodError`) the client shows project scripts alone.
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
