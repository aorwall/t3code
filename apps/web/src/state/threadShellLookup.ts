/**
 * Fork-only. The web app's binding of the thread-shell lookup atoms to its
 * connection runtime, the same shape `state/subtasks.ts` has.
 */
import { createThreadShellLookupEnvironmentAtoms } from "@t3tools/client-runtime/state/thread-shell-lookup";

import { connectionAtomRuntime } from "../connection/runtime";

export const threadShellLookupEnvironment =
  createThreadShellLookupEnvironmentAtoms(connectionAtomRuntime);
