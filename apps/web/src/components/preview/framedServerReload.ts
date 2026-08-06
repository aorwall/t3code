"use client";

import type { ThreadServer } from "@t3tools/contracts";
import { useEffect } from "react";

import { reloadHostedFrame } from "~/browser/hostedFrameReload";

/**
 * Fork-only. Replacing a framed page once the server behind it starts serving.
 *
 * A frame pointed at a server that is still coming up loads the proxy's error
 * page, and nothing about the server starting later replaces it: the status
 * overlay goes away, the dead page underneath does not. The desktop app has no
 * equivalent — a webview reports its own failures and reloads itself.
 *
 * Moatless's own panel avoids this by not mounting the iframe at all until the
 * server reports `started`, so the element's first load is always of a page
 * that is being served. A frame here cannot be gated that way: it is mounted at
 * the app root to survive the panel, so the fix is to replace it on the
 * transition instead.
 */

/**
 * Which tabs hold a page loaded while its server was not serving.
 *
 * Module state rather than panel state on purpose. The preview panel unmounts
 * whenever the right panel switches to Files or a terminal, and a verdict kept
 * inside it would be forgotten exactly when someone leaves the panel to wait
 * for a slow server — the case this exists for.
 */
const loadedBeforeServing = new Set<string>();

export interface FramedServerReloadVerdict {
  /** Replace the frame element now. */
  readonly reload: boolean;
  /** What to remember about this tab until the next status arrives. */
  readonly loadedBeforeServing: boolean;
}

/**
 * What a newly reported server status means for the page already in the frame.
 *
 * A `null` status is not an observation — it is a tab on no declared server's
 * origin, or a thread with no server list yet — so it decides nothing and
 * leaves what is remembered alone.
 */
export function nextFramedServerReload(
  wasLoadedBeforeServing: boolean,
  status: ThreadServer["status"] | null,
): FramedServerReloadVerdict {
  if (status === null) return { reload: false, loadedBeforeServing: wasLoadedBeforeServing };
  if (status !== "started") return { reload: false, loadedBeforeServing: true };
  return { reload: wasLoadedBeforeServing, loadedBeforeServing: false };
}

/**
 * Reload the framed tab when its server finishes starting.
 *
 * Pass a null tab id on the desktop app: a webview needs none of this.
 */
export function useFramedServerReload(
  runtimeTabId: string | null,
  status: ThreadServer["status"] | null,
): void {
  useEffect(() => {
    if (runtimeTabId === null) return;
    const verdict = nextFramedServerReload(loadedBeforeServing.has(runtimeTabId), status);
    if (verdict.loadedBeforeServing) loadedBeforeServing.add(runtimeTabId);
    else loadedBeforeServing.delete(runtimeTabId);
    if (verdict.reload) reloadHostedFrame(runtimeTabId);
  }, [runtimeTabId, status]);
}
