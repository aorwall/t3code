import { WS_METHODS } from "@t3tools/contracts";
import { Atom } from "effect/unstable/reactivity";

import type { EnvironmentRegistry } from "../connection/registry.ts";
import {
  createEnvironmentRpcCommand,
  createEnvironmentRpcQueryAtomFamily,
  createEnvironmentRpcSubscriptionAtomFamily,
} from "./runtime.ts";

export function createSandboxEnvironmentAtoms<R, E>(
  runtime: Atom.AtomRuntime<EnvironmentRegistry | R, E>,
) {
  return {
    /**
     * The fallback read, for a server without `sandboxStatusPush`.
     *
     * It polls because a lifecycle change has to reach the indicator somehow,
     * and without the subscription this is the only way it can.
     */
    status: createEnvironmentRpcQueryAtomFamily(runtime, {
      label: "environment-data:sandbox:status",
      tag: WS_METHODS.sandboxStatus,
      staleTimeMs: 5_000,
      refreshIntervalMs: 5_000,
    }),
    /**
     * Status pushed by the environment, seeded with the current one.
     *
     * Preferred over `status` wherever the server advertises it: one open
     * stream that says something only when the sandbox moves, rather than
     * every client asking every few seconds whether it has.
     */
    statusStream: createEnvironmentRpcSubscriptionAtomFamily(runtime, {
      label: "environment-data:sandbox:status-stream",
      tag: WS_METHODS.sandboxSubscribeStatus,
    }),
    /**
     * The same read as `status`, as a command rather than a query atom.
     *
     * A query serves a rendered status; this is for a flow that has to *wait*
     * for one — starting a stopped sandbox so a script can run needs to know
     * when it may proceed, inside an event handler where a hook cannot be read.
     */
    statusOnce: createEnvironmentRpcCommand(runtime, {
      label: "environment-data:sandbox:status-once",
      tag: WS_METHODS.sandboxStatus,
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
