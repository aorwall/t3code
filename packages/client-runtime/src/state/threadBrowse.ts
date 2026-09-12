/**
 * Fork-only. The atom for the listing rows a browse filter names.
 *
 * A query rather than a subscription, and a deliberately plain one: nothing
 * pushes a browsed row. The change feed re-reads by follow, so a thread the
 * viewer does not follow moves with nothing telling this client about it. A
 * subscription here would hold a poller per filter on the backend to deliver
 * what re-asking on an interval delivers, and the filter closing would need a
 * lifecycle on both sides where this needs none.
 *
 * The interval is the sidebar's own pace rather than a container probe's: what
 * moves on these rows is a turn starting or a thread being closed, which a
 * person watching somebody else's work reads as immediate at this distance.
 *
 * @module state/threadBrowse
 */
import { WS_METHODS } from "@t3tools/contracts";
import type { Atom } from "effect/unstable/reactivity";

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
