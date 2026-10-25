/**
 * Fork-only. Atoms for the threads a thread spawned.
 *
 * A query, not a subscription: subtask status moves in minutes, so the client re-asks on an
 * interval while the panel is open and the backend holds no poller per subscriber.
 * @module state/subtasks
 */
import { WS_METHODS } from "@t3tools/contracts";
import type { Atom } from "effect/reactivity";

import type { EnvironmentRegistry } from "../connection/registry.ts";
import { createEnvironmentRpcQueryAtomFamily } from "./runtime.ts";

/**
 * How often an open agents panel re-reads the list. Long enough that an idle
 * panel costs almost nothing, short enough that a child settling reads as
 * immediate to someone watching the fleet.
 */
export const SUBTASK_REFRESH_INTERVAL_MS = 10_000;

export function createSubtasksEnvironmentAtoms<R, E>(
  runtime: Atom.AtomRuntime<EnvironmentRegistry | R, E>,
) {
  return {
    list: createEnvironmentRpcQueryAtomFamily(runtime, {
      label: "environment-data:subtasks:list",
      tag: WS_METHODS.subtasksList,
      staleTimeMs: 5_000,
      refreshIntervalMs: SUBTASK_REFRESH_INTERVAL_MS,
    }),
  };
}
