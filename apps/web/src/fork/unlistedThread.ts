/**
 * Fork-only. The two things the thread route needs to know about a thread its
 * shell listing never carried.
 *
 * Kept apart from `adoptedThreadShells.ts` on purpose: that module is read by
 * `state/threads.ts`, so anything importing `state/threads.ts` back into it
 * would close an import cycle around a module that builds atoms at load time.
 * Store there, hooks here.
 */
import { useAtomValue } from "@effect/atom-react";
import type { EnvironmentId, ScopedThreadRef, ThreadId } from "@t3tools/contracts";
import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import { Atom } from "effect/unstable/reactivity";
import { useEffect, useMemo } from "react";

import { adoptThread } from "./adoptedThreadShells";
import { useThreadStatus } from "../state/entities";
import { environmentThreadDetails } from "../state/threads";

/** What the hooks read before a thread is chosen. Hooks may not be conditional. */
const NO_THREAD_ERROR_ATOM = Atom.make<string | null>(null).pipe(
  Atom.withLabel("fork-unlisted-thread:no-error"),
);

/**
 * Hold this thread in the shell store while the caller is mounted, so it has a
 * title, a project and an archived stamp even though no listing named it.
 *
 * Held unconditionally rather than only when the listing lacks it: whether it
 * is missing is decided against the listing's own snapshot inside the store,
 * which is the one place that can decide it without the answer feeding back
 * into the question.
 */
export function useAdoptedThread(
  environmentId: EnvironmentId | null,
  threadId: ThreadId | null,
): void {
  useEffect(() => {
    if (environmentId === null || threadId === null) {
      return;
    }
    return adoptThread(scopeThreadRef(environmentId, threadId));
  }, [environmentId, threadId]);
}

/**
 * Whether the environment has yet said anything at all about this thread.
 *
 * This is the difference between "we have not asked yet" and "there is no such
 * thread", and only the second is a reason to leave the route. A thread state
 * that is still `empty` with no error is a subscription that has not answered:
 * the client cannot know whether the thread exists, and a client that guesses
 * "no" navigates people off threads that were about to load.
 *
 * An error settles it the other way. `orchestration.subscribeThread` fails for
 * a thread the viewer cannot open, so a failure with nothing loaded means the
 * server answered and the answer was no.
 */
export function useThreadAwaitingFirstAnswer(ref: ScopedThreadRef | null): boolean {
  const status = useThreadStatus(ref);
  const errorAtom = useMemo(
    () => (ref === null ? NO_THREAD_ERROR_ATOM : environmentThreadDetails.errorAtom(ref)),
    [ref],
  );
  const error = useAtomValue(errorAtom);
  return ref !== null && status === "empty" && error === null;
}
