/**
 * Fork-only. The atom for one thread's listing row, asked for by id.
 *
 * A plain query with no refresh interval, because this is not a second source
 * of truth for a thread — it is how the client learns the row for a thread the
 * listing never carried. Once it has one, the shell subscription is what keeps
 * it current for as long as the thread is in the listing at all, and a thread
 * that is not in the listing has nothing pushing changes to re-read.
 *
 * The stale time is long for the same reason: what this returns is a title, a
 * project and an archived stamp, none of which move while someone reads the
 * thread underneath them.
 *
 * @module state/threadShellLookup
 */
import { WS_METHODS } from "@t3tools/contracts";
import type { Atom } from "effect/unstable/reactivity";

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
