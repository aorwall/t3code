/**
 * Fork-only. What the thread route does about a thread its shell listing never carried.
 * Separate from `adoptedThreadShells.ts`: `state/threads.ts` reads that module, so importing
 * it back would close an import cycle around a module that builds atoms at load time.
 */
import { useAtomValue } from "@effect/atom-react";
import type {
  EnvironmentId,
  OrchestrationV2ShellSnapshot,
  ScopedThreadRef,
  ThreadId,
} from "@t3tools/contracts";
import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import { threadKey } from "@t3tools/client-runtime/state/entities";
import type { EnvironmentThreadStatus } from "@t3tools/client-runtime/state/threads";
import { Atom } from "effect/reactivity";
import { useEffect, useRef } from "react";

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
const NO_SNAPSHOT_ATOM = Atom.make<OrchestrationV2ShellSnapshot | null>(null).pipe(
  Atom.withLabel("fork-unlisted-thread:no-snapshot"),
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
  // oxlint-disable-next-line t3code/react-effect-budget -- Fork: registers the thread with the adoption store for as long as it is shown.
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

/**
 * Put a thread the listing does not carry into it, once, by following it.
 * Once per ref, never again after an unfollow, or the row menu's Unfollow would do nothing.
 * Decide against the *listing's* snapshot, as `missingThreadIds` does, not the grafted one.
 */
export function useAutoFollowThread(ref: ScopedThreadRef | null): void {
  const follow = useAtomCommand(threadEnvironment.follow, { reportFailure: false });
  const snapshotAtom = ref === null ? NO_SNAPSHOT_ATOM : environmentSnapshotAtom(ref.environmentId);
  const snapshot = useAtomValue(snapshotAtom);
  const shell = useThreadShell(ref);
  const attempted = useRef<string | null>(null);

  // oxlint-disable-next-line t3code/react-effect-budget -- Fork: follows an unlisted thread on the backend once the snapshot answers.
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
