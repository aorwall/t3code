"use client";

import { parseScopedThreadKey } from "@t3tools/client-runtime/environment";

import { previewRuntimeCapability, useActivePreviewSessions } from "~/previewStateStore";

import { HostedBrowserFrame } from "./HostedBrowserFrame";
import { previewRuntimeTabId } from "./previewRuntimeTabId";

/**
 * The browser counterpart of {@link ElectronBrowserHost}; exactly one of the two renders.
 * Mounted at the app root so a frame does not reload when the panel collapses or the route changes.
 */
export function WebBrowserHost() {
  const previewByThreadKey = useActivePreviewSessions();
  const sessions = Object.entries(previewByThreadKey).flatMap(([threadKey, previewState]) => {
    const threadRef = parseScopedThreadKey(threadKey);
    return threadRef
      ? Object.values(previewState.sessions).map((snapshot) => ({
          threadRef,
          snapshot,
          runtimeTabId: previewRuntimeTabId(threadRef, previewState.serverEpoch, snapshot.tabId),
        }))
      : [];
  });

  if (previewRuntimeCapability() !== "frame") return null;
  return (
    <div className="contents" data-web-browser-host>
      {sessions.map(({ threadRef, snapshot, runtimeTabId }) => (
        <HostedBrowserFrame
          key={runtimeTabId}
          threadRef={threadRef}
          tabId={snapshot.tabId}
          runtimeTabId={runtimeTabId}
          url={snapshot.navStatus._tag === "Idle" ? null : snapshot.navStatus.url}
        />
      ))}
    </div>
  );
}
