import { describe, expect, it } from "vite-plus/test";

import { getPreviewPanelMaxHeight, resizedHeightForPointer } from "./useResizablePanelHeight";

describe("resizedHeightForPointer", () => {
  it("grows a bottom-anchored panel when the pointer moves up", () => {
    expect(resizedHeightForPointer({ start: 600, startHeight: 380, position: 500 })).toBe(480);
  });

  it("shrinks a bottom-anchored panel when the pointer moves down", () => {
    expect(resizedHeightForPointer({ start: 600, startHeight: 380, position: 700 })).toBe(280);
  });
});

describe("getPreviewPanelMaxHeight", () => {
  it("leaves the chat 30% of the viewport when the panel is split off the bottom", () => {
    expect(getPreviewPanelMaxHeight(1_000)).toBe(700);
  });

  it("rounds fractional CSS pixels down", () => {
    expect(getPreviewPanelMaxHeight(1_001)).toBe(700);
  });
});
