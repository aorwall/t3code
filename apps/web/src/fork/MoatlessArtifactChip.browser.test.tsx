/**
 * Fork-only. Upstream removed react-test-renderer and the
 * apps/web/src/test/{reactElementTree,reactHookHarness} helpers in favor of
 * vitest browser mode, so this replaces the deleted MoatlessArtifactChip.test.tsx
 * with the same coverage driven through real DOM.
 */
import type { EnvironmentId, ScopedThreadRef, ThreadId } from "@t3tools/contracts";
import { AsyncResult } from "effect/reactivity";
import type { ComponentProps, ReactNode } from "react";
import { describe, expect, it, vi } from "vite-plus/test";

import { act, render } from "../../test/render";

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

function chipElement(
  openInPreview: ComponentProps<typeof MoatlessArtifactChip>["openInPreview"],
  props: Partial<ComponentProps<typeof MoatlessArtifactChip>> = {},
) {
  return (
    <MoatlessArtifactChip
      href={HREF}
      artifact={{ artifactId: "77e15557-209a-4e15-8e03-d524e230a88b", version: 1 }}
      text={HREF}
      threadRef={THREAD_REF}
      openInPreview={openInPreview}
      {...props}
    />
  );
}

async function findAnchor(container: HTMLElement) {
  return vi.waitFor(() => {
    const anchor = container.querySelector("a");
    if (!anchor) throw new Error("No anchor rendered");
    return anchor;
  });
}

// Dispatching the click directly (rather than clicking through Playwright's
// pointer input) keeps this a synthetic, non-activating event, so an anchor
// whose handler does not call preventDefault never actually navigates away.
async function clickAnchor(anchor: HTMLAnchorElement, init: MouseEventInit = {}) {
  const event = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0, ...init });
  await act(() => anchor.dispatchEvent(event));
  return event;
}

describe("MoatlessArtifactChip", () => {
  it("shows the published title and version, and keeps the URL as the link", async () => {
    await using screen = await render(
      chipElement(vi.fn(async () => AsyncResult.success(undefined))),
    );
    const anchor = await findAnchor(screen.container);

    expect(anchor.getAttribute("href")).toBe(HREF);
    await vi.waitFor(() => {
      expect(anchor.getAttribute("aria-label")).toBe("Open artifact SP-3388 rewrite");
    });
    expect(anchor.textContent).toContain("SP-3388 rewrite");
    expect(anchor.querySelector(".tabular-nums")?.textContent).toBe("v1");
  });

  it("opens a plain click in the right panel", async () => {
    const openInPreview = vi.fn(async () => AsyncResult.success(undefined));
    await using screen = await render(chipElement(openInPreview));
    const anchor = await findAnchor(screen.container);

    const event = await clickAnchor(anchor);

    expect(event.defaultPrevented).toBe(true);
    expect(openInPreview).toHaveBeenCalledWith(HREF);
  });

  it("leaves a modifier click to the browser", async () => {
    const openInPreview = vi.fn(async () => AsyncResult.success(undefined));
    await using screen = await render(chipElement(openInPreview));
    const anchor = await findAnchor(screen.container);

    const event = await clickAnchor(anchor, { metaKey: true });

    expect(event.defaultPrevented).toBe(false);
    expect(openInPreview).not.toHaveBeenCalled();
  });

  it("leaves the click to the browser without a thread to open beside", async () => {
    const openInPreview = vi.fn(async () => AsyncResult.success(undefined));
    await using screen = await render(chipElement(openInPreview, { threadRef: undefined }));
    const anchor = await findAnchor(screen.container);

    expect(anchor.getAttribute("aria-label")).toBe("Open artifact Artifact");

    const event = await clickAnchor(anchor);

    expect(event.defaultPrevented).toBe(false);
    expect(openInPreview).not.toHaveBeenCalled();
  });
});
