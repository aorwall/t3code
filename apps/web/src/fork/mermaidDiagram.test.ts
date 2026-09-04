import { describe, expect, it } from "vite-plus/test";

import { mermaidCacheKey, resolveMermaidBlockPresentation } from "./mermaidDiagram";

describe("resolveMermaidBlockPresentation", () => {
  it("draws a diagram once the source has been rendered", () => {
    expect(
      resolveMermaidBlockPresentation({
        status: "ready",
        isStreaming: false,
        sourceRequested: false,
      }),
    ).toEqual({ view: "diagram", canToggleSource: true });
  });

  it("shows the source while the fence is still arriving, even with a diagram in hand", () => {
    // A cached diagram from an earlier render is exactly the case that would
    // otherwise show a stale picture over source that has since changed.
    expect(
      resolveMermaidBlockPresentation({
        status: "ready",
        isStreaming: true,
        sourceRequested: false,
      }),
    ).toEqual({ view: "source", canToggleSource: false });
  });

  it("shows plain source while mermaid is still loading", () => {
    expect(
      resolveMermaidBlockPresentation({
        status: "pending",
        isStreaming: false,
        sourceRequested: false,
      }),
    ).toEqual({ view: "source", canToggleSource: false });
  });

  it("says so when the source will not parse, and offers no way back to a diagram", () => {
    expect(
      resolveMermaidBlockPresentation({
        status: "failed",
        isStreaming: false,
        sourceRequested: true,
      }),
    ).toEqual({ view: "source-with-error", canToggleSource: false });
  });

  it("keeps the toggle available once the source is the thing being shown", () => {
    expect(
      resolveMermaidBlockPresentation({
        status: "ready",
        isStreaming: false,
        sourceRequested: true,
      }),
    ).toEqual({ view: "source", canToggleSource: true });
  });
});

describe("mermaidCacheKey", () => {
  it("separates the themes, because the colors are baked into the SVG", () => {
    const code = "graph TD; A-->B;";
    expect(mermaidCacheKey(code, "light")).not.toBe(mermaidCacheKey(code, "dark"));
  });

  it("separates diagrams that differ only in length", () => {
    expect(mermaidCacheKey("graph TD; A-->B;", "light")).not.toBe(
      mermaidCacheKey("graph TD; A-->B; ", "light"),
    );
  });
});
