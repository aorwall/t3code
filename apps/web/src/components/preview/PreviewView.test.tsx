import { EnvironmentId, ThreadId } from "@t3tools/contracts";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(async (_tabId: string, _url: string): Promise<void> => undefined),
  rememberPreviewUrl: vi.fn(),
  readPreparedConnection: vi.fn(() => ({ httpBaseUrl: "http://172.25.85.75:3773" })),
  submittedUrl: null as ((url: string) => void) | null,
  emptyStateUrl: null as ((url: string) => void) | null,
  togglePictureInPicture: null as (() => void) | null,
  toggleNativePictureInPicture: null as (() => void) | null,
  pictureInPicturePressed: false,
  miniPlayerTabId: null as string | null,
  openMiniPlayer: vi.fn(),
  closeMiniPlayer: vi.fn(),
  closeRightPanel: vi.fn(),
  openPictureInPicture: vi.fn(async (_tabId: string): Promise<void> => undefined),
  closePictureInPicture: vi.fn(async (_tabId: string): Promise<void> => undefined),
  pickElement: vi.fn(),
  previewAnnotationScreenshotFile: vi.fn(),
  addPreviewAnnotation: vi.fn(),
  addImage: vi.fn(),
  toggleAnnotation: null as (() => void) | null,
  pictureInPicture: false,
  showEmptyState: false,
  capability: "webview" as "webview" | "frame" | "none",
  previewBridge: null as unknown,
  reloadHostedFrame: vi.fn(),
  navigateCommand: vi.fn(async (_input: unknown) => ({
    _tag: "Success" as const,
    value: {
      threadId: "thread-1",
      tabId: "tab-1",
      navStatus: { _tag: "Success" as const, url: "http://example.com/", title: "" },
      canGoBack: false,
      canGoForward: false,
      updatedAt: "2026-07-31T00:00:00.000Z",
    },
  })),
  chromeBack: undefined as (() => void) | undefined,
  chromeForward: undefined as (() => void) | undefined,
  chromeRefresh: null as (() => void) | null,
  chromePick: null as (() => void) | null,
  chromePickDisabled: undefined as boolean | undefined,
  chromePickDisabledReason: undefined as string | undefined,
  frameAnnotationReady: false,
  frameNavigation: {
    ready: false,
    canGoBack: false,
    canGoForward: false,
  },
  navigateFramePreviewInspectorHistory: vi.fn(),
  pickFramePreviewAnnotationElement: vi.fn(async () => null),
  cancelFramePreviewAnnotationPick: vi.fn(),
  menuHardReload: null as (() => void) | null,
  menuToggleDeviceToolbar: null as (() => void) | null,
  recordVisitForThread: vi.fn(),
}));

const EMPTY_HISTORY: never[] = [];

vi.mock("~/browserHistoryStore", () => ({
  recordVisitForThread: mocks.recordVisitForThread,
  setTitleForThreadUrl: vi.fn(),
  removeUrlForThread: vi.fn(),
  BROWSER_HISTORY_MAX_ENTRIES_PER_PROJECT: 50,
  useThreadRecentHistory: () => EMPTY_HISTORY,
}));

const annotationTheme = {
  colorScheme: "light" as const,
  radius: "0.5rem",
  background: "white",
  foreground: "black",
  popover: "white",
  popoverForeground: "black",
  primary: "blue",
  primaryForeground: "white",
  muted: "gray",
  mutedForeground: "darkgray",
  accent: "lightgray",
  accentForeground: "black",
  border: "silver",
  input: "silver",
  ring: "blue",
  fontSans: "system-ui",
  fontMono: "monospace",
};

vi.mock("~/state/session", () => ({
  readPreparedConnection: mocks.readPreparedConnection,
}));

vi.mock("~/composerDraftStore", () => ({
  useComposerDraftStore: (
    select: (store: { addPreviewAnnotation: () => void; addImage: () => void }) => unknown,
  ) =>
    select({
      addPreviewAnnotation: mocks.addPreviewAnnotation,
      addImage: mocks.addImage,
    }),
}));

vi.mock("~/lib/previewAnnotation", () => ({
  previewAnnotationScreenshotFile: mocks.previewAnnotationScreenshotFile,
}));

vi.mock("~/localApi", () => ({
  ensureLocalApi: vi.fn(),
}));

