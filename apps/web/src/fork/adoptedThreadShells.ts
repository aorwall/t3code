/**
 * Fork-only. Threads the client is holding that its shell listing does not
 * carry, adopted into the snapshot for as long as something is looking at them.
 *
 * Upstream's client learns a thread exists from the shell listing and nowhere
 * else, and that is exact upstream: the listing is every thread the server has.
 * A Moatless listing is not. It is the *open* work you *follow*, so a thread
 * reached by link, by a subtask row, or out of the archive arrives with a
 * transcript from the thread subscription and no listing row at all — no title,
 * no project, no archived stamp, because those are the listing's to give.
 *
 * The fix is a graft rather than a second store: `threads.getShell` returns the
 * row the listing would have carried, and it is spliced into the snapshot the
 * thread-shell atoms already read. Everything downstream — the shell index,
 * project grouping, the archived badge — then works on a thread that is not in
 * the listing without knowing that it isn't.
 *
 * Two consequences worth stating, because both are deliberate:
 *
 * - The sidebar filters on `archivedAt === null`, so an adopted *closed* thread
 *   stays out of it and an adopted *open* one appears while it is held. That is
 *   the right split, and it comes for free from where the graft sits.
 * - Adoption is refcounted and released, so the graft lives exactly as long as
 *   something is looking. A thread nobody is on returns to being absent, which
 *   is what it is.
 */
import type {
  EnvironmentId,
  OrchestrationShellSnapshot,
  OrchestrationThreadShell,
  ScopedThreadRef,
} from "@t3tools/contracts";
import { threadKey } from "@t3tools/client-runtime/state/entities";
import * as Option from "effect/Option";
import { AsyncResult, Atom } from "effect/unstable/reactivity";

import { appAtomRegistry } from "../rpc/atomRegistry";
import { environmentSnapshotAtom } from "../state/shell";
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
 *
 * Read off the *listing's* snapshot, never the grafted one, so a thread the
 * graft supplied does not read as present and stop being supplied. It is also
 * what keeps a listed thread from ever reaching the network: a row that is
 * already here is filtered out before its atom is touched.
 */
export function missingThreadIds(
  snapshot: OrchestrationShellSnapshot,
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
  snapshot: OrchestrationShellSnapshot,
  adopted: ReadonlyArray<OrchestrationThreadShell>,
): OrchestrationShellSnapshot {
  if (adopted.length === 0) {
    return snapshot;
  }
  return { ...snapshot, threads: [...snapshot.threads, ...adopted] };
}

const graftedSnapshotAtom = Atom.family((environmentId: EnvironmentId) =>
  Atom.make((get): OrchestrationShellSnapshot | null => {
    const snapshot = get(environmentSnapshotAtom(environmentId));
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
      .filter((thread): thread is OrchestrationThreadShell => thread !== null);
    return graftThreadShells(snapshot, adopted);
  }).pipe(Atom.withLabel(`fork-adopted-thread-shells:snapshot:${environmentId}`)),
);

/**
 * The listing snapshot every thread-shell atom reads, with adopted rows in it.
 *
 * Drop-in for `environmentSnapshotAtom`: same key, same type, and identical
 * whenever nothing is adopted.
 */
export function adoptedEnvironmentSnapshotAtom(
  environmentId: EnvironmentId,
): Atom.Atom<OrchestrationShellSnapshot | null> {
  return graftedSnapshotAtom(environmentId);
}
