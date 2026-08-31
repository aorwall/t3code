"use client";

/* eslint-disable react/iframe-missing-sandbox */
// The rule objects to `allow-scripts` together with `allow-same-origin`, which
// would be a hole if the frame were same-origin with this app: the page could
// reach out and remove its own sandbox. It is not — a preview server is always
// a different origin — so what the pair grants is the page access to its own
// origin, which is what its session cookie needs and what any app needs in
// order to work at all.

import { useShallow } from "zustand/react/shallow";
import type { ScopedThreadRef } from "@t3tools/contracts";
import { useCallback, useEffect, useRef, useState } from "react";

import { resolveBrowserSurfacePanelRect, useBrowserSurfaceStore } from "./browserSurfaceStore";
import {
  type FramePreviewInspectorRouteChange,
  pingFramePreviewAnnotationHost,
  registerFramePreviewAnnotationHost,
  resolveFramePreviewAnnotationOrigin,
} from "./framePreviewAnnotationBridge";
import { initialHostedFrameLoad, resolveHostedFrameLoad } from "./hostedFrameLoad";
import { hostedFrameKey, useHostedFrameReloadStore } from "./hostedFrameReload";
import { resolveHostedBrowserWebviewWrapperStyle } from "./hostedBrowserWebviewStyle";
import {
  readThreadPreviewState,
  rememberPreviewUrl,
  updatePreviewServerSnapshot,
} from "~/previewStateStore";

/**
 * The page surface in a browser: one cross-origin <iframe>, positioned into the
 * rectangle the panel publishes.
 *
 * It mirrors {@link HostedBrowserWebview}'s placement and nothing else. A frame
 * reports no navigation, has no readable history, and cannot say whether what
 * it shows is the page or the host's error body — so this component drives the
 * page and never reads it.
 */
export function HostedBrowserFrame(props: {
  readonly threadRef: ScopedThreadRef;
  readonly tabId: string;
  readonly runtimeTabId: string;
  readonly url: string | null;
}) {
  const { threadRef, tabId, runtimeTabId, url } = props;
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const presentation = useBrowserSurfaceStore(
    useShallow((state) => {
      const current = state.byTabId[runtimeTabId];
      return {
        cornerRadius: current?.cornerRadius ?? 0,
        rect: resolveBrowserSurfacePanelRect(state.byTabId, runtimeTabId),
        visible: current?.visible ?? false,
      };
    }),
  );
  const reloadNonce = useHostedFrameReloadStore((state) => state.byTabId[runtimeTabId] ?? 0);

  // `url` is where the tab is; `loaded` is what the frame element was built
  // from. They part company whenever the page routes itself — see
  // `hostedFrameLoad`. Adjusted during render rather than in an effect because
  // an effect would run after the frame had already been replaced once.
  const reportedUrlRef = useRef<string | null>(null);
  const [loaded, setLoaded] = useState(() => initialHostedFrameLoad({ url, reloadNonce }));
  const nextLoad = resolveHostedFrameLoad(loaded, {
    url,
    reloadNonce,
    reportedUrl: reportedUrlRef.current,
  });
  if (nextLoad !== loaded) setLoaded(nextLoad);
  const loadedUrl = nextLoad.url;

  const active = presentation.visible && presentation.rect !== null;
  const wrapperStyle = resolveHostedBrowserWebviewWrapperStyle({
    active,
    // Upstream suspends a parked webview unless something — background audio,
    // picture-in-picture, a recording — still needs it painted. A frame has
    // none of those to read, and it is the app's only copy of the preview page:
    // parking it is how it survives a route change, so it stays rendered.
    renderingActive: true,
    cornerRadius: presentation.cornerRadius,
    rect: presentation.rect,
    hiddenSize: {
      width: presentation.rect?.width ?? 1280,
      height: presentation.rect?.height ?? 800,
    },
  });

  const handleInspectorRouteChange = useCallback(
    (change: FramePreviewInspectorRouteChange) => {
      const snapshot = readThreadPreviewState(threadRef).sessions[tabId];
      if (!snapshot || snapshot.navStatus._tag === "Idle") return;
      const title = change.title ?? snapshot.navStatus.title;
      if (
        snapshot.navStatus.url === change.url &&
        snapshot.navStatus.title === title &&
        snapshot.canGoBack === change.canGoBack &&
        snapshot.canGoForward === change.canGoForward
      ) {
        return;
      }
      // Recorded before the write that re-renders this component, so the render
      // it triggers can tell this URL apart from one the host navigated to.
      reportedUrlRef.current = change.url;
      updatePreviewServerSnapshot(threadRef, {
        ...snapshot,
        navStatus: {
          _tag: "Success",
          url: change.url,
          title,
        },
        canGoBack: change.canGoBack,
        canGoForward: change.canGoForward,
        updatedAt: new Date().toISOString(),
      });
      rememberPreviewUrl(threadRef, change.url);
    },
    [tabId, threadRef],
  );

  // Held in a ref so that registration below does not depend on this
  // callback's identity. `threadRef` is minted fresh by `WebBrowserHost` every
  // time any thread's preview state changes, so the callback is new on most
  // renders — and re-registering starts over from "the guest has not announced
  // itself", which is what disables the annotate button.
  const routeChangeRef = useRef(handleInspectorRouteChange);
  useEffect(() => {
    routeChangeRef.current = handleInspectorRouteChange;
  }, [handleInspectorRouteChange]);

  // Keyed off the load rather than the tab's URL: a guest route change leaves
  // the element — and so the window the bridge holds — exactly where it was.
  useEffect(() => {
    if (!loadedUrl) return;
    const frameWindow = iframeRef.current?.contentWindow;
    if (!frameWindow) return;
    return registerFramePreviewAnnotationHost({
      runtimeTabId,
      frameWindow,
      targetOrigin: resolveFramePreviewAnnotationOrigin(loadedUrl),
      url: loadedUrl,
      onInspectorRouteChange: (change) => routeChangeRef.current(change),
    });
  }, [runtimeTabId, nextLoad.reloadNonce, loadedUrl]);

  return (
    <div
      className="fixed overflow-hidden bg-muted/35"
      style={wrapperStyle}
      data-preview-viewport={runtimeTabId}
    >
      {loadedUrl === null ? null : (
        // The key, not `src`, is what navigates. Assigning `src` on a live
        // frame pushes an entry onto the parent document's history, so every
        // navigation and every reload replaces the element instead.
        <iframe
          key={hostedFrameKey(loadedUrl, nextLoad.reloadNonce)}
          ref={iframeRef}
          src={loadedUrl}
          title="Preview"
          sandbox="allow-scripts allow-forms allow-same-origin allow-popups"
          referrerPolicy="no-referrer"
          onLoad={() => pingFramePreviewAnnotationHost(runtimeTabId)}
          data-preview-tab={runtimeTabId}
          data-preview-server-tab={tabId}
          aria-hidden={active ? undefined : true}
          className="h-full w-full border-0 bg-background"
        />
      )}
    </div>
  );
}
