/**
 * Fork-only: PreviewView on the framed surface (no desktop bridge), where the
 * guest page is driven over postMessage and the server's record of the tab is
 * the only account of it. Upstream's webview tests live beside it.
 */
import {
  BUILT_IN_BROWSER_PROFILES,
  DEFAULT_BROWSER_PROFILE_ID,
  DEFAULT_PREVIEW_APPEARANCE,
  DEFAULT_PREVIEW_ZOOM_FACTOR,
  EnvironmentId,
  FILL_PREVIEW_VIEWPORT,
  ThreadId,
} from "@t3tools/contracts";
import { act, type ComponentProps, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";

import "~/index.css";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(async (_tabId: string, _url: string): Promise<void> => undefined),
  rememberPreviewUrl: vi.fn(),
  readPreparedConnection: vi.fn(() => ({ httpBaseUrl: "http://172.25.85.75:3773" })),
  readEnvironmentScope: vi.fn((_environmentId?: unknown, _scope?: unknown) => true),
  setAnnotationSendEnabled: vi.fn(async (_tabId: string, _enabled: boolean): Promise<void> => {}),
  cancelPickElement: vi.fn(async (_tabId: string) => undefined),
  openPictureInPicture: vi.fn(async (_tabId: string): Promise<void> => undefined),
  closePictureInPicture: vi.fn(async (_tabId: string): Promise<void> => undefined),
  pickElement: vi.fn(),
  addPreviewAnnotation: vi.fn(),
  addImage: vi.fn(),
  toast: vi.fn(),
  pictureInPicture: false,
  showEmptyState: false,
  loading: false,
  serverEpoch: null as string | null,
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
  frameAnnotationReady: false,
  frameNavigation: { ready: false, canGoBack: false, canGoForward: false },
  navigateFramePreviewInspectorHistory: vi.fn(),
  pickFramePreviewAnnotationElement: vi.fn(async () => null),
  cancelFramePreviewAnnotationPick: vi.fn(),
  recordingTabIds: new Set<string>(),
  recordingRuntimeTabId: null as string | null,
  recordVisitForThread: vi.fn(),
}));

const STUB_BROWSER_DEFAULTS = {
  viewport: FILL_PREVIEW_VIEWPORT,
  zoomFactor: DEFAULT_PREVIEW_ZOOM_FACTOR,
  appearance: DEFAULT_PREVIEW_APPEARANCE,
  autoShowFloatingPreview: true,
  profiles: BUILT_IN_BROWSER_PROFILES,
  profileId: DEFAULT_BROWSER_PROFILE_ID,
};

// A browser has no desktop bridge, which is what makes the capability "frame".
// Browser-mode mocks bind their exports once at load, so these tests cannot
// share a file with PreviewView.browser.test.tsx, which needs the bridge.
vi.mock(import("./previewBridge"), async (original) => ({
  ...(await original()),
  previewBridge: null,
}));
vi.mock(import("~/browserHistoryStore"), async (original) => ({
  ...(await original()),
  recordVisitForThread: mocks.recordVisitForThread,
}));
vi.mock(import("~/state/session"), async (original) => ({
  ...(await original()),
  readPreparedConnection: mocks.readPreparedConnection as never,
  readEnvironmentScope: mocks.readEnvironmentScope,
  useEnvironmentScope: mocks.readEnvironmentScope,
}));
vi.mock(import("~/browser/browserDefaults"), async (original) => ({
  ...(await original()),
  useBrowserDefaults: () => STUB_BROWSER_DEFAULTS,
  getBrowserDefaults: () => STUB_BROWSER_DEFAULTS,
}));
vi.mock(import("~/previewStateStore"), async (original) => ({
  ...(await original()),
  previewRuntimeCapability: () => "frame",
  rememberPreviewUrl: mocks.rememberPreviewUrl,
  useThreadPreviewState: (() => ({
    activeTabId: "tab-1",
    serverEpoch: mocks.serverEpoch,
    desktopByTabId: {
      "tab-1": {
        hasWebContents: true,
        canGoBack: false,
        canGoForward: false,
        loading: mocks.loading,
        zoomFactor: 1,
        pictureInPicture: mocks.pictureInPicture,
        colorScheme: "system",
        audioMuted: false,
        audible: false,
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
            navStatus: { _tag: "Success", url: "http://example.com/", title: "Example" },
            canGoBack: false,
            canGoForward: false,
            updatedAt: "2026-07-13T00:00:00.000Z",
          },
        },
  })) as never,
}));
vi.mock(import("~/state/environments"), async (original) => ({
  ...(await original()),
  useEnvironment: (() => ({ label: "WSL" })) as never,
  useEnvironmentHttpBaseUrl: () => "http://172.25.85.75:3773",
  usePrimaryEnvironmentId: () => null,
}));
vi.mock(import("~/browser/browserRecording"), async (original) => ({
  ...(await original()),
  findActiveBrowserRecordingRuntimeTabId: () => mocks.recordingRuntimeTabId,
  useActiveBrowserRecordingTabIds: () => mocks.recordingTabIds,
}));
vi.mock(import("~/components/ui/toast"), async (original) => {
  const actual = await original();
  return { ...actual, toastManager: { ...actual.toastManager, add: mocks.toast } };
});
vi.mock(import("~/state/use-atom-command"), async (original) => {
  const actual = await original();
  return {
    ...actual,
    // A frame navigates by writing to the server, so observe that command.
    useAtomCommand: ((command: never, options?: never) => {
      const real = actual.useAtomCommand(command, options);
      return options === "preview navigate" ? mocks.navigateCommand : real;
    }) as typeof actual.useAtomCommand,
  };
});
vi.mock(import("~/browser/hostedFrameReload"), async (original) => ({
  ...(await original()),
  reloadHostedFrame: mocks.reloadHostedFrame,
}));
vi.mock(import("~/browser/framePreviewAnnotationBridge"), async (original) => ({
  ...(await original()),
  useFramePreviewAnnotationReady: () => mocks.frameAnnotationReady,
  useFramePreviewInspectorNavigationState: () => mocks.frameNavigation,
  navigateFramePreviewInspectorHistory: mocks.navigateFramePreviewInspectorHistory,
  pickFramePreviewAnnotationElement: mocks.pickFramePreviewAnnotationElement as never,
  cancelFramePreviewAnnotationPick: mocks.cancelFramePreviewAnnotationPick,
}));
vi.mock(import("./usePreviewSession"), async (original) => ({
  ...(await original()),
  usePreviewSession: () => {},
}));

