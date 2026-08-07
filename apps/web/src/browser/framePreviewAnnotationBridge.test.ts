import type { PreviewAnnotationPayload } from "@t3tools/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import {
  ELEMENT_PICKED_CHANNEL,
  GUEST_READY_CHANNEL,
  PING_CHANNEL,
  PREVIEW_ANNOTATION_MESSAGE,
  START_PICK_CHANNEL,
  getFramePreviewInspectorNavigationState,
  cancelFramePreviewAnnotationPick,
  isFramePreviewAnnotationReady,
  navigateFramePreviewInspectorHistory,
  pickFramePreviewAnnotationElement,
  registerFramePreviewAnnotationHost,
  resetFramePreviewAnnotationBridgeForTest,
  resolveFramePreviewAnnotationOrigin,
  resolveFramePreviewInspectorRouteUrl,
} from "./framePreviewAnnotationBridge";

const RUNTIME_TAB_ID = "runtime-tab";
const ORIGIN = "https://preview.example.test";

const theme = {
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

function annotation(): PreviewAnnotationPayload {
  return {
    id: "annotation-1",
    pageUrl: `${ORIGIN}/`,
    pageTitle: "Preview",
    comment: "Fix this",
    elements: [],
    regions: [],
    strokes: [],
    styleChanges: [],
    screenshot: null,
    createdAt: "2026-08-01T00:00:00.000Z",
  };
}

let messageListener: ((event: MessageEvent) => void) | null = null;

function installWindowStub() {
  vi.stubGlobal("window", {
    addEventListener: vi.fn((type: string, listener: EventListener) => {
      if (type === "message") messageListener = listener as (event: MessageEvent) => void;
    }),
    removeEventListener: vi.fn((type: string, listener: EventListener) => {
      if (type === "message" && messageListener === listener) messageListener = null;
    }),
  });
}

function frameHarness() {
  const frameWindow = {
    postMessage: vi.fn(),
  } as unknown as Window;
  return {
    frameWindow,
    postMessage: vi.mocked(frameWindow.postMessage),
  };
}

function dispatchFromFrame(frameWindow: Window, channel: string, args: readonly unknown[] = []) {
  messageListener?.({
    source: frameWindow,
    origin: ORIGIN,
    data: { source: PREVIEW_ANNOTATION_MESSAGE, channel, args },
  } as MessageEvent);
}

function dispatchBasicInspectorMessage(frameWindow: Window, type: string, payload: unknown) {
  messageListener?.({
    source: frameWindow,
    origin: ORIGIN,
    data: { source: "preview-iframe", type, payload },
  } as MessageEvent);
}

beforeEach(() => {
  installWindowStub();
  resetFramePreviewAnnotationBridgeForTest();
});

afterEach(() => {
  resetFramePreviewAnnotationBridgeForTest();
  vi.unstubAllGlobals();
  messageListener = null;
});

describe("framePreviewAnnotationBridge", () => {
  it("derives the framed preview origin from the URL", () => {
    expect(resolveFramePreviewAnnotationOrigin(`${ORIGIN}/path?x=1`)).toBe(ORIGIN);
  });

  it("resolves inspector route paths against the current framed URL", () => {
    expect(resolveFramePreviewInspectorRouteUrl(`${ORIGIN}/app?page=1`, "/settings")).toBe(
      `${ORIGIN}/settings`,
    );
    expect(resolveFramePreviewInspectorRouteUrl(`${ORIGIN}/app?page=1`, "#/settings")).toBe(
      `${ORIGIN}/app?page=1#/settings`,
    );
  });

  it("pings the registered frame and marks it ready only after the guest replies", () => {
    const { frameWindow, postMessage } = frameHarness();
    const cleanup = registerFramePreviewAnnotationHost({
      runtimeTabId: RUNTIME_TAB_ID,
      frameWindow,
      targetOrigin: ORIGIN,
      url: `${ORIGIN}/`,
    });

    expect(postMessage).toHaveBeenCalledWith(
      { source: PREVIEW_ANNOTATION_MESSAGE, channel: PING_CHANNEL, args: [] },
      ORIGIN,
    );
    expect(isFramePreviewAnnotationReady(RUNTIME_TAB_ID)).toBe(false);

    dispatchFromFrame(frameWindow, GUEST_READY_CHANNEL);

    expect(isFramePreviewAnnotationReady(RUNTIME_TAB_ID)).toBe(true);
    cleanup();
  });

  it("stays ready when the same frame is registered again", () => {
    const { frameWindow } = frameHarness();
    const url = `${ORIGIN}/`;
    const register = () =>
      registerFramePreviewAnnotationHost({
        runtimeTabId: RUNTIME_TAB_ID,
        frameWindow,
        targetOrigin: ORIGIN,
        url,
      });

    let cleanup = register();
    dispatchFromFrame(frameWindow, GUEST_READY_CHANNEL);
    expect(isFramePreviewAnnotationReady(RUNTIME_TAB_ID)).toBe(true);

    // React tears the old registration down before it builds the new one, so
    // this is the order a re-render produces.
    cleanup();
    cleanup = register();

    expect(isFramePreviewAnnotationReady(RUNTIME_TAB_ID)).toBe(true);
    cleanup();
  });

  it("starts over when a different frame is registered for the same tab", () => {
    const first = frameHarness();
    const second = frameHarness();
    const url = `${ORIGIN}/`;

    const cleanup = registerFramePreviewAnnotationHost({
      runtimeTabId: RUNTIME_TAB_ID,
      frameWindow: first.frameWindow,
      targetOrigin: ORIGIN,
      url,
    });
    dispatchFromFrame(first.frameWindow, GUEST_READY_CHANNEL);
    expect(isFramePreviewAnnotationReady(RUNTIME_TAB_ID)).toBe(true);

    cleanup();
    const next = registerFramePreviewAnnotationHost({
      runtimeTabId: RUNTIME_TAB_ID,
      frameWindow: second.frameWindow,
      targetOrigin: ORIGIN,
      url,
    });

    expect(isFramePreviewAnnotationReady(RUNTIME_TAB_ID)).toBe(false);
    next();
  });

  it("ignores annotation messages from another origin", () => {
    const { frameWindow } = frameHarness();
    const cleanup = registerFramePreviewAnnotationHost({
      runtimeTabId: RUNTIME_TAB_ID,
      frameWindow,
      targetOrigin: ORIGIN,
      url: `${ORIGIN}/`,
    });

    messageListener?.({
      source: frameWindow,
      origin: "https://other.example.test",
      data: { source: PREVIEW_ANNOTATION_MESSAGE, channel: GUEST_READY_CHANNEL, args: [] },
    } as MessageEvent);

    expect(isFramePreviewAnnotationReady(RUNTIME_TAB_ID)).toBe(false);
    cleanup();
  });

  it("starts a pick session and resolves with the annotation returned by the frame", async () => {
    const { frameWindow, postMessage } = frameHarness();
    const cleanup = registerFramePreviewAnnotationHost({
      runtimeTabId: RUNTIME_TAB_ID,
      frameWindow,
      targetOrigin: ORIGIN,
      url: `${ORIGIN}/`,
    });
    dispatchFromFrame(frameWindow, GUEST_READY_CHANNEL);

    const picked = pickFramePreviewAnnotationElement(RUNTIME_TAB_ID, theme);

    expect(postMessage).toHaveBeenLastCalledWith(
      { source: PREVIEW_ANNOTATION_MESSAGE, channel: START_PICK_CHANNEL, args: [theme] },
      ORIGIN,
    );

    const payload = annotation();
    dispatchFromFrame(frameWindow, ELEMENT_PICKED_CHANNEL, [payload]);

    await expect(picked).resolves.toEqual(payload);
    cleanup();
  });

  it("resolves an in-flight pick as null when cancelled", async () => {
    const { frameWindow } = frameHarness();
    const cleanup = registerFramePreviewAnnotationHost({
      runtimeTabId: RUNTIME_TAB_ID,
      frameWindow,
      targetOrigin: ORIGIN,
      url: `${ORIGIN}/`,
    });
    dispatchFromFrame(frameWindow, GUEST_READY_CHANNEL);

    const picked = pickFramePreviewAnnotationElement(RUNTIME_TAB_ID, theme);
    cancelFramePreviewAnnotationPick(RUNTIME_TAB_ID);

    await expect(picked).resolves.toBeNull();
    cleanup();
  });

  it("tracks basic inspector route changes and drives limited history navigation", () => {
    const onInspectorRouteChange = vi.fn();
    const { frameWindow, postMessage } = frameHarness();
    const cleanup = registerFramePreviewAnnotationHost({
      runtimeTabId: RUNTIME_TAB_ID,
      frameWindow,
      targetOrigin: ORIGIN,
      url: `${ORIGIN}/`,
      onInspectorRouteChange,
    });

    dispatchBasicInspectorMessage(frameWindow, "ROUTE_CHANGE", {
      path: "/settings",
      timestamp: 1,
    });
    dispatchBasicInspectorMessage(frameWindow, "ROUTE_CHANGE", {
      path: "/billing",
      timestamp: 2,
    });

    expect(onInspectorRouteChange).toHaveBeenLastCalledWith({
      url: `${ORIGIN}/billing`,
      title: null,
      canGoBack: true,
      canGoForward: false,
    });
    expect(getFramePreviewInspectorNavigationState(RUNTIME_TAB_ID)).toEqual({
      ready: true,
      canGoBack: true,
      canGoForward: false,
    });

    navigateFramePreviewInspectorHistory(RUNTIME_TAB_ID, "back");

    expect(postMessage).toHaveBeenLastCalledWith(
      { type: "NAVIGATE", payload: { path: "/settings" } },
      ORIGIN,
    );
    expect(getFramePreviewInspectorNavigationState(RUNTIME_TAB_ID)).toEqual({
      ready: true,
      canGoBack: true,
      canGoForward: true,
    });
    cleanup();
  });
});
