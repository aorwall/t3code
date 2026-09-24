import { EnvironmentId, type ScopedThreadRef, ThreadId } from "@t3tools/contracts";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vite-plus/test";

vi.mock("./PreviewFaviconIcon", () => ({
  PreviewFaviconIcon: () => <span data-favicon-icon />,
}));

import { PreviewEmptyState } from "./PreviewEmptyState";

const threadRef: ScopedThreadRef = {
  environmentId: EnvironmentId.make("env-1"),
  threadId: ThreadId.make("thread-1"),
};

function render(recentEntries: Array<{ url: string; lastVisitedAt: number; title?: string }> = []) {
  return renderToStaticMarkup(
    <PreviewEmptyState
      threadRef={threadRef}
      recentEntries={recentEntries}
      onRemoveRecent={() => undefined}
      onOpenUrl={() => undefined}
    />,
  );
}

describe("PreviewEmptyState", () => {
  it("keeps the default empty copy when there is nothing to show", () => {
    const html = render();
    expect(html).toContain("No preview yet");
    expect(html).toContain("Type a URL above");
  });

  it("renders recently used URLs", () => {
    const html = render([
      { url: "https://myapp.test/admin#users", lastVisitedAt: Date.now(), title: "Admin" },
    ]);
    expect(html).toContain("Recently used");
    expect(html).toContain("myapp.test/admin#users");
    expect(html).toContain("Admin");
  });

  it("renders an out-of-range lastVisitedAt entry without throwing", () => {
    let html = "";
    expect(() => {
      html = render([{ url: "https://myapp.test/", lastVisitedAt: 1e20 }]);
    }).not.toThrow();
    expect(html).toContain("myapp.test");
    expect(html).toContain("Remove");
  });
});
