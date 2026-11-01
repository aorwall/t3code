/**
 * Fork-only. What the thread route does about a thread its shell listing never carried.
 * Separate from `adoptedThreadShells.ts`: `state/threads.ts` reads that module, so importing
 * it back would close an import cycle around a module that builds atoms at load time.
 */
import { useAtomValue } from "@effect/atom-react";
import type { EnvironmentId, ScopedThreadRef, ThreadId } from "@t3tools/contracts";
import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import type { EnvironmentThreadStatus } from "@t3tools/client-runtime/state/threads";
import { Atom } from "effect/reactivity";
import { useEffect } from "react";

import { adoptThread } from "./adoptedThreadShells";
import { useThreadStatus } from "../state/entities";
import { environmentThreadDetails } from "../state/threads";

/** What the hooks read before a thread is chosen. Hooks may not be conditional. */
const NO_THREAD_ERROR_ATOM = Atom.make<string | null>(null).pipe(
  Atom.withLabel("fork-unlisted-thread:no-error"),
);

/**
 * Hold this thread in the shell store while the caller is mounted.
 * Held unconditionally: whether it is missing is decided inside the store against the
 * listing's own snapshot, so the answer cannot feed back into the question.
 */
export function useAdoptedThread(
  environmentId: EnvironmentId | null,
  threadId: ThreadId | null,
): void {
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Fork: registers the thread with the adoption store for as long as it is shown.
  useEffect(() => {
    if (environmentId === null || threadId === null) {
      return;
    }
    return adoptThread(scopeThreadRef(environmentId, threadId));
  }, [environmentId, threadId]);
}

/**
 * Whether the environment has yet said anything about this thread.
 * `empty` and `synchronizing` both carry no answer; guessing "no" navigates people off threads
 * about to load. `synchronizing` precedes the first send, so `empty` alone answers "no" too early.
 * An error with nothing loaded means the server answered no (`subscribeThread` failed).
 */
export function threadAwaitsFirstAnswer(
  status: EnvironmentThreadStatus,
  error: string | null,
): boolean {
  return error === null && (status === "empty" || status === "synchronizing");
}

/** See `threadAwaitsFirstAnswer`. */
export function useThreadAwaitingFirstAnswer(ref: ScopedThreadRef | null): boolean {
  const status = useThreadStatus(ref);
  const errorAtom = ref === null ? NO_THREAD_ERROR_ATOM : environmentThreadDetails.errorAtom(ref);
  const error = useAtomValue(errorAtom);
  return ref !== null && threadAwaitsFirstAnswer(status, error);
}
