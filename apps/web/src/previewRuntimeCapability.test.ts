import { afterEach, describe, expect, it } from "vite-plus/test";

import { isPreviewSupportedInRuntime, previewRuntimeCapability } from "./previewStateStore";

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");

function setWindow(value: unknown): void {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    writable: true,
    value,
  });
}

afterEach(() => {
  if (originalWindow) {
    Object.defineProperty(globalThis, "window", originalWindow);
  } else {
    Reflect.deleteProperty(globalThis, "window");
  }
});

describe("previewRuntimeCapability", () => {
  it("is webview where a desktop preview bridge exists", () => {
    setWindow({ desktopBridge: { preview: {} } });

    expect(previewRuntimeCapability()).toBe("webview");
  });

  it("is frame in a browser, with or without a desktop bridge that has no preview", () => {
    setWindow({});
    expect(previewRuntimeCapability()).toBe("frame");

    setWindow({ desktopBridge: {} });
    expect(previewRuntimeCapability()).toBe("frame");
  });

  it("is none where there is no DOM to draw into", () => {
    setWindow(undefined);

    expect(previewRuntimeCapability()).toBe("none");
  });
});

describe("isPreviewSupportedInRuntime", () => {
  it("stays true for both surfaces that can show a page", () => {
    setWindow({ desktopBridge: { preview: {} } });
    expect(isPreviewSupportedInRuntime()).toBe(true);

    setWindow({});
    expect(isPreviewSupportedInRuntime()).toBe(true);
  });

  it("is false only where nothing can be drawn", () => {
    setWindow(undefined);

    expect(isPreviewSupportedInRuntime()).toBe(false);
  });
});
