/**
 * Fork-only. The web app's binding of the Artifact atoms to its connection
 * runtime, the same shape `state/sandbox.ts` has.
 */
import { createArtifactsEnvironmentAtoms } from "@t3tools/client-runtime/state/artifacts";

import { connectionAtomRuntime } from "../connection/runtime";

export const artifactsEnvironment = createArtifactsEnvironmentAtoms(connectionAtomRuntime);
