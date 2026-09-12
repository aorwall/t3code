/**
 * Fork-only. The web app's binding of the thread-browse atoms to its connection
 * runtime, the same shape `state/threadShellLookup.ts` has.
 */
import { createThreadBrowseEnvironmentAtoms } from "@t3tools/client-runtime/state/thread-browse";

import { connectionAtomRuntime } from "../connection/runtime";

export const threadBrowseEnvironment = createThreadBrowseEnvironmentAtoms(connectionAtomRuntime);