import { useComposerDraftStore } from "~/composerDraftStore";
import { useBrowserPointerStore } from "~/browser/browserPointerStore";
import { previewRuntimeTabId } from "~/browser/previewRuntimeTabId";
import { usePreviewMiniPlayerStore } from "~/previewMiniPlayerStore";
import { PreviewView } from "./PreviewView";

const TEST_THREAD_REF = {
  environmentId: EnvironmentId.make("environment-1"),
  threadId: ThreadId.make("thread-1"),
} as const;
const TEST_RUNTIME_TAB_ID = previewRuntimeTabId(TEST_THREAD_REF, null, "tab-1");

const roots: Root[] = [];
let root: Root;

async function render(node: ReactNode) {
  await act(async () => root.render(node));
}

function view(onSendAnnotation?: ComponentProps<typeof PreviewView>["onSendAnnotation"]) {
  return (
    <PreviewView
      threadRef={TEST_THREAD_REF}
      tabId="tab-1"
      visible
      {...(onSendAnnotation ? { onSendAnnotation } : {})}
    />
  );
}

async function submitAddress(text: string) {
  const input = page.getByPlaceholder("Search or enter URL");
  await userEvent.click(input);
  await userEvent.fill(input, text);
  await userEvent.keyboard("{Enter}");
}

describe("PreviewView under the frame capability", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.readEnvironmentScope.mockReset().mockReturnValue(true);
    mocks.showEmptyState = false;
    mocks.pictureInPicture = false;
    mocks.loading = false;
    mocks.serverEpoch = null;
    mocks.recordingTabIds = new Set();
    mocks.recordingRuntimeTabId = null;
    mocks.frameAnnotationReady = false;
    mocks.frameNavigation = { ready: false, canGoBack: false, canGoForward: false };
    useComposerDraftStore.setState({
      addPreviewAnnotation: mocks.addPreviewAnnotation,
      addImage: mocks.addImage,
    });
    usePreviewMiniPlayerStore.setState({ byThreadKey: {} });
    useBrowserPointerStore.setState({ byTabId: {} });
    const container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    roots.push(root);
  });

  afterEach(async () => {
    for (const each of roots.splice(0)) await act(async () => each.unmount());
    document.body.replaceChildren();
  });

  it("offers no back or forward, because a frame keeps no history to walk", async () => {
    await render(view());

    expect(page.getByRole("button", { name: "Back" }).query()).toBeNull();
    expect(page.getByRole("button", { name: "Forward" }).query()).toBeNull();
  });

  it("still offers refresh, which replaces the frame element", async () => {
    await render(view());

    await userEvent.click(page.getByRole("button", { name: "Refresh" }));
    expect(mocks.reloadHostedFrame).toHaveBeenCalledWith(TEST_RUNTIME_TAB_ID);
  });

  it("wires inspector-backed frame history when the inspector is ready", async () => {
    mocks.frameNavigation = { ready: true, canGoBack: true, canGoForward: true };
    await render(view());

    await userEvent.click(page.getByRole("button", { name: "Back" }));
    await userEvent.click(page.getByRole("button", { name: "Forward" }));

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
    await render(view());
    await submitAddress("localhost:5173/app");

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

  it("shows the annotation affordance disabled until the framed app announces the inspector", async () => {
    await render(view());

    await expect.element(page.getByRole("button", { name: "Annotate preview" })).toBeDisabled();
  });

  it("starts browser-frame annotation picking once the inspector is ready", async () => {
    mocks.frameAnnotationReady = true;
    await render(view());

    await userEvent.click(page.getByRole("button", { name: "Annotate preview" }));

    await vi.waitFor(() =>
      expect(mocks.pickFramePreviewAnnotationElement).toHaveBeenCalledWith(
        TEST_RUNTIME_TAB_ID,
        expect.objectContaining({ colorScheme: expect.any(String) }),
      ),
    );
    expect(mocks.pickElement).not.toHaveBeenCalled();
  });

  it("supports the in-app floating preview for frames", async () => {
    await render(view());
    await userEvent.click(page.getByRole("button", { name: "Float preview over chat" }));

    expect(usePreviewMiniPlayerStore.getState().byThreadKey).toMatchObject({
      "environment-1:thread-1": { source: { kind: "browser", tabId: "tab-1" } },
    });
  });

  it("passes frame-safe actions to the preview menu", async () => {
    await render(view());
    await userEvent.click(page.getByRole("button", { name: "Preview menu" }));

    // A frame has no native window to pop out; only the frame-safe items remain.
    expect(page.getByRole("menuitem", { name: "Open separate preview window" }).query()).toBeNull();
    expect(page.getByRole("menuitem", { name: "Show device toolbar" }).query()).not.toBeNull();
    await userEvent.click(page.getByRole("menuitem", { name: "Hard reload" }));
    expect(mocks.reloadHostedFrame).toHaveBeenCalledWith(TEST_RUNTIME_TAB_ID);
  });
});
