import type { EnvironmentId, ScopedThreadRef, ThreadId } from "@t3tools/contracts";
import { AsyncResult } from "effect/unstable/reactivity";
import { act, type ComponentProps, type ReactNode } from "react";
import { create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

vi.mock("~/components/ui/tooltip", async () => {
  const { isValidElement } = await import("react");
  return {
    Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
    TooltipTrigger: ({ render }: { render: ReactNode }) => (isValidElement(render) ? render : null),
    TooltipPopup: () => null,
  };
});
vi.mock("~/previewStateStore", () => ({ isPreviewSupportedInRuntime: () => true }));
vi.mock("./moatlessArtifactLink", () => ({
  fetchMoatlessArtifactTitle: vi.fn(async () => "SP-3388 rewrite"),
}));

import { MoatlessArtifactChip } from "./MoatlessArtifactChip";

const HREF =
  "https://moatless.example.com/api/v1/artifacts/77e15557-209a-4e15-8e03-d524e230a88b/v1";
const THREAD_REF = {
  environmentId: "moatless-65e765221f33baf0" as EnvironmentId,
  threadId: "c8854591-8bbc-4c6b-b1e7-b531641ae4cd" as ThreadId,
} as ScopedThreadRef;

async function render(props: Partial<ComponentProps<typeof MoatlessArtifactChip>> = {}) {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const openInPreview = vi.fn(async () => AsyncResult.success(undefined));
  let renderer: ReactTestRenderer | undefined;
  await act(async () => {
    renderer = create(
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
  return { renderer: renderer!, anchor: renderer!.root.findByType("a"), openInPreview };
}

function click(modifiers: Partial<Record<"metaKey" | "ctrlKey", boolean>> = {}) {
  return {
    button: 0,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    defaultPrevented: false,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    ...modifiers,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("MoatlessArtifactChip", () => {
  it("shows the published title and version, and keeps the URL as the link", async () => {
    const { renderer, anchor } = await render();
    expect(anchor.props.href).toBe(HREF);
    expect(anchor.props["aria-label"]).toBe("Open artifact SP-3388 rewrite");
    const text = JSON.stringify(renderer.toJSON());
    expect(text).toContain("SP-3388 rewrite");
    expect(text).toMatch(/"v","?1"?/);
  });

  it("opens a plain click in the right panel", async () => {
    const { anchor, openInPreview } = await render();
    const event = click();
    await act(async () => anchor.props.onClick(event));
    expect(event.preventDefault).toHaveBeenCalled();
    expect(openInPreview).toHaveBeenCalledWith(HREF);
  });

  it("leaves a modifier click to the browser", async () => {
    const { anchor, openInPreview } = await render();
    const event = click({ metaKey: true });
    await act(async () => anchor.props.onClick(event));
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(openInPreview).not.toHaveBeenCalled();
  });

  it("leaves the click to the browser without a thread to open beside", async () => {
    const { anchor, openInPreview } = await render({ threadRef: undefined });
    expect(anchor.props["aria-label"]).toBe("Open artifact Artifact");
    await act(async () => anchor.props.onClick(click()));
    expect(openInPreview).not.toHaveBeenCalled();
  });
});