vi.mock("~/previewStateStore", () => ({
  previewRuntimeCapability: () => mocks.capability,
  rememberPreviewUrl: mocks.rememberPreviewUrl,
  updatePreviewServerSnapshot: vi.fn(),
  useThreadPreviewState: () => ({
    activeTabId: "tab-1",
    desktopByTabId: {
      "tab-1": {
        hasWebContents: true,
        canGoBack: false,
        canGoForward: false,
        loading: false,
        zoomFactor: 1,
        pictureInPicture: mocks.pictureInPicture,
        colorScheme: "system",
        controller: "none",
      },
    },
    recentlySeenUrls: [],
    sessions: mocks.showEmptyState
      ? {}
      : {
          "tab-1": {
            threadId: "thread-1",
            tabId: "tab-1",
            navStatus: {
              _tag: "Success",
              url: "http://example.com/",
              title: "Example",
            },
            canGoBack: false,
            canGoForward: false,
            updatedAt: "2026-07-13T00:00:00.000Z",
          },
        },
  }),
}));

vi.mock("~/state/environments", () => ({
  useEnvironment: () => ({ label: "WSL" }),
  useEnvironmentHttpBaseUrl: () => "http://172.25.85.75:3773",
}));

vi.mock("~/state/preview", () => ({
  previewEnvironment: { open: {}, navigate: {}, resize: {} },
}));

vi.mock("~/state/use-atom-command", () => ({
  useAtomCommand: (_atom: unknown, label?: string) =>
    label === "preview navigate" ? mocks.navigateCommand : vi.fn(),
}));

vi.mock("~/browser/hostedFrameReload", () => ({
  reloadHostedFrame: mocks.reloadHostedFrame,
}));

vi.mock("~/browser/framePreviewAnnotationBridge", () => ({
  useFramePreviewAnnotationReady: () => mocks.frameAnnotationReady,
  useFramePreviewInspectorNavigationState: () => mocks.frameNavigation,
  navigateFramePreviewInspectorHistory: mocks.navigateFramePreviewInspectorHistory,
  pickFramePreviewAnnotationElement: mocks.pickFramePreviewAnnotationElement,
  cancelFramePreviewAnnotationPick: mocks.cancelFramePreviewAnnotationPick,
}));

vi.mock("~/browser/annotationTheme", () => ({
  readPreviewAnnotationTheme: () => annotationTheme,
}));

vi.mock("./useFramedServerStatus", () => ({ useFramedServerStatus: () => null }));
vi.mock("./PreviewServerNotStarted", () => ({ PreviewServerNotStarted: () => null }));
vi.mock("./PreviewFrameUnrendered", () => ({
  PreviewFrameUnrendered: () => null,
  useFrameUnrenderedHint: () => false,
}));

vi.mock("~/browser/browserRecording", () => ({
  findActiveBrowserRecordingRuntimeTabId: vi.fn(() => null),
  startBrowserRecording: vi.fn(),
  stopBrowserRecording: vi.fn(),
  useActiveBrowserRecordingTabIds: () => new Set(),
}));

vi.mock("~/browser/browserSurfaceStore", () => ({
  useBrowserSurfaceStore: (
    select: (state: { byTabId: Record<string, { rect?: unknown }> }) => unknown,
  ) => select({ byTabId: {} }),
}));

vi.mock("~/previewMiniPlayerStore", () => {
  const usePreviewMiniPlayerStore = Object.assign(
    (select: (state: unknown) => unknown) =>
      select({
        byThreadKey: mocks.miniPlayerTabId
          ? {
              "environment-1:thread-1": {
                tabId: mocks.miniPlayerTabId,
                position: null,
              },
            }
          : {},
      }),
    {
      getState: () => ({
        open: mocks.openMiniPlayer,
        close: mocks.closeMiniPlayer,
      }),
    },
  );
  return {
    selectThreadPreviewMiniPlayer: (
      byThreadKey: Record<string, { tabId: string; position: null }>,
    ) => byThreadKey["environment-1:thread-1"] ?? null,
    usePreviewMiniPlayerStore,
  };
});

vi.mock("~/rightPanelStore", () => ({
  useRightPanelStore: {
    getState: () => ({ close: mocks.closeRightPanel }),
  },
}));

vi.mock("~/components/ui/toast", () => ({
  stackedThreadToast: vi.fn(),
  toastManager: { add: vi.fn() },
}));

vi.mock("./previewBridge", () => ({
  // A getter, so a test can take the bridge away and exercise the browser path
  // on the same module graph.
  get previewBridge() {
    return mocks.previewBridge;
  },
}));

