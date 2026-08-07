import { EnvironmentId, ThreadId } from "@t3tools/contracts";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it } from "vite-plus/test";

import { HostedBrowserFrame } from "./HostedBrowserFrame";
import { useBrowserSurfaceStore } from "./browserSurfaceStore";
import { hostedFrameKey, reloadHostedFrame, useHostedFrameReloadStore } from "./hostedFrameReload";

const RUNTIME_TAB_ID = "runtime-tab";
const URL = "https://task--5733.example.com/";
const THREAD_REF = {
  environmentId: EnvironmentId.make("environment-1"),
  threadId: ThreadId.make("thread-1"),
} as const;

beforeEach(() => {
  useHostedFrameReloadStore.setState({ byTabId: {} });
  useBrowserSurfaceStore.setState({ byTabId: {} });
});

describe("HostedBrowserFrame", () => {
  it("frames the page with the attributes the security posture fixes", () => {
    const markup = renderToStaticMarkup(
      <HostedBrowserFrame
        threadRef={THREAD_REF}
        tabId="tab-1"
        runtimeTabId={RUNTIME_TAB_ID}
        url={URL}
      />,
    );

    expect(markup).toContain(`src="${URL}"`);
    expect(markup).toContain('sandbox="allow-scripts allow-forms allow-same-origin allow-popups"');
    expect(markup).toContain('referrerPolicy="no-referrer"');
    // No camera, microphone or geolocation delegation.
    expect(markup).not.toContain("allow=");
  });

  it("draws nothing inside a tab that has not been navigated", () => {
    const markup = renderToStaticMarkup(
      <HostedBrowserFrame
        threadRef={THREAD_REF}
        tabId="tab-1"
        runtimeTabId={RUNTIME_TAB_ID}
        url={null}
      />,
    );

    expect(markup).not.toContain("<iframe");
  });

  it("keeps src exactly the tab's URL across a reload", () => {
    reloadHostedFrame(RUNTIME_TAB_ID);
    const markup = renderToStaticMarkup(
      <HostedBrowserFrame
        threadRef={THREAD_REF}
        tabId="tab-1"
        runtimeTabId={RUNTIME_TAB_ID}
        url={URL}
      />,
    );

    expect(markup).toContain(`src="${URL}"`);
    expect(markup).not.toContain("#1");
  });
});

describe("hostedFrameKey", () => {
  it("changes on a reload of the same URL, so the element is replaced", () => {
    expect(hostedFrameKey(URL, 1)).not.toBe(hostedFrameKey(URL, 0));
  });

  it("changes on navigation, so src is never reassigned on a live frame", () => {
    expect(hostedFrameKey(`${URL}settings`, 0)).not.toBe(hostedFrameKey(URL, 0));
  });
});

describe("hostedFrameReload", () => {
  it("counts per tab", () => {
    reloadHostedFrame("a");
    reloadHostedFrame("a");
    reloadHostedFrame("b");

    expect(useHostedFrameReloadStore.getState().byTabId).toEqual({ a: 2, b: 1 });
  });
});
