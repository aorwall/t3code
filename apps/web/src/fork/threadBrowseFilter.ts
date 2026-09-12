/**
 * Fork-only. What the sidebar list is narrowed to, beyond the project scope.
 *
 * A Moatless listing is the open work the viewer follows, so narrowing it is
 * two different operations wearing one control. Owner and tag reach *outside*
 * the listing — they are `threads.browse`, a read of what the viewer may see
 * rather than what they follow, and the rows come back in place of the listing
 * rather than filtered out of it. "Include closed" stays inside it: closed work
 * the viewer follows is already served by `orchestration.getArchivedShellSnapshot`,
 * and it is appended.
 *
 * Its own store rather than a field in `uiStateStore`: that one is upstream's,
 * and this whole surface disappears with the fork.
 */
import type { ThreadBrowseInput } from "@t3tools/contracts";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { resolveStorage } from "../lib/storage";

export interface ThreadBrowseFilter {
  /** Moatless user id whose work to list, or null for the viewer's own listing. */
  readonly ownerUserId: string | null;
  /** Tag name a listed thread must carry, or null for any. */
  readonly tag: string | null;
  readonly includeClosed: boolean;
}

export const NO_THREAD_BROWSE_FILTER: ThreadBrowseFilter = {
  ownerUserId: null,
  tag: null,
  includeClosed: false,
};

interface ThreadBrowseFilterStore extends ThreadBrowseFilter {
  readonly setOwnerUserId: (ownerUserId: string | null) => void;
  readonly setTag: (tag: string | null) => void;
  readonly setIncludeClosed: (includeClosed: boolean) => void;
  readonly reset: () => void;
}

export const useThreadBrowseFilterStore = create<ThreadBrowseFilterStore>()(
  persist(
    (set) => ({
      ...NO_THREAD_BROWSE_FILTER,
      setOwnerUserId: (ownerUserId) => set({ ownerUserId }),
      setTag: (tag) => set({ tag }),
      setIncludeClosed: (includeClosed) => set({ includeClosed }),
      reset: () => set({ ...NO_THREAD_BROWSE_FILTER }),
    }),
    {
      name: "t3code:fork:thread-browse-filter:v1",
      version: 1,
      storage: createJSONStorage(() =>
        resolveStorage(typeof window !== "undefined" ? window.localStorage : undefined),
      ),
      partialize: (state) => ({
        ownerUserId: state.ownerUserId,
        tag: state.tag,
        includeClosed: state.includeClosed,
      }),
    },
  ),
);

/** Whether the list comes from a browse rather than from the viewer's listing. */
export function isThreadBrowseActive(filter: ThreadBrowseFilter): boolean {
  return filter.ownerUserId !== null || filter.tag !== null;
}

/** Whether anything is narrowed at all — what the trigger's dot reports. */
export function isThreadFilterActive(filter: ThreadBrowseFilter): boolean {
  return isThreadBrowseActive(filter) || filter.includeClosed;
}

/**
 * The rows a sidebar shows: a browse in place of the listing, or the listing
 * with the closed half of it appended.
 *
 * `archived` is empty unless "include closed" is on, so it needs no flag of its
 * own. It is deduplicated against `listed` because the adoption graft can put a
 * closed thread in the listing — the one the viewer is reading right now.
 */
export function composeSidebarThreadList<
  T extends { readonly environmentId: string; readonly id: string },
>(options: {
  readonly listed: ReadonlyArray<T>;
  readonly browsed: ReadonlyArray<T> | null;
  readonly archived: ReadonlyArray<T>;
}): ReadonlyArray<T> {
  if (options.browsed !== null) {
    return options.browsed;
  }
  if (options.archived.length === 0) {
    return options.listed;
  }
  const listedKeys = new Set(
    options.listed.map((thread) => `${thread.environmentId}:${thread.id}`),
  );
  return [
    ...options.listed,
    ...options.archived.filter((thread) => !listedKeys.has(`${thread.environmentId}:${thread.id}`)),
  ];
}

/**
 * The `threads.browse` payload, or null when the listing itself is the answer.
 *
 * Keys are written in a fixed order and an unset one is left out, because the
 * atom family keys on `JSON.stringify` of this object: a second spelling of the
 * same filter is a second subscription that polls the same rows.
 */
export function threadBrowseInput(filter: ThreadBrowseFilter): ThreadBrowseInput | null {
  if (!isThreadBrowseActive(filter)) {
    return null;
  }
  return {
    ...(filter.ownerUserId === null ? {} : { ownerUserId: filter.ownerUserId }),
    ...(filter.tag === null ? {} : { tag: filter.tag }),
    includeClosed: filter.includeClosed,
  };
}
