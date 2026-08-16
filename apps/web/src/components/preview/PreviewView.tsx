"use client";

import { scopedThreadKey } from "@t3tools/client-runtime/environment";
import { squashAtomCommandFailure } from "@t3tools/client-runtime/state/runtime";
import {
  FILL_PREVIEW_VIEWPORT,
  type PreviewAnnotationPayload,
  type PreviewViewportSetting,
  type ScopedThreadRef,
} from "@t3tools/contracts";
import { normalizePreviewUrl } from "@t3tools/shared/preview";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  BROWSER_HISTORY_MAX_ENTRIES_PER_PROJECT,
  recordVisitForThread,
  removeUrlForThread,
  setTitleForThreadUrl,
  useThreadRecentHistory,
} from "~/browserHistoryStore";
import { type ComposerImageAttachment, useComposerDraftStore } from "~/composerDraftStore";
import { previewAnnotationScreenshotFile } from "~/lib/previewAnnotation";
import { ensureLocalApi } from "~/localApi";
import {
  previewRuntimeCapability,
  rememberPreviewUrl,
  updatePreviewServerSnapshot,
  useThreadPreviewState,
} from "~/previewStateStore";
import { resolveDiscoveredServerUrl } from "~/browser/browserTargetResolver";
import { useEnvironmentHttpBaseUrl } from "~/state/environments";
import { previewEnvironment } from "~/state/preview";
import { useAtomCommand } from "~/state/use-atom-command";
import { selectThreadPreviewMiniPlayer, usePreviewMiniPlayerStore } from "~/previewMiniPlayerStore";
import { useRightPanelStore } from "~/rightPanelStore";

import { previewBridge } from "./previewBridge";
import { subscribePreviewAction } from "./previewActionBus";
import { openPreviewSession } from "./openPreviewSession";
import { PreviewChromeRow } from "./PreviewChromeRow";
import { PreviewEmptyState } from "./PreviewEmptyState";
import { PreviewMoreMenu } from "./PreviewMoreMenu";
// Fork: the framed surface's own three-dot menu.
import { PreviewFrameMoreMenu } from "./PreviewFrameMoreMenu";
import {
  commitBrowserViewportChange,
  subscribeBrowserViewportChange,
} from "~/browser/browserViewportActions";
import { resolveResponsiveBrowserViewportSize } from "~/browser/browserViewportLayout";
import {
  cancelFramePreviewAnnotationPick,
  navigateFramePreviewInspectorHistory,
  pickFramePreviewAnnotationElement,
  useFramePreviewAnnotationReady,
  useFramePreviewInspectorNavigationState,
} from "~/browser/framePreviewAnnotationBridge";
import { previewRuntimeTabId } from "~/browser/previewRuntimeTabId";
import { reloadHostedFrame } from "~/browser/hostedFrameReload";
import { readPreviewAnnotationTheme } from "~/browser/annotationTheme";
import { PreviewUnreachable } from "./PreviewUnreachable";
import { PreviewFrameUnrendered, useFrameUnrenderedHint } from "./PreviewFrameUnrendered";
import { PreviewServerNotStarted } from "./PreviewServerNotStarted";
import { useFramedServerReload } from "./framedServerReload";
import { useFramedServerStatus } from "./useFramedServerStatus";
import { revealInFileExplorerLabel } from "./fileExplorerLabel";
import { shouldShowPreviewEmptyState } from "./previewEmptyStateLogic";
import { BrowserSurfaceSlot } from "~/browser/BrowserSurfaceSlot";
import { useBrowserSurfaceStore } from "~/browser/browserSurfaceStore";
import { useLoadingProgress } from "./useLoadingProgress";
import { usePreviewSession } from "./usePreviewSession";
import { ZoomIndicator } from "./ZoomIndicator";
import { AgentBrowserCursor } from "./AgentBrowserCursor";
import {
  findActiveBrowserRecordingRuntimeTabId,
  startBrowserRecording,
  stopBrowserRecording,
  useActiveBrowserRecordingTabIds,
} from "~/browser/browserRecording";
import { stackedThreadToast, toastManager } from "~/components/ui/toast";

