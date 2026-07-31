"use client";

/* eslint-disable react/iframe-missing-sandbox */
// The rule objects to `allow-scripts` together with `allow-same-origin`, which
// would be a hole if the frame were same-origin with this app: the page could
// reach out and remove its own sandbox. It is not — a preview server is always
// a different origin — so what the pair grants is the page access to its own
// origin, which is what its session cookie needs and what any app needs in
// order to work at all.

import { useShallow } from "zustand/react/shallow";

import { resolveBrowserSurfacePanelRect, useBrowserSurfaceStore } from "./browserSurfaceStore";
import { hostedFrameKey, useHostedFrameReloadStore } from "./hostedFrameReload";
import { resolveHostedBrowserWebviewWrapperStyle } from "./hostedBrowserWebviewStyle";

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
  readonly tabId: string;
  readonly runtimeTabId: string;
  readonly url: string | null;
}) {
  const { tabId, runtimeTabId, url } = props;
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

  const active = presentation.visible && presentation.rect !== null;
  const wrapperStyle = resolveHostedBrowserWebviewWrapperStyle({
    active,
    cornerRadius: presentation.cornerRadius,
    rect: presentation.rect,
    hiddenSize: {
      width: presentation.rect?.width ?? 1280,
      height: presentation.rect?.height ?? 800,
    },
  });

  return (
    <div
      className="fixed overflow-hidden bg-muted/35"
      style={wrapperStyle}
      data-preview-viewport={runtimeTabId}
    >
      {url === null ? null : (
        // The key, not `src`, is what navigates. Assigning `src` on a live
        // frame pushes an entry onto the parent document's history, so every
        // navigation and every reload replaces the element instead.
        <iframe
          key={hostedFrameKey(url, reloadNonce)}
          src={url}
          title="Preview"
          sandbox="allow-scripts allow-forms allow-same-origin allow-popups"
          referrerPolicy="no-referrer"
          data-preview-tab={runtimeTabId}
          data-preview-server-tab={tabId}
          aria-hidden={active ? undefined : true}
          className="h-full w-full border-0 bg-background"
        />
      )}
    </div>
  );
}
