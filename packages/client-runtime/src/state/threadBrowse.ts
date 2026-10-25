/**
 * Fork-only. The atom for the listing rows a browse filter names.
 *
 * A plain query on an interval: nothing pushes a browsed row, since the change feed re-reads
 * by follow. The interval is the sidebar's pace, not a container probe's.
 * @module state/threadBrowse
 */
import { WS_METHODS } from "@t3tools/contracts";
import type { Atom } from "effect/reactivity";

import type { EnvironmentRegistry } from "../connection/registry.ts";
import { createEnvironmentRpcQueryAtomFamily } from "./runtime.ts";

/** How often an open browse filter re-reads its rows. */
export const THREAD_BROWSE_REFRESH_INTERVAL_MS = 10_000;

export function createThreadBrowseEnvironmentAtoms<R, E>(
  runtime: Atom.AtomRuntime<EnvironmentRegistry | R, E>,
) {
  return {
    browse: createEnvironmentRpcQueryAtomFamily(runtime, {
      label: "environment-data:threads:browse",
      tag: WS_METHODS.threadsBrowse,
      staleTimeMs: 5_000,
      refreshIntervalMs: THREAD_BROWSE_REFRESH_INTERVAL_MS,
    }),
  };
}
