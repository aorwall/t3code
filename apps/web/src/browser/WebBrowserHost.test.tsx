import type { PreviewSessionSnapshot } from "@t3tools/contracts";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import type { PreviewRuntimeCapability } from "~/previewStateStore";

let capability: PreviewRuntimeCapability = "frame";
let sessionsByThreadKey: Record<string, unknown> = {};

vi.mock("~/previewStateStore", () => ({
  previewRuntimeCapability: () => capability,
  useActivePreviewSessions: () => sessionsByThreadKey,
}));

const { WebBrowserHost } = await import("./WebBrowserHost");

function snapshot(tabId: string, url: string): PreviewSessionSnapshot {
  return {
    threadId: "thread-1",
    tabId,
    navStatus: { _tag: "Success", url, title: "" },
    canGoBack: false,
    canGoForward: false,
    updatedAt: "2026-07-31T00:00:00.000Z",
  };
}

function threadState(...snapshots: readonly PreviewSessionSnapshot[]) {
  return {
    serverEpoch: "epoch-1",
    sessions: Object.fromEntries(snapshots.map((entry) => [entry.tabId, entry])),
  };
}

beforeEach(() => {
  capability = "frame";
  sessionsByThreadKey = {};
});

describe("WebBrowserHost", () => {
  it("renders one frame per open tab", () => {
    sessionsByThreadKey = {
      "local:thread-1": threadState(
        snapshot("tab-1", "https://a.example.com/"),
        snapshot("tab-2", "https://b.example.com/"),
      ),
    };

    const markup = renderToStaticMarkup(<WebBrowserHost />);

    expect(markup.match(/<iframe/g)).toHaveLength(2);
    expect(markup).toContain('src="https://a.example.com/"');
    expect(markup).toContain('src="https://b.example.com/"');
  });

  it("renders nothing where the desktop host owns the page surface", () => {
    capability = "webview";
    sessionsByThreadKey = {
      "local:thread-1": threadState(snapshot("tab-1", "https://a.example.com/")),
    };

    expect(renderToStaticMarkup(<WebBrowserHost />)).toBe("");
  });

  it("renders nothing where there is no page surface at all", () => {
    capability = "none";
    sessionsByThreadKey = {
      "local:thread-1": threadState(snapshot("tab-1", "https://a.example.com/")),
    };

    expect(renderToStaticMarkup(<WebBrowserHost />)).toBe("");
  });
});
