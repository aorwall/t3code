"use client";

import { parseScopedThreadKey } from "@t3tools/client-runtime/environment";
import { useMemo } from "react";

import { previewRuntimeCapability, useActivePreviewSessions } from "~/previewStateStore";

import { HostedBrowserFrame } from "./HostedBrowserFrame";
import { previewRuntimeTabId } from "./previewRuntimeTabId";

/**
 * The browser counterpart of {@link ElectronBrowserHost}. Exactly one of the
 * two ever renders anything.
 *
 * It is mounted at the app root for the same reason that one is: a frame drawn
 * inside the panel would reload its page every time the panel collapses or the
 * route changes.
 */
export function WebBrowserHost() {
  const previewByThreadKey = useActivePreviewSessions();
  const sessions = useMemo(
    () =>
      Object.entries(previewByThreadKey).flatMap(([threadKey, previewState]) => {
        const threadRef = parseScopedThreadKey(threadKey);
        return threadRef
          ? Object.values(previewState.sessions).map((snapshot) => ({
              threadRef,
              snapshot,
              runtimeTabId: previewRuntimeTabId(
                threadRef,
                previewState.serverEpoch,
                snapshot.tabId,
              ),
            }))
          : [];
      }),
    [previewByThreadKey],
  );

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
