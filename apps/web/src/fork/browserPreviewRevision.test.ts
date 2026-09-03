import { describe, expect, it } from "vite-plus/test";

import { browserPreviewFrameRevision } from "./browserPreviewRevision";

describe("browserPreviewFrameRevision", () => {
  const page = { contents: "<h1>Report</h1>", byteLength: 15 };

  it("holds the frame's identity while the page is unchanged", () => {
    expect(browserPreviewFrameRevision({ ...page })).toBe(browserPreviewFrameRevision({ ...page }));
  });

  it("moves when the page's bytes change", () => {
    expect(
      browserPreviewFrameRevision({ contents: "<h1>Report v2</h1>", byteLength: 18 }),
    ).not.toBe(browserPreviewFrameRevision(page));
  });

  it("moves when a file past the read cut grows without its excerpt changing", () => {
    expect(browserPreviewFrameRevision({ ...page, byteLength: 2_000_000 })).not.toBe(
      browserPreviewFrameRevision({ ...page, byteLength: 3_000_000 }),
    );
  });

  it("declines to answer for a file it has no bytes for", () => {
    expect(browserPreviewFrameRevision(null)).toBeNull();
  });
});
