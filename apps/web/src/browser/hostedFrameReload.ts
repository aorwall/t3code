import { create } from "zustand";

/**
 * Reload counters for framed browser tabs.
 * A cross-origin <iframe> cannot be told to reload, and reassigning `src` pushes parent history,
 * so the only way is replacing the element via its React key. The counter lives here because the
 * frame is mounted at the app root and shares nothing else with the panel.
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
 * The identity of a framed page, as React sees it. Both inputs are required: the URL, because
 * reassigning `src` would push a parent history entry; the counter, because a reload of the same
 * URL must still replace the element.
 */
export function hostedFrameKey(url: string, reloadNonce: number): string {
  return `${url}#${reloadNonce}`;
}