interface Props {
  threadRef: ScopedThreadRef;
  tabId?: string | null;
  visible: boolean;
  onSendAnnotation?: (
    annotation: PreviewAnnotationPayload,
    image: ComposerImageAttachment | null,
  ) => void;
}

const localApi = typeof window === "undefined" ? null : ensureLocalApi();

/**
 * Single-tab preview surface: chrome row on top, one webview below, empty
 * state when no session exists for the thread.
 */
export function PreviewView({
  threadRef,
  tabId: requestedTabId,
  visible,
  onSendAnnotation,
}: Props) {
  const [focusUrlNonce, setFocusUrlNonce] = useState<number | undefined>(undefined);
  const [pickActive, setPickActive] = useState(false);
  const activeRecordingTabIds = useActiveBrowserRecordingTabIds();
  const pickActiveRef = useRef(false);
  const isMountedRef = useRef(true);
  // Kept in sync so the title effect can depend on the stable thread key
  // instead of the thread object, which is recreated on every update.
  const threadRefRef = useRef(threadRef);
  threadRefRef.current = threadRef;
  const previewState = useThreadPreviewState(threadRef);
  const recentHistoryEntries = useThreadRecentHistory(
    threadRef,
    BROWSER_HISTORY_MAX_ENTRIES_PER_PROJECT,
  );
  const miniPlayer = usePreviewMiniPlayerStore((state) =>
    selectThreadPreviewMiniPlayer(state.byThreadKey, threadRef),
  );
  const addPreviewAnnotation = useComposerDraftStore((store) => store.addPreviewAnnotation);
  const addImage = useComposerDraftStore((store) => store.addImage);
  const environmentHttpBaseUrl = useEnvironmentHttpBaseUrl(threadRef.environmentId);
  const environmentHostname = environmentHttpBaseUrl
    ? new URL(environmentHttpBaseUrl).hostname
    : null;
  const open = useAtomCommand(previewEnvironment.open);
  const navigate = useAtomCommand(previewEnvironment.navigate, "preview navigate");
  const resize = useAtomCommand(previewEnvironment.resize, "preview viewport resize");
  // A frame is driven, never read: it cannot report where it went, so the
  // server's record of the tab is the only account of it there is.
  const framed = previewRuntimeCapability() === "frame";

  usePreviewSession(threadRef);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const tabId = requestedTabId ?? previewState.activeTabId;
  const runtimeTabId = tabId
    ? previewRuntimeTabId(threadRef, previewState.serverEpoch, tabId)
    : null;
  // Fork: what the framed surface knows about its guest — whether the
  // annotation runtime announced itself, and the history it reports back.
  const frameAnnotationReady = useFramePreviewAnnotationReady(framed ? runtimeTabId : null);
  const frameNavigation = useFramePreviewInspectorNavigationState(framed ? runtimeTabId : null);
  const recordingRuntimeTabId =
    tabId && runtimeTabId
      ? activeRecordingTabIds.has(runtimeTabId)
        ? runtimeTabId
        : findActiveBrowserRecordingRuntimeTabId(threadRef, tabId)
      : null;
  const snapshot = tabId ? (previewState.sessions[tabId] ?? null) : null;
  const desktopOverlay = tabId ? (previewState.desktopByTabId[tabId] ?? null) : null;
  const navStatus = snapshot?.navStatus ?? { _tag: "Idle" as const };
  const url = navStatus._tag === "Idle" ? "" : navStatus.url;
  const loading = desktopOverlay?.loading ?? navStatus._tag === "Loading";
  // Fork: a frame reports no history of its own, so in that surface the guest
  // runtime is the only thing that can say whether back and forward go anywhere.
  const canGoBack = framed
    ? frameNavigation.canGoBack
    : (desktopOverlay?.canGoBack ?? snapshot?.canGoBack ?? false);
  const canGoForward = framed
    ? frameNavigation.canGoForward
    : (desktopOverlay?.canGoForward ?? snapshot?.canGoForward ?? false);
  const refreshDisabled = navStatus._tag === "Idle";
  const isUnreachable = navStatus._tag === "LoadFailed";
  const showEmptyState = shouldShowPreviewEmptyState(snapshot);
  const controller = desktopOverlay?.controller ?? "none";
  const loadProgress = useLoadingProgress(loading);
  const viewport = snapshot?.viewport ?? FILL_PREVIEW_VIEWPORT;
  const panelRect = useBrowserSurfaceStore((state) =>
    runtimeTabId ? (state.byTabId[runtimeTabId]?.rect ?? null) : null,
  );
  // What a frame cannot say about itself, its server can. Nothing consults
  // this on the desktop app, where the page reports its own failures.
  const framedServer = useFramedServerStatus(framed ? threadRef : null, url);
  // Fork: a frame that loaded before its server was serving keeps the dead page
  // after the status overlay clears, so it is replaced on the transition.
  useFramedServerReload(framed ? runtimeTabId : null, framedServer?.status ?? null);
  const frameHintElapsed = useFrameUnrenderedHint(
    framed ? url : "",
    framedServer?.status === "started",
  );
  const showFrameUnrenderedHint =
    framed && frameHintElapsed && !showEmptyState && framedServer?.status === "started";

  const navUrl = navStatus._tag === "Success" ? navStatus.url : null;
  const navTitle = navStatus._tag === "Success" ? navStatus.title : null;
  const latestHistoryUrl = recentHistoryEntries[0]?.url;
  const threadKey = scopedThreadKey(threadRef);
  useEffect(() => {
    if (!navUrl || !navTitle || !latestHistoryUrl) return;
    // Agent-driven pages only enrich an existing requested URL.
    setTitleForThreadUrl(threadRefRef.current, navUrl, navTitle, environmentHostname);
    // threadKey stands in for threadRef, whose identity churns on every thread update.
  }, [environmentHostname, latestHistoryUrl, navTitle, navUrl, threadKey]);

  const navigateToResolvedUrl = useCallback(
    async (resolvedUrl: string) => {
      if (runtimeTabId && previewBridge) {
        // The bridge mirrors the resolved URL back to the server.
        await previewBridge.navigate(runtimeTabId, resolvedUrl);
        rememberPreviewUrl(threadRef, resolvedUrl);
        return true;
      }
      // Fork: a framed preview follows the server's record, so navigation is a
      // write to it. Every client on the thread sees it, including this one.
      if (framed && tabId) {
        const result = await navigate({
          environmentId: threadRef.environmentId,
          input: { threadId: threadRef.threadId, tabId, url: resolvedUrl },
        });
        if (result._tag === "Failure") throw squashAtomCommandFailure(result);
        updatePreviewServerSnapshot(threadRef, result.value);
        rememberPreviewUrl(threadRef, resolvedUrl);
        return true;
      }
      const result = await openPreviewSession({ openPreview: open, threadRef, url: resolvedUrl });
      return result._tag === "Success";
    },
    [framed, navigate, open, runtimeTabId, tabId, threadRef],
  );

  const handleSubmitUrl = useCallback(
    async (next: string) => {
      try {
        const normalized = normalizePreviewUrl(next);
        if (await navigateToResolvedUrl(normalized)) {
          recordVisitForThread(threadRef, normalized);
        }
      } catch {
        // Server-side `failed` event renders the unreachable view.
      }
    },
    [navigateToResolvedUrl, threadRef],
  );

  const handleOpenServerUrl = useCallback(
    async (next: string) => {
      try {
        const resolved = resolveDiscoveredServerUrl(threadRef.environmentId, next);
        if (await navigateToResolvedUrl(resolved)) {
          recordVisitForThread(threadRef, next);
        }
      } catch {
        // Server-side `failed` event renders the unreachable view.
      }
    },
    [navigateToResolvedUrl, threadRef],
  );

  const handleRefresh = useCallback(() => {
    if (previewBridge && runtimeTabId) {
      void previewBridge.refresh(runtimeTabId);
      return;
    }
    // Replacing the element is the only way to reload a cross-origin frame,
    // and `preview.refresh` moves no server state, so nothing is sent.
    if (framed && runtimeTabId) reloadHostedFrame(runtimeTabId);
  }, [framed, runtimeTabId]);

  const handleZoomIn = useCallback(() => {
    if (previewBridge && runtimeTabId) void previewBridge.zoomIn(runtimeTabId);
  }, [runtimeTabId]);

  const handleZoomOut = useCallback(() => {
    if (previewBridge && runtimeTabId) void previewBridge.zoomOut(runtimeTabId);
  }, [runtimeTabId]);

  const handleResetZoom = useCallback(() => {
    if (previewBridge && runtimeTabId) void previewBridge.resetZoom(runtimeTabId);
  }, [runtimeTabId]);

  const handleViewportChange = useCallback(
    async (nextViewport: PreviewViewportSetting) => {
      if (!tabId) return;
      const result = await resize({
        environmentId: threadRef.environmentId,
        input: {
          threadId: threadRef.threadId,
          tabId,
          viewport: nextViewport,
        },
      });
      if (result._tag === "Failure") {
        const error = squashAtomCommandFailure(result);
        toastManager.add({
          type: "error",
          title: "Unable to resize browser viewport",
          description: error instanceof Error ? error.message : "An error occurred.",
        });
        throw error;
      }
      updatePreviewServerSnapshot(threadRef, result.value);
    },
    [resize, tabId, threadRef],
  );

  const handleToggleDeviceToolbar = () => {
    if (!runtimeTabId) return;
    if (viewport._tag !== "fill") {
      void commitBrowserViewportChange(runtimeTabId, FILL_PREVIEW_VIEWPORT).catch(() => undefined);
      return;
    }

    const responsiveSize = panelRect
      ? resolveResponsiveBrowserViewportSize(panelRect, desktopOverlay?.zoomFactor)
      : { width: 1024, height: 768 };
    void commitBrowserViewportChange(runtimeTabId, { _tag: "freeform", ...responsiveSize }).catch(
      () => undefined,
    );
  };

  useEffect(() => {
    if (!runtimeTabId) return;
    return subscribeBrowserViewportChange(runtimeTabId, handleViewportChange);
  }, [handleViewportChange, runtimeTabId]);

  const handleBack = useCallback(() => {
    if (previewBridge && runtimeTabId) void previewBridge.goBack(runtimeTabId);
  }, [runtimeTabId]);

  const handleForward = useCallback(() => {
    if (previewBridge && runtimeTabId) void previewBridge.goForward(runtimeTabId);
  }, [runtimeTabId]);

  // Fork: the framed twins of handleBack/handleForward above. History lives in
  // the guest, so these ask it to walk rather than driving a webview.
  const handleFrameBack = useCallback(() => {
    if (runtimeTabId) navigateFramePreviewInspectorHistory(runtimeTabId, "back");
  }, [runtimeTabId]);

  const handleFrameForward = useCallback(() => {
    if (runtimeTabId) navigateFramePreviewInspectorHistory(runtimeTabId, "forward");
  }, [runtimeTabId]);

  const handleOpenInBrowser = useCallback(() => {
    if (!url) return;
    // Already in a browser: the OS shell is neither reachable nor wanted.
    if (framed) {
      window.open(url, "_blank", "noopener");
      return;
    }
    if (!localApi) return;
    void localApi.shell.openExternal(url).catch(() => undefined);
  }, [framed, url]);

  const handlePictureInPicture = useCallback(() => {
    if (!tabId) return;
    if (miniPlayer?.tabId === tabId) {
      usePreviewMiniPlayerStore.getState().close(threadRef);
      return;
    }
    usePreviewMiniPlayerStore.getState().open(threadRef, tabId);
    useRightPanelStore.getState().close(threadRef);
  }, [miniPlayer?.tabId, tabId, threadRef]);

  const handleNativePictureInPicture = useCallback(() => {
    if (!previewBridge || !runtimeTabId) return;
    const operation = desktopOverlay?.pictureInPicture
      ? previewBridge.pictureInPicture.close
      : previewBridge.pictureInPicture.open;
    void operation(runtimeTabId).catch((error) => {
      toastManager.add({
        type: "error",
        title: "Unable to update popped-out preview",
        description: error instanceof Error ? error.message : "An error occurred.",
      });
    });
  }, [desktopOverlay?.pictureInPicture, runtimeTabId]);

  const handleCapture = useCallback(
    (record: boolean) => {
      if (!previewBridge || !runtimeTabId || !tabId) return;
      const bridge = previewBridge;
      if (recordingRuntimeTabId) {
        void stopBrowserRecording(recordingRuntimeTabId).then(
          (artifact) => {
            if (!artifact) return;
            let pathCopied = false;
            let toastId: ReturnType<typeof toastManager.add>;

            const copyPath = () => {
              if (!navigator.clipboard?.writeText) {
                toastManager.update(
                  toastId,
                  stackedThreadToast({
                    type: "error",
                    title: "Unable to copy recording path",
                    description: "Clipboard API unavailable.",
                    actionProps: revealAction,
                  }),
                );
                return;
              }

              void navigator.clipboard.writeText(artifact.path).then(
                () => {
                  pathCopied = true;
                  updateRecordingToast();
                  window.setTimeout(() => {
                    pathCopied = false;
                    updateRecordingToast();
                  }, 2_000);
                },
                (error) => {
                  toastManager.update(
                    toastId,
                    stackedThreadToast({
                      type: "error",
                      title: "Unable to copy recording path",
                      description: error instanceof Error ? error.message : "An error occurred.",
                      actionProps: revealAction,
                    }),
                  );
                },
              );
            };

            const revealAction = {
              children: revealInFileExplorerLabel(navigator.platform),
              onClick: () => void bridge.revealArtifact(artifact.path),
            };
            const updateRecordingToast = () => {
              toastManager.update(
                toastId,
                stackedThreadToast({
                  type: "success",
                  title: "Recording saved",
                  actionProps: revealAction,
                  data: {
                    secondaryActionProps: {
                      children: pathCopied ? "Copied!" : "Copy path",
                      disabled: pathCopied,
                      onClick: copyPath,
                    },
                    secondaryActionVariant: "outline",
                  },
                }),
              );
            };

            toastId = toastManager.add(
              stackedThreadToast({
                type: "success",
                title: "Recording saved",
                actionProps: revealAction,
                data: {
                  secondaryActionProps: {
                    children: "Copy path",
                    onClick: copyPath,
                  },
                  secondaryActionVariant: "outline",
                },
              }),
            );
          },
          (error) => {
            toastManager.add({
              type: "error",
              title: "Unable to stop recording",
              description: error instanceof Error ? error.message : "An error occurred.",
            });
          },
        );
        return;
      }
      if (record) {
        void startBrowserRecording(runtimeTabId, threadRef, tabId).catch((error) => {
          toastManager.add({
            type: "error",
            title: "Unable to start recording",
            description: error instanceof Error ? error.message : "An error occurred.",
          });
        });
        return;
      }
      void bridge.captureScreenshot(runtimeTabId).then(
        (artifact) => {
          const revealAction = {
            children: revealInFileExplorerLabel(navigator.platform),
            onClick: () => void bridge.revealArtifact(artifact.path),
          };
          let pathCopied = false;
          let imageCopied = false;
          let toastId: ReturnType<typeof toastManager.add>;

          const updateScreenshotToast = (
            type: "success" | "error" = "success",
            title = "Screenshot saved",
            description?: string,
          ) => {
            toastManager.update(
              toastId,
              stackedThreadToast({
                type,
                title,
                description,
                actionProps: {
                  children: imageCopied ? "Copied!" : "Copy image",
                  disabled: imageCopied,
                  onClick: copyImage,
                },
                data: {
                  additionalActions: [
                    {
                      id: "copy-path",
                      props: {
                        children: pathCopied ? "Copied!" : "Copy path",
                        disabled: pathCopied,
                        onClick: copyPath,
                      },
                    },
                  ],
                  secondaryActionProps: {
                    ...revealAction,
                  },
                  secondaryActionVariant: "outline",
                },
              }),
            );
          };

          const copyPath = () => {
            if (!navigator.clipboard?.writeText) {
              updateScreenshotToast(
                "error",
                "Unable to copy screenshot path",
                "Clipboard API unavailable.",
              );
              return;
            }

            void navigator.clipboard.writeText(artifact.path).then(
              () => {
                pathCopied = true;
                updateScreenshotToast();
                window.setTimeout(() => {
                  pathCopied = false;
                  updateScreenshotToast();
                }, 2_000);
              },
              (error) => {
                updateScreenshotToast(
                  "error",
                  "Unable to copy screenshot path",
                  error instanceof Error ? error.message : "An error occurred.",
                );
              },
            );
          };

          const copyImage = () => {
            void bridge.copyArtifactToClipboard(artifact.path).then(
              () => {
                imageCopied = true;
                updateScreenshotToast();
                window.setTimeout(() => {
                  imageCopied = false;
                  updateScreenshotToast();
                }, 2_000);
              },
              (error) => {
                updateScreenshotToast(
                  "error",
                  "Unable to copy screenshot",
                  error instanceof Error ? error.message : "An error occurred.",
                );
              },
            );
          };

          toastId = toastManager.add(
            stackedThreadToast({
              type: "success",
              title: "Screenshot saved",
              actionProps: {
                children: "Copy image",
                onClick: copyImage,
              },
              data: {
                additionalActions: [
                  {
                    id: "copy-path",
                    props: {
                      children: "Copy path",
                      onClick: copyPath,
                    },
                  },
                ],
                secondaryActionProps: {
                  ...revealAction,
                },
                secondaryActionVariant: "outline",
              },
            }),
          );
        },
        (error) => {
          toastManager.add({
            type: "error",
            title: "Unable to capture screenshot",
            description: error instanceof Error ? error.message : "An error occurred.",
          });
        },
      );
    },
    [recordingRuntimeTabId, runtimeTabId, tabId, threadRef],
  );

  const handlePickElement = useCallback(() => {
    if (!previewBridge || !runtimeTabId) return;
    if (pickActiveRef.current) {
      void previewBridge.cancelPickElement(runtimeTabId).catch(() => undefined);
      return;
    }
    // Snapshot whatever the user was focused on (typically the chat
    // composer textarea or the chrome-row pick button) BEFORE main steals
    // focus into the guest webContents. We restore it when the pick
    // resolves so the user's typing context isn't lost — otherwise after
    // every pick they'd have to click back into the textarea.
    const previouslyFocused =
      typeof document !== "undefined" ? (document.activeElement as HTMLElement | null) : null;
    pickActiveRef.current = true;
    setPickActive(true);
    void (async () => {
      try {
        const result = await previewBridge.pickElement(runtimeTabId);
        if (!result) return;
        const { annotation, submission } = result;
        addPreviewAnnotation(threadRef, annotation);
        let screenshotFile: File | null = null;
        try {
          screenshotFile = await previewAnnotationScreenshotFile(annotation);
        } catch {
          // The structured annotation is still sendable when converting its
          // optional screenshot into a composer attachment fails.
        }
        const image =
          screenshotFile && annotation.screenshot
            ? ({
                type: "image",
                id: annotation.id,
                name: screenshotFile.name,
                mimeType: screenshotFile.type,
                sizeBytes: screenshotFile.size,
                previewUrl: annotation.screenshot.dataUrl,
                file: screenshotFile,
              } satisfies ComposerImageAttachment)
            : null;
        if (image) {
          addImage(threadRef, image);
        }
        if (submission === "send") {
          onSendAnnotation?.(annotation, image);
        }
      } catch {
        // Picker failed (e.g. webview navigated). Treat as silent cancel.
      } finally {
        pickActiveRef.current = false;
        // Avoid `setState on unmounted component` if the panel/thread closed
        // while the pick was in flight.
        if (isMountedRef.current) setPickActive(false);
        // Best-effort: restore focus to whatever the user had before the
        // pick stole it into the guest webContents. Skip if the previously-
        // focused element was unmounted or is no longer focusable.
        if (
          previouslyFocused &&
          previouslyFocused.isConnected &&
          typeof previouslyFocused.focus === "function"
        ) {
          try {
            previouslyFocused.focus({ preventScroll: true });
          } catch {
            // Some elements throw on .focus() (detached iframes, etc.).
          }
        }
      }
    })();
  }, [addImage, addPreviewAnnotation, onSendAnnotation, runtimeTabId, threadRef]);

  // Fork: the framed twin of handlePickElement above. Same composer flow at the
  // end of it; only the pipe to the guest differs — postMessage, not the bridge.
  const handleFramePickElement = useCallback(() => {
    if (!runtimeTabId) return;
    if (pickActiveRef.current) {
      cancelFramePreviewAnnotationPick(runtimeTabId);
      return;
    }
    const previouslyFocused =
      typeof document !== "undefined" ? (document.activeElement as HTMLElement | null) : null;
    pickActiveRef.current = true;
    setPickActive(true);
    void (async () => {
      try {
        const annotation = await pickFramePreviewAnnotationElement(
          runtimeTabId,
          readPreviewAnnotationTheme(),
        );
        if (!annotation) return;
        addPreviewAnnotation(threadRef, annotation);
        const screenshotFile = await previewAnnotationScreenshotFile(annotation);
        if (screenshotFile && annotation.screenshot) {
          addImage(threadRef, {
            type: "image",
            id: annotation.id,
            name: screenshotFile.name,
            mimeType: screenshotFile.type,
            sizeBytes: screenshotFile.size,
            previewUrl: annotation.screenshot.dataUrl,
            file: screenshotFile,
          });
        }
      } catch {
        // The hosted iframe picker is best-effort; a navigation or missing
        // runtime should behave like a silent cancel.
      } finally {
        pickActiveRef.current = false;
        if (isMountedRef.current) setPickActive(false);
        if (
          previouslyFocused &&
          previouslyFocused.isConnected &&
          typeof previouslyFocused.focus === "function"
        ) {
          try {
            previouslyFocused.focus({ preventScroll: true });
          } catch {
            // Some elements throw on .focus() (detached iframes, etc.).
          }
        }
      }
    })();
  }, [addImage, addPreviewAnnotation, runtimeTabId, threadRef]);

  // If the active tab changes mid-pick (close, thread switch, hot restart),
  // tell main to tear down the in-flight session AND reset our local toggle
  // state so the button doesn't get stuck pressed against a stale tab id.
  useEffect(() => {
    return () => {
      if (!pickActiveRef.current) return;
      pickActiveRef.current = false;
      if (previewBridge && runtimeTabId) {
        void previewBridge.cancelPickElement(runtimeTabId).catch(() => undefined);
        // Fork: the framed surface tears its pick down over postMessage.
      } else if (framed && runtimeTabId) {
        cancelFramePreviewAnnotationPick(runtimeTabId);
      }
      if (isMountedRef.current) setPickActive(false);
    };
  }, [framed, runtimeTabId]);

  // Subscribe only while visible; `toggle-panel` is owned by ChatView's
  // URL-aware handler regardless of whether the panel is currently mounted.
  useEffect(() => {
    if (!visible) return;
    return subscribePreviewAction((action) => {
      switch (action) {
        case "refresh":
          handleRefresh();
          return;
        case "focus-url":
          setFocusUrlNonce((value) => (value ?? 0) + 1);
          return;
        case "zoom-in":
          handleZoomIn();
          return;
        case "zoom-out":
          handleZoomOut();
          return;
        case "reset-zoom":
          handleResetZoom();
          return;
        case "toggle-panel":
          return;
      }
    });
  }, [handleRefresh, handleResetZoom, handleZoomIn, handleZoomOut, visible]);

  return (
    <div
      className="flex min-h-0 flex-1 flex-col bg-background"
      data-thread-key={scopedThreadKey(threadRef)}
    >
      <PreviewChromeRow
        url={url}
        loading={loading}
        loadProgress={loadProgress}
        canGoBack={canGoBack}
        canGoForward={canGoForward}
        refreshDisabled={refreshDisabled}
        focusUrlNonce={focusUrlNonce}
        // Fork: in a frame these controls answer to the guest runtime, and stay
        // absent rather than dead until it has announced itself.
        onBack={framed ? (frameNavigation.ready ? handleFrameBack : undefined) : handleBack}
        onForward={
          framed ? (frameNavigation.ready ? handleFrameForward : undefined) : handleForward
        }
        onRefresh={handleRefresh}
        onSubmit={(next) => void handleSubmitUrl(next)}
        onOpenInBrowser={tabId ? handleOpenInBrowser : undefined}
        onCapture={previewBridge && tabId ? handleCapture : undefined}
        captureDisabled={!desktopOverlay || isUnreachable}
        recording={recordingRuntimeTabId !== null}
        onPictureInPicture={tabId ? handlePictureInPicture : undefined}
        pictureInPicture={miniPlayer?.tabId === tabId}
        pictureInPictureDisabled={
          !tabId || isUnreachable || (!framed && !desktopOverlay?.hasWebContents)
        }
        // Fork: whichever surface is up answers pick; the frame's is gated on
        // the guest carrying the annotation runtime at all.
        onPickElement={
          previewBridge && tabId
            ? handlePickElement
            : framed && tabId
              ? handleFramePickElement
              : undefined
        }
        pickActive={pickActive}
        // Disable when there's no tab (nothing to pick on) OR the page
        // failed to load (a React overlay covers the webview, so the
        // user wouldn't be able to actually click anything underneath).
        pickDisabled={!tabId || isUnreachable || (framed && !frameAnnotationReady)}
        pickDisabledReason={
          isUnreachable
            ? "Page didn't load — pick unavailable until the page renders"
            : framed && !frameAnnotationReady
              ? "Preview inspector unavailable — add @moatless/inspector/preview-annotation to the app"
              : undefined
        }
        trailingActions={
          // Fork: a frame has no preview bridge, so upstream's menu is all
          // disabled items there. The framed surface gets its own two-item
          // menu instead — see PreviewFrameMoreMenu for why it is a sibling.
          framed ? (
            <PreviewFrameMoreMenu
              hardReloadDisabled={!(tabId && snapshot && !showEmptyState && !isUnreachable)}
              onHardReload={handleRefresh}
              deviceToolbarVisible={viewport._tag !== "fill"}
              onToggleDeviceToolbar={handleToggleDeviceToolbar}
            />
          ) : (
            <PreviewMoreMenu
              tabId={runtimeTabId}
              hasWebContents={desktopOverlay?.hasWebContents ?? false}
              zoomFactor={desktopOverlay?.zoomFactor ?? 1}
              colorScheme={desktopOverlay?.colorScheme ?? "system"}
              deviceToolbarVisible={viewport._tag !== "fill"}
              onToggleDeviceToolbar={handleToggleDeviceToolbar}
              nativePictureInPicture={desktopOverlay?.pictureInPicture ?? false}
              onNativePictureInPicture={handleNativePictureInPicture}
            />
          )
        }
      />

      <div className="relative min-h-0 flex-1 overflow-hidden">
        {runtimeTabId && snapshot && !showEmptyState ? (
          <BrowserSurfaceSlot
            key={runtimeTabId}
            tabId={runtimeTabId}
            visible={visible && !isUnreachable}
            className="absolute inset-0 h-full w-full"
          />
        ) : null}
        {showEmptyState ? (
          <PreviewEmptyState
            threadRef={threadRef}
            recentEntries={recentHistoryEntries}
            onRemoveRecent={(url) => removeUrlForThread(threadRef, url)}
            onOpenUrl={(next) => void handleOpenServerUrl(next)}
          />
        ) : null}
        {snapshot && desktopOverlay ? (
          <ZoomIndicator zoomFactor={desktopOverlay.zoomFactor} />
        ) : null}
        {runtimeTabId && desktopOverlay && !showEmptyState && !isUnreachable ? (
          <AgentBrowserCursor
            tabId={runtimeTabId}
            zoomFactor={desktopOverlay.zoomFactor}
            controller={controller}
          />
        ) : null}
        {controller !== "none" ? (
          <div className="pointer-events-none absolute left-3 top-3 z-40 rounded-full border border-border/70 bg-background/90 px-2.5 py-1 text-[11px] font-medium shadow-sm backdrop-blur">
            {controller === "agent" ? "Agent controlling browser" : "Human control"}
          </div>
        ) : null}
        {navStatus._tag === "LoadFailed" ? (
          <div className="absolute inset-0 z-10 bg-background">
            <PreviewUnreachable
              url={navStatus.url}
              code={navStatus.code}
              description={navStatus.description}
              onReload={handleRefresh}
            />
          </div>
        ) : null}
        {framedServer && framedServer.status !== "started" ? (
          <div className="absolute inset-0 z-10 bg-background">
            <PreviewServerNotStarted
              server={framedServer}
              onOpenInBrowser={tabId ? handleOpenInBrowser : undefined}
            />
          </div>
        ) : null}
        {showFrameUnrenderedHint ? (
          <PreviewFrameUnrendered onOpenInBrowser={handleOpenInBrowser} />
        ) : null}
      </div>
    </div>
  );
}
