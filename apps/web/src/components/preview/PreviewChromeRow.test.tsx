import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vite-plus/test";

import { PreviewChromeRow } from "./PreviewChromeRow";

const BASE = {
  url: "https://task--5733.example.com/",
  loading: false,
  loadProgress: 0,
  canGoBack: false,
  canGoForward: false,
  refreshDisabled: false,
  onRefresh: vi.fn(),
  onSubmit: vi.fn(),
} as const;

describe("PreviewChromeRow", () => {
  it("shows the complete URL while the address bar is not focused", () => {
    const markup = renderToStaticMarkup(
      <PreviewChromeRow
        {...BASE}
        url="https://example.com/dashboard?mode=edit&tab=1#notes"
        onBack={vi.fn()}
        onForward={vi.fn()}
      />,
    );

    expect(markup).toContain('value="https://example.com/dashboard?mode=edit&amp;tab=1#notes"');
  });

  it("renders back and forward where the surface has a history to walk", () => {
    const markup = renderToStaticMarkup(
      <PreviewChromeRow {...BASE} onBack={vi.fn()} onForward={vi.fn()} />,
    );

    expect(markup).toContain('aria-label="Back"');
    expect(markup).toContain('aria-label="Forward"');
  });

  it("omits them entirely where it does not, rather than showing dead buttons", () => {
    const markup = renderToStaticMarkup(<PreviewChromeRow {...BASE} />);

    expect(markup).not.toContain('aria-label="Back"');
    expect(markup).not.toContain('aria-label="Forward"');
    // Refresh survives: replacing a frame is something a browser can do.
    expect(markup).toContain('aria-label="Refresh"');
  });
});
