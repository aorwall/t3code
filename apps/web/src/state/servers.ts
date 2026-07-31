import { createServersEnvironmentAtoms } from "@t3tools/client-runtime/state/servers";

import { connectionAtomRuntime } from "../connection/runtime";

export const serversEnvironment = createServersEnvironmentAtoms(connectionAtomRuntime);
