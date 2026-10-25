/**
 * Fork-only. Held threads absent from the shell listing, grafted into the snapshot while watched.
 * A Moatless listing is only the open work you follow, so a thread reached by link or archive
 * has a transcript but no listing row. `threads.getShell` supplies it; adoption is refcounted.
 * The sidebar's `archivedAt === null` filter still hides adopted closed threads.
 */
import type {
  EnvironmentId,
  OrchestrationV2ShellSnapshot,
  OrchestrationV2ThreadShell,
  ScopedThreadRef,
} from "@t3tools/contracts";
import { threadKey } from "@t3tools/client-runtime/state/entities";
import * as Option from "effect/Option";
import { AsyncResult, Atom } from "effect/reactivity";

import { appAtomRegistry } from "../rpc/atomRegistry";
import { threadShellLookupEnvironment } from "../state/threadShellLookup";

interface AdoptedThreadRefs {
  readonly refs: ReadonlyArray<ScopedThreadRef>;
}

const adoptedThreadRefsAtom = Atom.make<AdoptedThreadRefs>({ refs: [] }).pipe(
  Atom.keepAlive,
  Atom.withLabel("fork-adopted-thread-shells:refs"),
);

/**
 * Refcounted rather than a set, because a route can mount twice before it
 * unmounts once — StrictMode does exactly that — and the second unmount must
 * not release a thread the first mount is still showing.
 */
const holds = new Map<string, { readonly ref: ScopedThreadRef; count: number }>();

function publish(): void {
  appAtomRegistry.set(adoptedThreadRefsAtom, {
    refs: [...holds.values()].map((hold) => hold.ref),
  });
}

/** Hold a thread in the store. Returns the release. */
export function adoptThread(ref: ScopedThreadRef): () => void {
  const key = threadKey(ref);
  const held = holds.get(key);
  if (held) {
    held.count += 1;
  } else {
    holds.set(key, { ref, count: 1 });
    publish();
  }

  let released = false;
  return () => {
    if (released) {
      return;
    }
    released = true;
    const current = holds.get(key);
    if (!current) {
      return;
    }
    current.count -= 1;
    if (current.count <= 0) {
      holds.delete(key);
      publish();
    }
  };
}

/**
 * Which held threads this snapshot is missing.
 * Read the *listing's* snapshot, never the grafted one, or an adopted thread would read as
 * present and stop being supplied.
 */
export function missingThreadIds(
  snapshot: OrchestrationV2ShellSnapshot,
  environmentId: EnvironmentId,
  refs: ReadonlyArray<ScopedThreadRef>,
): ReadonlyArray<ScopedThreadRef["threadId"]> {
  const listed = new Set(snapshot.threads.map((thread) => thread.id));
  return refs
    .filter((ref) => ref.environmentId === environmentId && !listed.has(ref.threadId))
    .map((ref) => ref.threadId);
}

/** Splice adopted rows into a listing snapshot, or hand back the original. */
export function graftThreadShells(
  snapshot: OrchestrationV2ShellSnapshot,
  adopted: ReadonlyArray<OrchestrationV2ThreadShell>,
): OrchestrationV2ShellSnapshot {
  if (adopted.length === 0) {
    return snapshot;
  }
  return { ...snapshot, threads: [...snapshot.threads, ...adopted] };
}

/**
 * The listing snapshot every thread-shell atom reads, with adopted rows in it.
 *
 * Drop-in for the `base` snapshot family it wraps: same key, same type, and
 * identical whenever nothing is adopted.
 */
export function createAdoptedEnvironmentSnapshotAtom(
  base: (environmentId: EnvironmentId) => Atom.Atom<OrchestrationV2ShellSnapshot | null>,
): (environmentId: EnvironmentId) => Atom.Atom<OrchestrationV2ShellSnapshot | null> {
  return Atom.family((environmentId: EnvironmentId) =>
    Atom.make((get): OrchestrationV2ShellSnapshot | null => {
      const snapshot = get(base(environmentId));
      // Before the listing has answered there is nothing to be missing from, and
      // asking early would race the snapshot that was about to carry the thread.
      if (snapshot === null) {
        return null;
      }
      const missing = missingThreadIds(snapshot, environmentId, get(adoptedThreadRefsAtom).refs);
      const adopted = missing
        .map((threadId) =>
          Option.getOrNull(
            AsyncResult.value(
              get(threadShellLookupEnvironment.get({ environmentId, input: { threadId } })),
            ),
          ),
        )
        .map((result) => result?.thread ?? null)
        .filter((thread): thread is OrchestrationV2ThreadShell => thread !== null);
      return graftThreadShells(snapshot, adopted);
    }).pipe(Atom.withLabel(`fork-adopted-thread-shells:snapshot:${environmentId}`)),
  );
}
