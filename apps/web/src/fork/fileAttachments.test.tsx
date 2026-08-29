/** Fork-only. Covers the generic-attachment presentation helpers. */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";

import { FileAttachmentChip, formatAttachmentBytes } from "./fileAttachments";

describe("formatAttachmentBytes", () => {
  it("keeps small sizes in bytes", () => {
    expect(formatAttachmentBytes(0)).toBe("0 B");
    expect(formatAttachmentBytes(512)).toBe("512 B");
  });

  it("steps up units and keeps one decimal below ten", () => {
    expect(formatAttachmentBytes(1024)).toBe("1 KB");
    expect(formatAttachmentBytes(1536)).toBe("1.5 KB");
    expect(formatAttachmentBytes(50 * 1024 * 1024)).toBe("50 MB");
  });

  it("does not render a 1024-of-a-unit reading", () => {
    // The boundary that a naive single-division formatter gets wrong.
    expect(formatAttachmentBytes(1024 * 1024)).toBe("1 MB");
    expect(formatAttachmentBytes(1024 * 1024 * 1024)).toBe("1 GB");
  });

  it("is defensive about nonsense input", () => {
    expect(formatAttachmentBytes(-1)).toBe("0 B");
    expect(formatAttachmentBytes(Number.NaN)).toBe("0 B");
  });
});

describe("FileAttachmentChip", () => {
  it("shows the file name and its size", () => {
    const html = renderToStaticMarkup(<FileAttachmentChip name="report.pdf" sizeBytes={2048} />);

    expect(html).toContain("report.pdf");
    expect(html).toContain("2 KB");
  });

  it("is not an image, so it cannot render a broken thumbnail", () => {
    const html = renderToStaticMarkup(<FileAttachmentChip name="notes.txt" sizeBytes={12} />);

    expect(html).not.toContain("<img");
  });
});
