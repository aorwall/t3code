"use client";

import type { ScopedThreadRef, ThreadServer } from "@t3tools/contracts";

import { useThreadPreviewServers } from "./useThreadPreviewServers";

function sameOrigin(left: string, right: string): boolean {
  try {
    return new URL(left).origin === new URL(right).origin;
  } catch {
    return false;
  }
}

/**
 * The server a framed page is being served by, if the thread declares one.
 *
 * A cross-origin frame reports nothing — `onload` fires for the host's error
 * page as readily as for the real one — so the only thing the panel can say
 * about a blank frame is what the server says about itself. Matching is by
 * origin because a tab can be navigated anywhere within a server's site, and
 * a URL on no declared server's origin (someone typed one in) matches nothing
 * and is left alone.
 */
export function useFramedServerStatus(
  threadRef: ScopedThreadRef | null,
  url: string,
): ThreadServer | null {
  const { servers } = useThreadPreviewServers(threadRef);
  if (url === "") return null;
  return servers.find((server) => server.url !== null && sameOrigin(server.url, url)) ?? null;
}