vi.mock("./PreviewChromeRow", () => ({
  PreviewChromeRow: (props: {
    onSubmit: (url: string) => void;
    onBack?: (() => void) | undefined;
    onForward?: (() => void) | undefined;
    onRefresh: () => void;
    onPickElement?: () => void;
    onPictureInPicture?: () => void;
    pictureInPicture?: boolean;
    pickDisabled?: boolean;
    pickDisabledReason?: string;
    trailingActions?: {
      props: {
        onNativePictureInPicture?: () => void;
        onHardReload?: () => void;
        onToggleDeviceToolbar?: () => void;
      };
    };
  }) => {
    mocks.submittedUrl = props.onSubmit;
    mocks.chromeBack = props.onBack;
    mocks.chromeForward = props.onForward;
    mocks.chromeRefresh = props.onRefresh;
    mocks.toggleAnnotation = props.onPickElement ?? null;
    mocks.togglePictureInPicture = props.onPictureInPicture ?? null;
    mocks.toggleNativePictureInPicture =
      props.trailingActions?.props.onNativePictureInPicture ?? null;
    mocks.menuHardReload = props.trailingActions?.props.onHardReload ?? null;
    mocks.menuToggleDeviceToolbar = props.trailingActions?.props.onToggleDeviceToolbar ?? null;
    mocks.pictureInPicturePressed = props.pictureInPicture ?? false;
    mocks.chromePick = props.onPickElement ?? null;
    mocks.chromePickDisabled = props.pickDisabled;
    mocks.chromePickDisabledReason = props.pickDisabledReason;
    return null;
  },
}));

vi.mock("./PreviewEmptyState", () => ({
  PreviewEmptyState: (props: { onOpenUrl: (url: string) => void }) => {
    mocks.emptyStateUrl = props.onOpenUrl;
    return null;
  },
}));
vi.mock("./PreviewMoreMenu", () => ({
  PreviewMoreMenu: (props: {
    onNativePictureInPicture?: () => void;
    onToggleDeviceToolbar: () => void;
  }) => {
    mocks.toggleNativePictureInPicture = props.onNativePictureInPicture ?? null;
    mocks.menuToggleDeviceToolbar = props.onToggleDeviceToolbar;
    return null;
  },
}));
vi.mock("./PreviewFrameMoreMenu", () => ({
  PreviewFrameMoreMenu: (props: {
    onHardReload: () => void;
    onToggleDeviceToolbar: () => void;
  }) => {
    mocks.menuHardReload = props.onHardReload;
    mocks.menuToggleDeviceToolbar = props.onToggleDeviceToolbar;
    return null;
  },
}));
vi.mock("./PreviewUnreachable", () => ({ PreviewUnreachable: () => null }));
vi.mock("./ZoomIndicator", () => ({ ZoomIndicator: () => null }));
vi.mock("./AgentBrowserCursor", () => ({ AgentBrowserCursor: () => null }));
vi.mock("~/browser/BrowserSurfaceSlot", () => ({ BrowserSurfaceSlot: () => null }));
vi.mock("./useLoadingProgress", () => ({ useLoadingProgress: () => 0 }));
vi.mock("./usePreviewSession", () => ({ usePreviewSession: vi.fn() }));

import { PreviewView } from "./PreviewView";
import { previewRuntimeTabId } from "~/browser/previewRuntimeTabId";

const TEST_THREAD_REF = {
  environmentId: EnvironmentId.make("environment-1"),
  threadId: ThreadId.make("thread-1"),
} as const;
const TEST_RUNTIME_TAB_ID = previewRuntimeTabId(TEST_THREAD_REF, null, "tab-1");

