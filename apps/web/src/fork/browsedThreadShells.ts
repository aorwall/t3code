/**
 * Fork-only. The sidebar list once the browse filter has had its say.
 *
 * The rows a filter names are read here rather than grafted into the shell
 * snapshot the way `adoptedThreadShells.ts` grafts an opened thread. The graft
 * is for a thread the client is *holding*, and everything downstream must agree
 * that it exists; a browse is a view of the sidebar and nothing else. Grafting
 * it would repoint the command palette, the thread index and the first-run gate
 * at somebody else's work for as long as the filter is set.
 *
 * Opening a browsed row is then the ordinary unlisted-thread path: no listing
 * row, `threads.getShell` fetches one, and the route follows the thread.
 */
import { useAtomValue } from "@effect/atom-react";
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/shell";
import { EnvironmentId, type ThreadBrowseInput } from "@t3tools/contracts";
import * as Option from "effect/Option";
import { AsyncResult, Atom } from "effect/unstable/reactivity";
import { useMemo } from "react";

import { useArchivedThreadSnapshots } from "../lib/archivedThreadsState";
import { useServerConfigs } from "../state/entities";
import { threadBrowseEnvironment } from "../state/threadBrowse";
import {
  composeSidebarThreadList,
  threadBrowseInput,
  useThreadBrowseFilterStore,
  type ThreadBrowseFilter,
} from "./threadBrowseFilter";

interface BrowsedThreadShells {
  readonly threads: ReadonlyArray<EnvironmentThreadShell>;
  readonly isTruncated: boolean;
  readonly isLoading: boolean;
  readonly error: string | null;
}

const NO_BROWSE: BrowsedThreadShells = {
  threads: [],
  isTruncated: false,
  isLoading: false,
  error: null,
};

const EMPTY_ENVIRONMENT_IDS: ReadonlyArray<EnvironmentId> = [];

/**
 * One browse across every environment that answers it, keyed on the filter as
 * well as the environments so that changing either is a different read.
 */
const browsedShellsAtom = Atom.family((key: string) =>
  Atom.make((get): BrowsedThreadShells => {
    const [environmentIds, input] = JSON.parse(key) as [
      ReadonlyArray<string>,
      ThreadBrowseInput | null,
    ];
    if (input === null) {
      return NO_BROWSE;
    }
    const threads: EnvironmentThreadShell[] = [];
    let isTruncated = false;
    let isLoading = false;
    let error: string | null = null;
    for (const id of environmentIds) {
      const environmentId = EnvironmentId.make(id);
      const result = get(threadBrowseEnvironment.browse({ environmentId, input }));
      isLoading ||= result.waiting;
      const value = Option.getOrNull(AsyncResult.value(result));
      for (const thread of value?.threads ?? []) {
        threads.push({ ...thread, environmentId });
      }
      // One capped answer caps the list, whichever environment it came from:
      // the rows are merged, so a reader cannot tell which half is short.
      isTruncated ||= value?.truncated === true;
      if (error === null && result._tag === "Failure") {
        error = "Failed to load filtered threads.";
      }
    }
    return { threads, isTruncated, isLoading, error };
  }).pipe(Atom.withLabel(`fork-browsed-thread-shells:${key}`)),
);

/** What the sidebar's thread list is, given what its listing carried. */
export interface SidebarThreadList {
  readonly threads: ReadonlyArray<EnvironmentThreadShell>;
  /** Whether these rows came from a browse, so they are not the viewer's own. */
  readonly isBrowsing: boolean;
  /** Whether closed threads belong in the list — they arrive archived. */
  readonly showsClosed: boolean;
  /**
   * Whether a server capped the browse, so the list is the newest matches and
   * not every one. False whenever `isBrowsing` is, since only a browse is
   * capped.
   */
  readonly isTruncated: boolean;
  readonly isLoading: boolean;
  readonly error: string | null;
}

export function useSidebarThreadList(
  listed: ReadonlyArray<EnvironmentThreadShell>,
): SidebarThreadList {
  const filter = useThreadBrowseFilter();
  const serverConfigs = useServerConfigs();
  // A browse only reaches a server that understands the method; an older one
  // would answer every filter with an unsupported-method failure. With none of
  // them able to, the filter has nothing to apply and the listing stands.
  const browsableEnvironmentIds = useMemo(
    () =>
      [...serverConfigs]
        .filter(([, config]) => config.environment.capabilities.threadBrowse === true)
        .map(([environmentId]) => environmentId)
        .sort(),
    [serverConfigs],
  );
  const archivedEnvironmentIds = useMemo(
    () => (filter.includeClosed ? [...serverConfigs.keys()].sort() : EMPTY_ENVIRONMENT_IDS),
    [filter.includeClosed, serverConfigs],
  );

  const input = browsableEnvironmentIds.length === 0 ? null : threadBrowseInput(filter);
  const browsed = useAtomValue(browsedShellsAtom(JSON.stringify([browsableEnvironmentIds, input])));
  // Closed work the viewer follows is already a listing of its own, so the
  // toggle reads that rather than asking a browse for rows it can serve.
  const archived = useArchivedThreadSnapshots(archivedEnvironmentIds);
  const archivedThreads = useMemo(
    () =>
      archived.snapshots.flatMap((entry) =>
        entry.snapshot.threads.map((thread) => ({ ...thread, environmentId: entry.environmentId })),
      ),
    [archived.snapshots],
  );

  return useMemo(
    () => ({
      threads: composeSidebarThreadList({
        listed,
        browsed: input === null ? null : browsed.threads,
        archived: archivedThreads,
      }),
      isBrowsing: input !== null,
      showsClosed: filter.includeClosed,
      isTruncated: input !== null && browsed.isTruncated,
      isLoading: browsed.isLoading || archived.isLoading,
      error: browsed.error ?? archived.error,
    }),
    [
      archived.error,
      archived.isLoading,
      archivedThreads,
      browsed,
      filter.includeClosed,
      input,
      listed,
    ],
  );
}

/** The filter as one value, for a caller that needs all of it. */
export function useThreadBrowseFilter(): ThreadBrowseFilter {
  const ownerUserId = useThreadBrowseFilterStore((store) => store.ownerUserId);
  const tag = useThreadBrowseFilterStore((store) => store.tag);
  const includeClosed = useThreadBrowseFilterStore((store) => store.includeClosed);
  return useMemo(() => ({ ownerUserId, tag, includeClosed }), [includeClosed, ownerUserId, tag]);
}
