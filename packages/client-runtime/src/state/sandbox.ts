import { WS_METHODS } from "@t3tools/contracts";
import { Atom } from "effect/unstable/reactivity";

import type { EnvironmentRegistry } from "../connection/registry.ts";
import { createEnvironmentRpcCommand, createEnvironmentRpcQueryAtomFamily } from "./runtime.ts";

export function createSandboxEnvironmentAtoms<R, E>(
  runtime: Atom.AtomRuntime<EnvironmentRegistry | R, E>,
) {
  return {
    status: createEnvironmentRpcQueryAtomFamily(runtime, {
      label: "environment-data:sandbox:status",
      tag: WS_METHODS.sandboxStatus,
      staleTimeMs: 5_000,
    }),
    start: createEnvironmentRpcCommand(runtime, {
      label: "environment-data:sandbox:start",
      tag: WS_METHODS.sandboxStart,
    }),
    stop: createEnvironmentRpcCommand(runtime, {
      label: "environment-data:sandbox:stop",
      tag: WS_METHODS.sandboxStop,
    }),
  };
}