describe("PreviewView navigation", () => {
  beforeEach(() => {
    mocks.navigate.mockClear();
    mocks.rememberPreviewUrl.mockClear();
    mocks.readPreparedConnection.mockClear();
    mocks.submittedUrl = null;
    mocks.emptyStateUrl = null;
    mocks.togglePictureInPicture = null;
    mocks.toggleNativePictureInPicture = null;
    mocks.pictureInPicturePressed = false;
    mocks.miniPlayerTabId = null;
    mocks.openMiniPlayer.mockClear();
    mocks.closeMiniPlayer.mockClear();
    mocks.closeRightPanel.mockClear();
    mocks.openPictureInPicture.mockClear();
    mocks.closePictureInPicture.mockClear();
    mocks.pickElement.mockReset();
    mocks.previewAnnotationScreenshotFile.mockReset();
    mocks.addPreviewAnnotation.mockClear();
    mocks.addImage.mockClear();
    mocks.toggleAnnotation = null;
    mocks.pictureInPicture = false;
    mocks.showEmptyState = false;
    mocks.capability = "webview";
    mocks.previewBridge = {
      navigate: mocks.navigate,
      pickElement: mocks.pickElement,
      pictureInPicture: {
        open: mocks.openPictureInPicture,
        close: mocks.closePictureInPicture,
      },
    };
    mocks.reloadHostedFrame.mockClear();
    mocks.navigateCommand.mockClear();
    mocks.chromeBack = undefined;
    mocks.chromeForward = undefined;
    mocks.chromeRefresh = null;
    mocks.chromePick = null;
    mocks.chromePickDisabled = undefined;
    mocks.chromePickDisabledReason = undefined;
    mocks.frameAnnotationReady = false;
    mocks.frameNavigation = { ready: false, canGoBack: false, canGoForward: false };
    mocks.navigateFramePreviewInspectorHistory.mockClear();
    mocks.pickFramePreviewAnnotationElement.mockClear();
    mocks.cancelFramePreviewAnnotationPick.mockClear();
    mocks.menuHardReload = null;
    mocks.menuToggleDeviceToolbar = null;
    mocks.recordVisitForThread.mockClear();
  });

  it.each([
    [
      "https://localhost:8000/dashboard?mode=test#top",
      "https://localhost:8000/dashboard?mode=test#top",
    ],
    ["localhost:5173/app", "http://localhost:5173/app"],
  ])("preserves a direct localhost URL in a WSL environment", async (submitted, expected) => {
    renderToStaticMarkup(
      <PreviewView
        threadRef={{
          environmentId: EnvironmentId.make("environment-1"),
          threadId: ThreadId.make("thread-1"),
        }}
        tabId="tab-1"
        visible
      />,
    );

    expect(mocks.submittedUrl).not.toBeNull();
    mocks.submittedUrl?.(submitted);

    await vi.waitFor(() =>
      expect(mocks.navigate).toHaveBeenCalledWith(TEST_RUNTIME_TAB_ID, expected),
    );
    expect(mocks.rememberPreviewUrl).toHaveBeenCalledWith(
      {
        environmentId: "environment-1",
        threadId: "thread-1",
      },
      expected,
    );
  });

  it("records a history visit with the normalized requested url on submit", async () => {
    renderToStaticMarkup(
      <PreviewView
        threadRef={{
          environmentId: EnvironmentId.make("environment-1"),
          threadId: ThreadId.make("thread-1"),
        }}
        tabId="tab-1"
        visible
      />,
    );

    mocks.submittedUrl?.("localhost:3000/admin");
    await vi.waitFor(() => {
      expect(mocks.recordVisitForThread).toHaveBeenCalledWith(
        expect.objectContaining({ threadId: expect.anything() }),
        "http://localhost:3000/admin",
      );
    });
  });

  it("maps an empty-state localhost server onto the WSL host", async () => {
    mocks.showEmptyState = true;
    renderToStaticMarkup(
      <PreviewView
        threadRef={{
          environmentId: EnvironmentId.make("environment-1"),
          threadId: ThreadId.make("thread-1"),
        }}
        tabId="tab-1"
        visible
      />,
    );

    expect(mocks.emptyStateUrl).not.toBeNull();
    mocks.emptyStateUrl?.("http://localhost:5173/app?mode=test#top");

    await vi.waitFor(() =>
      expect(mocks.navigate).toHaveBeenCalledWith(
        TEST_RUNTIME_TAB_ID,
        "http://172.25.85.75:5173/app?mode=test#top",
      ),
    );
    expect(mocks.rememberPreviewUrl).toHaveBeenCalledWith(
      {
        environmentId: "environment-1",
        threadId: "thread-1",
      },
      "http://172.25.85.75:5173/app?mode=test#top",
    );
    await vi.waitFor(() =>
      expect(mocks.recordVisitForThread).toHaveBeenCalledWith(
        expect.objectContaining({ threadId: expect.anything() }),
        "http://localhost:5173/app?mode=test#top",
      ),
    );
  });

  it("opens and closes a thread-scoped floating preview for the active tab", async () => {
    const props = {
      threadRef: {
        environmentId: EnvironmentId.make("environment-1"),
        threadId: ThreadId.make("thread-1"),
      },
      tabId: "tab-1",
      visible: true,
    } as const;

    renderToStaticMarkup(<PreviewView {...props} />);
    expect(mocks.pictureInPicturePressed).toBe(false);
    mocks.togglePictureInPicture?.();
    expect(mocks.openMiniPlayer).toHaveBeenCalledWith(props.threadRef, "tab-1");
    expect(mocks.closeRightPanel).toHaveBeenCalledWith(props.threadRef);

    mocks.miniPlayerTabId = "tab-1";
    renderToStaticMarkup(<PreviewView {...props} />);
    expect(mocks.pictureInPicturePressed).toBe(true);
    mocks.togglePictureInPicture?.();
    expect(mocks.closeMiniPlayer).toHaveBeenCalledWith(props.threadRef);
  });

  it("keeps the native preview window as a secondary action", async () => {
    const props = {
      threadRef: {
        environmentId: EnvironmentId.make("environment-1"),
        threadId: ThreadId.make("thread-1"),
      },
      tabId: "tab-1",
      visible: true,
    } as const;

    renderToStaticMarkup(<PreviewView {...props} />);
    mocks.toggleNativePictureInPicture?.();
    await vi.waitFor(() =>
      expect(mocks.openPictureInPicture).toHaveBeenCalledWith(TEST_RUNTIME_TAB_ID),
    );

    mocks.pictureInPicture = true;
    renderToStaticMarkup(<PreviewView {...props} />);
    mocks.toggleNativePictureInPicture?.();
    await vi.waitFor(() =>
      expect(mocks.closePictureInPicture).toHaveBeenCalledWith(TEST_RUNTIME_TAB_ID),
    );
  });

  it("forwards Cmd/Ctrl+Enter annotations to the composer send path", async () => {
    const annotation = {
      id: "annotation-1",
      pageUrl: "https://example.com/dashboard",
      pageTitle: "Dashboard",
      comment: "Tighten this spacing",
      elements: [],
      regions: [],
      strokes: [],
      styleChanges: [],
      screenshot: null,
      createdAt: "2026-07-27T00:00:00.000Z",
    };
    const onSendAnnotation = vi.fn();
    mocks.pickElement.mockResolvedValue({ annotation, submission: "send" });

    renderToStaticMarkup(
      <PreviewView
        threadRef={TEST_THREAD_REF}
        tabId="tab-1"
        visible
        onSendAnnotation={onSendAnnotation}
      />,
    );
    mocks.toggleAnnotation?.();

    await vi.waitFor(() => expect(onSendAnnotation).toHaveBeenCalledWith(annotation, null));
    expect(mocks.addPreviewAnnotation).toHaveBeenCalledWith(TEST_THREAD_REF, annotation);
  });

  it("still sends when screenshot attachment conversion fails", async () => {
    const annotation = {
      id: "annotation-2",
      pageUrl: "https://example.com/dashboard",
      pageTitle: "Dashboard",
      comment: "Tighten this spacing",
      elements: [],
      regions: [],
      strokes: [],
      styleChanges: [],
      screenshot: {
        dataUrl: "data:image/png;base64,c2NyZWVuc2hvdA==",
        width: 10,
        height: 10,
        cropRect: { x: 0, y: 0, width: 10, height: 10 },
      },
      createdAt: "2026-07-27T00:00:00.000Z",
    };
    const onSendAnnotation = vi.fn();
    mocks.pickElement.mockResolvedValue({ annotation, submission: "send" });
    mocks.previewAnnotationScreenshotFile.mockRejectedValue(new Error("conversion failed"));

    renderToStaticMarkup(
      <PreviewView
        threadRef={TEST_THREAD_REF}
        tabId="tab-1"
        visible
        onSendAnnotation={onSendAnnotation}
      />,
    );
    mocks.toggleAnnotation?.();

    await vi.waitFor(() => expect(onSendAnnotation).toHaveBeenCalledWith(annotation, null));
    expect(mocks.addImage).not.toHaveBeenCalled();
  });
});

