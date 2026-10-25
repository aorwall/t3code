/**
 * Fork-only. Which URL a framed preview is *loaded* with, as opposed to the tab's URL.
 * A host navigation changes the tab URL first and must replace the frame element. A guest-reported
 * route change happens after the fact; replacing the element then reloads the page and loses state.
 * So the element key follows the last host-requested URL; only a reload re-syncs the two.
 */

export interface HostedFrameLoad {
  /** The URL the frame element was created with, or null before it exists. */
  readonly url: string | null;
  /** The reload counter the element was created under. */
  readonly reloadNonce: number;
}

export interface HostedFrameTab {
  /** The tab's URL, wherever it came from. */
  readonly url: string | null;
  readonly reloadNonce: number;
  /** The last URL the guest reported over the inspector bridge, if any. */
  readonly reportedUrl: string | null;
}

export function initialHostedFrameLoad(tab: {
  readonly url: string | null;
  readonly reloadNonce: number;
}): HostedFrameLoad {
  return { url: tab.url, reloadNonce: tab.reloadNonce };
}

/**
 * The load the frame should be on, given the one it is on. Returns `loaded`
 * unchanged — same reference — when the element must not be replaced, so a
 * caller can use identity to decide whether anything happened.
 */
export function resolveHostedFrameLoad(
  loaded: HostedFrameLoad,
  tab: HostedFrameTab,
): HostedFrameLoad {
  // A reload is the one thing that always replaces the element, and it takes
  // the tab's URL with it: what the user asked to reload is what they see.
  if (tab.reloadNonce !== loaded.reloadNonce) {
    return { url: tab.url, reloadNonce: tab.reloadNonce };
  }
  if (tab.url === loaded.url) return loaded;
  // The guest moved itself here and said so. Following it would undo it.
  if (tab.url !== null && tab.url === tab.reportedUrl) return loaded;
  return { url: tab.url, reloadNonce: loaded.reloadNonce };
}
