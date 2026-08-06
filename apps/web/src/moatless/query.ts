import { useAtomValue } from "@effect/atom-react";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import { AsyncResult, Atom } from "effect/unstable/reactivity";
import { useCallback, useMemo, useState } from "react";

import {
  MoatlessRequestError,
  MoatlessTransportError,
  type MoatlessResponse,
  ok,
} from "@t3tools/moatless-api/customInstance";
import { appAtomRegistry } from "../rpc/atomRegistry";

/**
 * Reads and writes against the Moatless REST API, cached the way the rest of
 * this app caches.
 *
 * # Why this exists rather than `createEnvironmentQueryAtomFamily`
 *
 * `packages/client-runtime/src/state/runtime.ts:480` is the app's query helper
 * and it would type-check here — it takes any `Effect`. It also returns
 * `Effect.never` until the environment socket reports a connected generation
 * (`runtime.ts:516`), because everything it was built for is served over that
 * socket. Administration data is not: it is HTTP, on the same origin, with the
 * same cookie, and it has no reason to wait for a chat connection. Reusing that
 * helper would blank every settings page whenever the socket reconnects.
 *
 * So this borrows the part that is about caching — `Atom.swr`, `setIdleTTL`,
 * registry-driven refresh — and none of the part that is about the socket.
 */

/** How long a cached read is served before a background revalidation. */
const DEFAULT_STALE_TIME_MS = 30_000;

/** How long an unobserved read is kept before it is dropped. */
const DEFAULT_IDLE_TTL_MS = 5 * 60_000;

/**
 * A read, identified by a key.
 *
 * The key is the cache identity and the invalidation handle in one. It is a
 * path-like string — `workspaces`, `workspaces/{id}`, `plugins/{id}/skills` —
 * so that `invalidate("workspaces")` reaches a list and every detail under it
 * without anyone maintaining a second table of what depends on what.
 */
export interface MoatlessQuery<A> {
  readonly key: string;
  readonly atom: Atom.Atom<AsyncResult.AsyncResult<A, Error>>;
}

const queryFamily = Atom.family((key: string) => {
  const execute = executors.get(key);
  if (execute === undefined) {
    // Unreachable through `moatlessQuery`, which registers before it reads.
    // Failing loudly beats an atom that resolves to nothing forever.
    return Atom.make(
      AsyncResult.failure<never, Error>(
        Cause.fail(new Error(`No Moatless query registered for "${key}"`)),
      ),
    );
  }
  return Atom.make(
    // The repo-wide Effect rule wants a tagged error here. The two failures
    // this can produce are already distinct classes — `MoatlessRequestError`
    // and `MoatlessTransportError` — and every reader of a Moatless query
    // renders `.message` rather than branching on the tag, so the channel is
    // deliberately the widest thing they have in common.
    // @effect-diagnostics-next-line globalErrorInEffectCatch:off
    Effect.tryPromise({
      try: execute,
      catch: (cause) => toError(cause),
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

function toError(cause: unknown): Error {
  if (cause instanceof MoatlessRequestError) return cause;
  if (cause instanceof MoatlessTransportError) return cause;
  return cause instanceof Error ? cause : new Error(String(cause));
}

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
  return { key, atom: queryFamily(key) as Atom.Atom<AsyncResult.AsyncResult<A, Error>> };
}

/**
 * Drop every cached read whose key starts with `prefix`, so the next observer
 * refetches.
 *
 * Prefix rather than exact match: a write to one repository placement changes
 * the workspace that holds it and the list that summarises it, and a caller
 * that has to enumerate those is a caller that will miss one.
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
  const refresh = useCallback(() => {
    appAtomRegistry.refresh(query.atom);
  }, [query.atom]);

  return useMemo(() => {
    const error = result._tag === "Failure" ? asError(Cause.squash(result.cause)) : null;
    return {
      data: Option.getOrNull(AsyncResult.value(result)),
      error,
      isPending: result.waiting,
      refresh,
    };
  }, [result, refresh]);
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

  const run = useCallback(
    async (input: Input): Promise<A | null> => {
      setIsRunning(true);
      setError(null);
      try {
        const value = ok<A>(await request(input));
        for (const prefix of invalidates ?? []) {
          invalidate(prefix);
        }
        return value;
      } catch (cause) {
        setError(toError(cause));
        return null;
      } finally {
        setIsRunning(false);
      }
    },
    [request, invalidates],
  );

  const reset = useCallback(() => {
    setError(null);
  }, []);

  return { run, isRunning, error, reset };
}
