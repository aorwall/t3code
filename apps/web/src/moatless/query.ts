import { useAtomValue } from "@effect/atom-react";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import { AsyncResult, Atom } from "effect/reactivity";
import { useState } from "react";

import {
  MoatlessUnexpectedError,
  asMoatlessError,
  type MoatlessError,
  type MoatlessResponse,
  ok,
} from "@t3tools/moatless-api/customInstance";
import { moatlessApiAvailable } from "../fork/features";
import { appAtomRegistry } from "../rpc/atomRegistry";

/**
 * Reads and writes against the Moatless REST API, cached the way the rest of this app caches.
 * Not `createEnvironmentQueryAtomFamily`: it returns `Effect.never` until the environment socket
 * connects, and Moatless REST is plain same-origin HTTP, so reusing it would blank every settings
 * page on socket reconnect. This borrows only the caching (`Atom.swr`, `setIdleTTL`).
 */

/** How long a cached read is served before a background revalidation. */
const DEFAULT_STALE_TIME_MS = 30_000;

/** How long an unobserved read is kept before it is dropped. */
const DEFAULT_IDLE_TTL_MS = 5 * 60_000;

/**
 * A read, identified by a key that is both cache identity and invalidation handle.
 * Path-like (`workspaces`, `workspaces/{id}`) so `invalidate("workspaces")` reaches a list and
 * every detail under it without a second dependency table.
 */
export interface MoatlessQuery<A> {
  readonly key: string;
  readonly atom: Atom.Atom<AsyncResult.AsyncResult<A, MoatlessError>>;
}

const queryFamily = Atom.family((key: string) => {
  const execute = executors.get(key);
  if (execute === undefined) {
    // Unreachable through `moatlessQuery`, which registers before it reads.
    // Failing loudly beats an atom that resolves to nothing forever.
    return Atom.make(
      AsyncResult.failure<never, MoatlessError>(
        Cause.fail(new MoatlessUnexpectedError(`No Moatless query registered for "${key}"`)),
      ),
    );
  }
  return Atom.make(
    Effect.tryPromise({
      // A T3 server has no `/api/v1`. Failing here keeps every Moatless read
      // off the network instead of turning each one into a 404.
      try: () =>
        moatlessApiAvailable()
          ? execute()
          : Promise.reject(new MoatlessUnexpectedError("This server has no Moatless API")),
      catch: asMoatlessError,
    }),
  ).pipe(
    Atom.swr({ staleTime: DEFAULT_STALE_TIME_MS, revalidateOnMount: true }),
    Atom.setIdleTTL(DEFAULT_IDLE_TTL_MS),
    Atom.withLabel(`moatless:${key}`),
  );
});

/**
 * Registered separately from the family because `Atom.family` memoises on the
 * key alone: two calls with the same key must return the same atom, so the
 * fetch cannot be part of the key. A key is expected to name one request.
 */
const executors = new Map<string, () => Promise<unknown>>();

/**
 * Declare a read. `request` returns a generated client call; its success body
 * is what the atom resolves to, and any non-2xx becomes a
 * `MoatlessRequestError`.
 */
export function moatlessQuery<A>(
  key: string,
  request: () => Promise<MoatlessResponse<unknown>>,
): MoatlessQuery<A> {
  executors.set(key, async () => ok<A>(await request()));
  return { key, atom: queryFamily(key) as Atom.Atom<AsyncResult.AsyncResult<A, MoatlessError>> };
}

/**
 * Drop every cached read whose key starts with `prefix`, so the next observer refetches.
 * Prefix, not exact match: one write changes the workspace that holds it and the list that
 * summarises it, and a caller enumerating those will miss one.
 */
export function invalidate(prefix: string): void {
  for (const key of executors.keys()) {
    if (matchesInvalidationPrefix(key, prefix)) {
      appAtomRegistry.refresh(queryFamily(key));
    }
  }
}

/**
 * Whether `key` is refreshed by `invalidate(prefix)`.
 *
 * A path segment boundary, not a character prefix: `workspaces` must reach
 * `workspaces/ws_1` and must not reach a future `workspaces-archive`.
 */
export function matchesInvalidationPrefix(key: string, prefix: string): boolean {
  return key === prefix || key.startsWith(`${prefix}/`);
}

/** What a component gets from a read. */
export interface MoatlessQueryState<A> {
  readonly data: A | null;
  readonly error: Error | null;
  readonly isPending: boolean;
  readonly refresh: () => void;
}

export function useMoatlessQuery<A>(query: MoatlessQuery<A>): MoatlessQueryState<A> {
  const result = useAtomValue(query.atom);
  const refresh = () => {
    appAtomRegistry.refresh(query.atom);
  };

  const error = result._tag === "Failure" ? asError(Cause.squash(result.cause)) : null;
  return {
    data: Option.getOrNull(AsyncResult.value(result)),
    error,
    isPending: result.waiting,
    refresh,
  };
}

function asError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

/** What a component gets from a write. */
export interface MoatlessCommandState<Input, A> {
  readonly run: (input: Input) => Promise<A | null>;
  readonly isRunning: boolean;
  readonly error: Error | null;
  readonly reset: () => void;
}

/**
 * Declare a write.
 *
 * `invalidates` runs only after the request succeeds. A failed write has
 * changed nothing, and refetching on failure hides the failure behind a
 * flicker of unchanged data.
 */
export function useMoatlessCommand<Input, A>(
  request: (input: Input) => Promise<MoatlessResponse<unknown>>,
  options?: { readonly invalidates?: ReadonlyArray<string> },
): MoatlessCommandState<Input, A> {
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const invalidates = options?.invalidates;

  const run = async (input: Input): Promise<A | null> => {
    setIsRunning(true);
    setError(null);
    // No `finally`: the React Compiler cannot lower one and would skip this hook.
    let value: A | null = null;
    try {
      const result = ok<A>(await request(input));
      for (const prefix of invalidates ?? []) {
        invalidate(prefix);
      }
      value = result;
    } catch (cause) {
      setError(asMoatlessError(cause));
    }
    setIsRunning(false);
    return value;
  };

  const reset = () => {
    setError(null);
  };

  return { run, isRunning, error, reset };
}
