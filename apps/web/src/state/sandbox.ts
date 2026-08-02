import { createSandboxEnvironmentAtoms } from "@t3tools/client-runtime/state/sandbox";

import { connectionAtomRuntime } from "../connection/runtime";

export const sandboxEnvironment = createSandboxEnvironmentAtoms(connectionAtomRuntime);
