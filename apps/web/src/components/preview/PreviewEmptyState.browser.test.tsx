import { EnvironmentId, ThreadId } from "@t3tools/contracts";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { PreviewEmptyState } from "./PreviewEmptyState";

const environmentId = EnvironmentId.make("env-1");
const threadRef = { environmentId, threadId: ThreadId.make("thread-1") };
const onOpenUrl = vi.fn();
const onRemoveRecent = vi.fn();

let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.clearAllMocks();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

async function render(
  recentEntries: Array<{ url: string; lastVisitedAt: number; title?: string }>,
) {
  await act(async () =>
    root.render(
      <PreviewEmptyState
        threadRef={threadRef}
        recentEntries={recentEntries}
        onRemoveRecent={onRemoveRecent}
        onOpenUrl={onOpenUrl}
      />,
    ),
  );
}

function button(name: string) {
  const match = [...container.querySelectorAll("button")].find(
    (element) => element.getAttribute("aria-label") === name || element.textContent?.includes(name),
  );
  expect(match, `button ${name}`).toBeDefined();
  return match!;
}

describe("PreviewEmptyState", () => {
  // Fork: no local-servers group (discovery was removed), so this only covers recents.
  it("lists recent entries, and opens or forgets them", async () => {
    await render([
      { url: "https://myapp.test/admin#users", lastVisitedAt: Date.now(), title: "Admin" },
      { url: "http://localhost:5173/", lastVisitedAt: Date.now(), title: "Recent Local" },
    ]);
    const text = container.textContent;
    expect(text).toContain("Recently used");
    expect(text).not.toContain("Local servers");
    expect(text).toContain("Recent Local");

    await act(async () => button("Admin").click());
    expect(onOpenUrl).toHaveBeenCalledExactlyOnceWith("https://myapp.test/admin#users");

    await act(async () => button("Remove myapp.test/admin#users from history").click());
    expect(onRemoveRecent).toHaveBeenCalledExactlyOnceWith("https://myapp.test/admin#users");
  });

  it("shows only the recents group", async () => {
    await render([{ url: "https://myapp.test/", lastVisitedAt: 0 }]);
    expect(container.textContent).toContain("Recently used");
    expect(container.textContent).not.toContain("Local servers");
  });

  it("keeps the original empty state when there are no recents", async () => {
    await render([]);
    expect(container.textContent).toContain("No preview yet");
  });

  it("shows an entry with an out-of-range lastVisitedAt instead of crashing", async () => {
    await render([{ url: "https://myapp.test/", lastVisitedAt: 1e20 }]);
    expect(container.textContent).toContain("myapp.test");
    button("Remove myapp.test from history");
  });
});
