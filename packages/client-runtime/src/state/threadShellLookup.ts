/**
 * Fork-only. The atom for one thread's listing row, asked for by id.
 *
 * A plain query with a long stale time: it only fetches rows the listing never carried, and
 * the shell subscription keeps any row in the listing current. @module state/threadShellLookup
 */
import { WS_METHODS } from "@t3tools/contracts";
import type { Atom } from "effect/reactivity";

import type { EnvironmentRegistry } from "../connection/registry.ts";
import { createEnvironmentRpcQueryAtomFamily } from "./runtime.ts";

/** Long enough that revisiting a thread within a session re-uses the row. */
export const THREAD_SHELL_STALE_TIME_MS = 60_000;

export function createThreadShellLookupEnvironmentAtoms<R, E>(
  runtime: Atom.AtomRuntime<EnvironmentRegistry | R, E>,
) {
  return {
    get: createEnvironmentRpcQueryAtomFamily(runtime, {
      label: "environment-data:threads:get-shell",
      tag: WS_METHODS.threadsGetShell,
      staleTimeMs: THREAD_SHELL_STALE_TIME_MS,
    }),
  };
}
