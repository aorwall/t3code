/**
 * Fork-only. What the thread route does about a thread its shell listing never
 * carried: name it, decide whether it exists, and put it in the listing.
 *
 * Kept apart from `adoptedThreadShells.ts` on purpose: that module is read by
 * `state/threads.ts`, so anything importing `state/threads.ts` back into it
 * would close an import cycle around a module that builds atoms at load time.
 * Store there, hooks here.
 */
import { useAtomValue } from "@effect/atom-react";
import type {
  EnvironmentId,
  OrchestrationShellSnapshot,
  ScopedThreadRef,
  ThreadId,
} from "@t3tools/contracts";
import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import { threadKey } from "@t3tools/client-runtime/state/entities";
import type { EnvironmentThreadStatus } from "@t3tools/client-runtime/state/threads";
import { Atom } from "effect/unstable/reactivity";
import { useEffect, useMemo, useRef } from "react";

import { adoptThread } from "./adoptedThreadShells";
import { readEnvironmentSupportsFollow, useThreadShell, useThreadStatus } from "../state/entities";
import { environmentSnapshotAtom } from "../state/shell";
import { environmentThreadDetails, threadEnvironment } from "../state/threads";
import { useAtomCommand } from "../state/use-atom-command";

/** What the hooks read before a thread is chosen. Hooks may not be conditional. */
const NO_THREAD_ERROR_ATOM = Atom.make<string | null>(null).pipe(
  Atom.withLabel("fork-unlisted-thread:no-error"),
);

/** See `NO_THREAD_ERROR_ATOM`. */
const NO_SNAPSHOT_ATOM = Atom.make<OrchestrationShellSnapshot | null>(null).pipe(
  Atom.withLabel("fork-unlisted-thread:no-snapshot"),
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
 * thread", and only the second is a reason to leave the route. Both `empty` and
 * `synchronizing` carry no data and no answer: the client cannot know whether
 * the thread exists, and a client that guesses "no" navigates people off threads
 * that were about to load. `synchronizing` is the state a subscription enters
 * before it sends anything (`markSynchronizing` in client-runtime's
 * `state/threads.ts`), so reading `empty` alone answers "no" one tick after
 * mount, while the request is still in flight.
 *
 * An error settles it the other way. `orchestration.subscribeThread` fails for
 * a thread the viewer cannot open, so a failure with nothing loaded means the
 * server answered and the answer was no.
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
  const errorAtom = useMemo(
    () => (ref === null ? NO_THREAD_ERROR_ATOM : environmentThreadDetails.errorAtom(ref)),
    [ref],
  );
  const error = useAtomValue(errorAtom);
  return ref !== null && threadAwaitsFirstAnswer(status, error);
}

/**
 * Put a thread the listing does not carry into it, once, by following it.
 *
 * A Moatless listing is the open work the viewer follows, so a thread reached
 * by link is readable and absent from the sidebar at the same time. Opening one
 * is the request to work on it, and following is what makes the sidebar agree.
 *
 * Once per ref, and never again after an unfollow: the row menu's Unfollow acts
 * on the thread the viewer is looking at, and a hook that re-followed on the
 * next render would make that item do nothing. Decided against the *listing's*
 * snapshot rather than the grafted one, for the reason `missingThreadIds`
 * gives — the graft is what put this thread on screen, and reading it back
 * would answer "present" for every thread this hook exists for.
 */
export function useAutoFollowThread(ref: ScopedThreadRef | null): void {
  const follow = useAtomCommand(threadEnvironment.follow, { reportFailure: false });
  const snapshotAtom = useMemo(
    () => (ref === null ? NO_SNAPSHOT_ATOM : environmentSnapshotAtom(ref.environmentId)),
    [ref],
  );
  const snapshot = useAtomValue(snapshotAtom);
  const shell = useThreadShell(ref);
  const attempted = useRef<string | null>(null);

  useEffect(() => {
    // A null snapshot is a listing that has not answered, and asking early
    // would follow a thread the snapshot was about to carry anyway.
    if (ref === null || snapshot === null || shell === null) return;
    const key = threadKey(ref);
    if (attempted.current === key) return;
    if (!readEnvironmentSupportsFollow(ref.environmentId)) return;
    if (snapshot.threads.some((thread) => thread.id === ref.threadId)) return;
    // The sidebar filters on `archivedAt === null`, so following a closed
    // thread would write a follow with no row to unfollow it from.
    if (shell.archivedAt != null) return;
    attempted.current = key;
    void follow({ environmentId: ref.environmentId, input: { threadId: ref.threadId } });
  }, [follow, ref, shell, snapshot]);
}