describe("PreviewView under the frame capability", () => {
  const props = {
    threadRef: {
      environmentId: EnvironmentId.make("environment-1"),
      threadId: ThreadId.make("thread-1"),
    },
    tabId: "tab-1",
    visible: true,
  } as const;

  beforeEach(() => {
    mocks.capability = "frame";
    // There is no desktop bridge in a browser, which is what makes the
    // capability "frame" in the first place.
    mocks.previewBridge = null;
    mocks.navigate.mockClear();
    mocks.rememberPreviewUrl.mockClear();
    mocks.reloadHostedFrame.mockClear();
    mocks.navigateCommand.mockClear();
    mocks.submittedUrl = null;
    mocks.chromeBack = undefined;
    mocks.chromeForward = undefined;
    mocks.chromeRefresh = null;
    mocks.chromePick = null;
    mocks.chromePickDisabled = undefined;
    mocks.chromePickDisabledReason = undefined;
    mocks.showEmptyState = false;
    mocks.miniPlayerTabId = null;
    mocks.frameAnnotationReady = false;
    mocks.frameNavigation = { ready: false, canGoBack: false, canGoForward: false };
    mocks.navigateFramePreviewInspectorHistory.mockClear();
    mocks.pickFramePreviewAnnotationElement.mockClear();
    mocks.cancelFramePreviewAnnotationPick.mockClear();
    mocks.menuHardReload = null;
    mocks.menuToggleDeviceToolbar = null;
  });

  it("offers no back or forward, because a frame keeps no history to walk", () => {
    renderToStaticMarkup(<PreviewView {...props} />);

    expect(mocks.chromeBack).toBeUndefined();
    expect(mocks.chromeForward).toBeUndefined();
  });

  it("still offers refresh, which replaces the frame element", () => {
    renderToStaticMarkup(<PreviewView {...props} />);

    expect(mocks.chromeRefresh).not.toBeNull();
    mocks.chromeRefresh?.();
    expect(mocks.reloadHostedFrame).toHaveBeenCalledWith(TEST_RUNTIME_TAB_ID);
  });

  it("wires inspector-backed frame history when the inspector is ready", () => {
    mocks.frameNavigation = { ready: true, canGoBack: true, canGoForward: true };
    renderToStaticMarkup(<PreviewView {...props} />);

    expect(mocks.chromeBack).not.toBeUndefined();
    expect(mocks.chromeForward).not.toBeUndefined();
    mocks.chromeBack?.();
    mocks.chromeForward?.();

    expect(mocks.navigateFramePreviewInspectorHistory).toHaveBeenNthCalledWith(
      1,
      TEST_RUNTIME_TAB_ID,
      "back",
    );
    expect(mocks.navigateFramePreviewInspectorHistory).toHaveBeenNthCalledWith(
      2,
      TEST_RUNTIME_TAB_ID,
      "forward",
    );
  });

  it("navigates by writing to the server rather than through the desktop bridge", async () => {
    renderToStaticMarkup(<PreviewView {...props} />);

    expect(mocks.submittedUrl).not.toBeNull();
    mocks.submittedUrl?.("localhost:5173/app");

    await vi.waitFor(() =>
      expect(mocks.navigateCommand).toHaveBeenCalledWith({
        environmentId: "environment-1",
        input: {
          threadId: "thread-1",
          tabId: "tab-1",
          url: "http://localhost:5173/app",
        },
      }),
    );
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it("shows the annotation affordance disabled until the framed app announces the inspector", () => {
    renderToStaticMarkup(<PreviewView {...props} />);

    expect(mocks.chromePick).not.toBeNull();
    expect(mocks.chromePickDisabled).toBe(true);
    expect(mocks.chromePickDisabledReason).toContain("@moatless/inspector/preview-annotation");
  });

  it("starts browser-frame annotation picking once the inspector is ready", async () => {
    mocks.frameAnnotationReady = true;
    renderToStaticMarkup(<PreviewView {...props} />);

    expect(mocks.chromePick).not.toBeNull();
    expect(mocks.chromePickDisabled).toBe(false);
    mocks.chromePick?.();

    await vi.waitFor(() =>
      expect(mocks.pickFramePreviewAnnotationElement).toHaveBeenCalledWith(
        TEST_RUNTIME_TAB_ID,
        annotationTheme,
      ),
    );
  });

  it("supports the in-app floating preview for frames", () => {
    renderToStaticMarkup(<PreviewView {...props} />);

    expect(mocks.togglePictureInPicture).not.toBeNull();
    mocks.togglePictureInPicture?.();

    expect(mocks.openMiniPlayer).toHaveBeenCalledWith(props.threadRef, "tab-1");
    expect(mocks.closeRightPanel).toHaveBeenCalledWith(props.threadRef);
  });

  it("passes frame-safe actions to the preview menu", () => {
    renderToStaticMarkup(<PreviewView {...props} />);

    expect(mocks.menuHardReload).not.toBeNull();
    expect(mocks.menuToggleDeviceToolbar).not.toBeNull();
    expect(mocks.toggleNativePictureInPicture).toBeNull();

    mocks.menuHardReload?.();
    expect(mocks.reloadHostedFrame).toHaveBeenCalledWith(TEST_RUNTIME_TAB_ID);
  });
});
