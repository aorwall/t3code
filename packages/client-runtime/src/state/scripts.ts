import { WS_METHODS } from "@t3tools/contracts";
import { Atom } from "effect/unstable/reactivity";

import type { EnvironmentRegistry } from "../connection/registry.ts";
import { createEnvironmentRpcCommand } from "./runtime.ts";

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
 */
export function createScriptsEnvironmentAtoms<R, E>(
  runtime: Atom.AtomRuntime<EnvironmentRegistry | R, E>,
) {
  return {
    run: createEnvironmentRpcCommand(runtime, {
      label: "environment-data:scripts:run",
      tag: WS_METHODS.scriptsRun,
    }),
  };
}
