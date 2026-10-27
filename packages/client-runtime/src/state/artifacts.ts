/**
 * Fork-only. The command that sets who may open an Artifact a thread published.
 * @module state/artifacts
 */
import { WS_METHODS } from "@t3tools/contracts";
import type { Atom } from "effect/reactivity";

import type { EnvironmentRegistry } from "../connection/registry.ts";
import { createEnvironmentRpcCommand } from "./runtime.ts";

export function createArtifactsEnvironmentAtoms<R, E>(
  runtime: Atom.AtomRuntime<EnvironmentRegistry | R, E>,
) {
  return {
    setVisibility: createEnvironmentRpcCommand(runtime, {
      label: "environment-data:artifacts:set-visibility",
      tag: WS_METHODS.artifactsSetVisibility,
    }),
  };
}
