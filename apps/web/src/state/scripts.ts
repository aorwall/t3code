import { createScriptsEnvironmentAtoms } from "@t3tools/client-runtime/state/scripts";

import { connectionAtomRuntime } from "../connection/runtime";

export const scriptsEnvironment = createScriptsEnvironmentAtoms(connectionAtomRuntime);
