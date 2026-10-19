/**
 * Fork-only. Upstream removed react-test-renderer and the
 * apps/web/src/test/{reactElementTree,reactHookHarness} helpers in favor of
 * vitest browser mode, so this replaces the deleted MoatlessArtifactChip.test.tsx
 * with the same coverage driven through real DOM.
 */
import type { EnvironmentId, ScopedThreadRef, ThreadId } from "@t3tools/contracts";
import { AsyncResult } from "effect/reactivity";
import { act, type ComponentProps, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

// Tooltip hover/positioning is not under test here; render the trigger plain.
vi.mock(import("~/components/ui/tooltip"), async () => {
  const { isValidElement } = await import("react");
  return {
    Tooltip: (({ children }: { children: ReactNode }) => children) as never,
    TooltipTrigger: (({ render }: { render: ReactNode }) =>
      isValidElement(render) ? render : null) as never,
    TooltipPopup: (() => null) as never,
  };
});
vi.mock(import("~/previewStateStore"), async (importOriginal) => ({
  ...(await importOriginal()),
  isPreviewSupportedInRuntime: () => true,
}));
vi.mock(import("./moatlessArtifactLink"), async (importOriginal) => ({
  ...(await importOriginal()),
  fetchMoatlessArtifactTitle: vi.fn(async () => "SP-3388 rewrite"),
}));

import { MoatlessArtifactChip } from "./MoatlessArtifactChip";

const HREF =
  "https://moatless.example.com/api/v1/artifacts/77e15557-209a-4e15-8e03-d524e230a88b/v1";
const THREAD_REF = {
  environmentId: "moatless-65e765221f33baf0" as EnvironmentId,
  threadId: "c8854591-8bbc-4c6b-b1e7-b531641ae4cd" as ThreadId,
} as ScopedThreadRef;

let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

async function render(props: Partial<ComponentProps<typeof MoatlessArtifactChip>> = {}) {
  const openInPreview = vi.fn(async () => AsyncResult.success(undefined));
  await act(async () => {
    root.render(
      <MoatlessArtifactChip
        href={HREF}
        artifact={{ artifactId: "77e15557-209a-4e15-8e03-d524e230a88b", version: 1 }}
        text={HREF}
        threadRef={THREAD_REF}
        openInPreview={openInPreview}
        {...props}
      />,
    );
  });
  const anchor = container.querySelector("a")!;
  return { anchor, openInPreview };
}

// Dispatching the click directly (rather than clicking through Playwright's
// pointer input) keeps this a synthetic, non-activating event, so an anchor
// whose handler does not call preventDefault never actually navigates away.
function clickAnchor(anchor: HTMLAnchorElement, init: MouseEventInit = {}) {
  const event = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0, ...init });
  act(() => anchor.dispatchEvent(event));
  return event;
}

describe("MoatlessArtifactChip", () => {
  it("shows the published title and version, and keeps the URL as the link", async () => {
    const { anchor } = await render();

    expect(anchor.getAttribute("href")).toBe(HREF);
    await vi.waitFor(() => {
      expect(anchor.getAttribute("aria-label")).toBe("Open artifact SP-3388 rewrite");
    });
    expect(anchor.textContent).toContain("SP-3388 rewrite");
    expect(anchor.querySelector(".tabular-nums")?.textContent).toBe("v1");
  });

  it("opens a plain click in the right panel", async () => {
    const { anchor, openInPreview } = await render();

    const event = clickAnchor(anchor);

    expect(event.defaultPrevented).toBe(true);
    expect(openInPreview).toHaveBeenCalledWith(HREF);
  });

  it("leaves a modifier click to the browser", async () => {
    const { anchor, openInPreview } = await render();

    const event = clickAnchor(anchor, { metaKey: true });

    expect(event.defaultPrevented).toBe(false);
    expect(openInPreview).not.toHaveBeenCalled();
  });

  it("leaves the click to the browser without a thread to open beside", async () => {
    const { anchor, openInPreview } = await render({ threadRef: undefined });

    expect(anchor.getAttribute("aria-label")).toBe("Open artifact Artifact");

    const event = clickAnchor(anchor);

    expect(event.defaultPrevented).toBe(false);
    expect(openInPreview).not.toHaveBeenCalled();
  });
});
