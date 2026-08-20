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
      // Sandbox lifecycle has no push channel — `vcs.status` is a subscription
      // the host drives, but this is a plain read. Without a poll the indicator
      // shows whatever it saw when the panel mounted: a sandbox that starts
      // afterwards (idle-reaped then run, started on the run button, or brought
      // up from another client) never turns "running" until a manual refresh.
      // The refresh reschedules only while a consumer is mounted and stops when
      // the panel idles out, so it costs a small read while the panel is open
      // and nothing when it is not.
      refreshIntervalMs: 5_000,
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
