/**
 * Fork-only. Which URL a framed preview is *loaded* with, as opposed to which
 * URL the tab is at.
 *
 * The two are usually the same, and the tab's URL is the one everything else
 * reads — the address bar, the tab title, the recently-seen list. But they get
 * there by two different routes, and only one of them is an instruction.
 *
 * When the host navigates — an address typed, a link opened from the editor, a
 * discovered server picked — the tab's URL changes *first* and the frame has to
 * follow. A cross-origin frame cannot be sent anywhere except by replacing the
 * element, so the element's key has to change, and the page loads from scratch.
 *
 * When the guest reports a route change over the inspector bridge, the frame is
 * already there: the page navigated itself and is telling the host where it
 * landed. The tab's URL changes *after* the fact. Replacing the element then
 * reloads the page the app just routed to — losing its state, its sockets and
 * every client-side transition after it — to arrive somewhere it already was.
 * From the outside that reads as "the preview reloads on every navigation".
 *
 * So the element's identity follows the last URL the host asked for, and a
 * guest report is allowed to move the tab without moving the frame. A reload
 * re-syncs the two, because reloading means "load what I am looking at now".
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
