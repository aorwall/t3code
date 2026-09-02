/**
 * Fork-only. The web app's binding of the subtask atoms to its connection
 * runtime, the same shape `state/servers.ts` has.
 */
import { createSubtasksEnvironmentAtoms } from "@t3tools/client-runtime/state/subtasks";

import { connectionAtomRuntime } from "../connection/runtime";

export const subtasksEnvironment = createSubtasksEnvironmentAtoms(connectionAtomRuntime);
