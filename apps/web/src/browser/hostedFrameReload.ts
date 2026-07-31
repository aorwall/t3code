import { create } from "zustand";

/**
 * Reload counters for framed browser tabs.
 *
 * A cross-origin <iframe> cannot be told to reload — there is no API for it and
 * reassigning `src` would push an entry onto the parent's history. The only way
 * is to replace the element, which React does when its key changes. The counter
 * lives here rather than in the panel because the frame is mounted at the app
 * root, so the two components share nothing else.
 */
interface HostedFrameReloadState {
  readonly byTabId: Readonly<Record<string, number>>;
  readonly reload: (runtimeTabId: string) => void;
  readonly forget: (runtimeTabId: string) => void;
}

export const useHostedFrameReloadStore = create<HostedFrameReloadState>((set) => ({
  byTabId: {},
  reload: (runtimeTabId) =>
    set((state) => ({
      byTabId: { ...state.byTabId, [runtimeTabId]: (state.byTabId[runtimeTabId] ?? 0) + 1 },
    })),
  forget: (runtimeTabId) =>
    set((state) => {
      if (!(runtimeTabId in state.byTabId)) return state;
      const { [runtimeTabId]: _dropped, ...rest } = state.byTabId;
      return { byTabId: rest };
    }),
}));

export function reloadHostedFrame(runtimeTabId: string): void {
  useHostedFrameReloadStore.getState().reload(runtimeTabId);
}

/**
 * The identity of a framed page, as React sees it.
 *
 * Both inputs have to be in it. The URL, because navigating by reassigning
 * `src` would push an entry onto the parent's history; the counter, because
 * reloading the same URL has to replace the element and nothing about the URL
 * would have changed.
 */
export function hostedFrameKey(url: string, reloadNonce: number): string {
  return `${url}#${reloadNonce}`;
}
