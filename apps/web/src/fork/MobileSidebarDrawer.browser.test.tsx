/**
 * Fork-only. Upstream removed react-test-renderer and the
 * apps/web/src/test/{reactElementTree,reactHookHarness} helpers in favor of
 * vitest browser mode, so this replaces the deleted MobileSidebarDrawer.test.tsx
 * with the same coverage driven through real DOM. The row-gesture suite also
 * trades the original's fake window/document listener maps for real
 * PointerEvent/TouchEvent dispatch, now that a real Chromium is available.
 */
import { act, type CSSProperties } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { MobileSidebarDrawer } from "./MobileSidebarDrawer";

function panelOf(container: HTMLElement) {
  return container.querySelector<HTMLDivElement>('[data-slot="sidebar"]');
}

describe("MobileSidebarDrawer onPanelElementChange", () => {
  // Each test owns its own container/root, mirroring the deleted test's
  // per-test renderer, so the explicit-unmount test doesn't double-unmount.
  const mounted: Array<{ root: Root; container: HTMLDivElement }> = [];

  function mountDrawer(open: boolean, onPanelElementChange: (element: unknown) => void) {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    mounted.push({ root, container });
    act(() => {
      root.render(
        <MobileSidebarDrawer
          onOpenChange={() => {}}
          onPanelElementChange={onPanelElementChange}
          open={open}
        />,
      );
    });
    return {
      panel: () => panelOf(container),
      rerender(nextOpen: boolean) {
        act(() => {
          root.render(
            <MobileSidebarDrawer
              onOpenChange={() => {}}
              onPanelElementChange={onPanelElementChange}
              open={nextOpen}
            />,
          );
        });
      },
      unmount() {
        const index = mounted.findIndex((entry) => entry.container === container);
        if (index >= 0) mounted.splice(index, 1);
        act(() => root.unmount());
        container.remove();
      },
    };
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  });

  afterEach(() => {
    for (const { root, container } of mounted.splice(0)) {
      act(() => root.unmount());
      container.remove();
    }
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("reports the panel while open and null only after the closing slide", () => {
    const onPanelElementChange = vi.fn();
    const drawer = mountDrawer(true, onPanelElementChange);
    const panel = drawer.panel();
    expect(onPanelElementChange).toHaveBeenLastCalledWith(panel);

    drawer.rerender(false);
    act(() => vi.advanceTimersByTime(199));
    expect(onPanelElementChange).toHaveBeenLastCalledWith(panel);

    act(() => vi.advanceTimersByTime(1));
    expect(onPanelElementChange).toHaveBeenLastCalledWith(null);
  });

  it("keeps the panel reported when reopened mid-slide", () => {
    const onPanelElementChange = vi.fn();
    const drawer = mountDrawer(true, onPanelElementChange);
    drawer.rerender(false);
    act(() => vi.advanceTimersByTime(100));
    drawer.rerender(true);
    act(() => vi.advanceTimersByTime(500));
    expect(onPanelElementChange).not.toHaveBeenCalledWith(null);
  });

  it("keeps its width when the caller passes a style", () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    mounted.push({ root, container });
    act(() => {
      root.render(
        <MobileSidebarDrawer
          onOpenChange={() => {}}
          open
          style={{ "--workspace-controls-left": "80px" } as CSSProperties}
        />,
      );
    });
    const panel = panelOf(container)!;
    expect(panel.style.getPropertyValue("--sidebar-width")).toBe("calc(100vw - 0.75rem)");
    expect(panel.style.getPropertyValue("--workspace-controls-left")).toBe("80px");
  });

  it("reports null on unmount", () => {
    const onPanelElementChange = vi.fn();
    const drawer = mountDrawer(true, onPanelElementChange);
    drawer.unmount();
    expect(onPanelElementChange).toHaveBeenLastCalledWith(null);
  });
});

describe("MobileSidebarDrawer row gestures", () => {
  let root: Root;
  let container: HTMLDivElement;
  let row: HTMLDivElement;

  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    // Pins the panel and viewport measurements the drag math reads, so a
    // swipe's dx/dy produce the same claimed base and axis lock every run.
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(320);
    vi.spyOn(window, "innerWidth", "get").mockReturnValue(390);
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    row = document.createElement("div");
    document.body.append(row);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    row.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function dispatchPointer(target: EventTarget, type: string, init: PointerEventInit = {}) {
    const event = new PointerEvent(type, { bubbles: true, ...init });
    act(() => target.dispatchEvent(event));
    return event;
  }

  function dispatchTouch(target: Element, type: string, x: number, y: number) {
    const touch = new Touch({ identifier: 1, target, clientX: x, clientY: y });
    const event = new TouchEvent(type, { touches: [touch], bubbles: true, cancelable: true });
    act(() => target.dispatchEvent(event));
    return event;
  }

  // A finger lands on a thread row in the open drawer and moves by `dx`, `dy`.
  function swipeOnRow(dx: number, dy: number) {
    act(() => {
      root.render(<MobileSidebarDrawer onOpenChange={() => {}} open />);
    });
    const onPointerCancel = vi.fn();
    row.addEventListener("pointercancel", onPointerCancel);

    dispatchPointer(row, "pointerdown", { isPrimary: true, pointerId: 7, pointerType: "touch" });
    dispatchTouch(row, "touchstart", 100, 100);
    const firstMove = new PointerEvent("pointermove", { bubbles: true, pointerType: "touch" });
    const stopImmediatePropagation = vi.spyOn(firstMove, "stopImmediatePropagation");
    act(() => window.dispatchEvent(firstMove));
    dispatchTouch(row, "touchmove", 100 + dx, 100 + dy);

    return { onPointerCancel, stopImmediatePropagation };
  }

  it("holds back pointer moves and cancels the row's pointer on a horizontal swipe", () => {
    const { onPointerCancel, stopImmediatePropagation } = swipeOnRow(-20, 2);

    expect(stopImmediatePropagation).toHaveBeenCalled();
    expect(onPointerCancel).toHaveBeenCalledOnce();
    expect(onPointerCancel.mock.calls[0]![0]).toMatchObject({
      type: "pointercancel",
      pointerId: 7,
    });
  });

  it("leaves the row's pointer alone once a swipe turns out vertical", () => {
    const { onPointerCancel } = swipeOnRow(2, 20);

    const laterMove = new PointerEvent("pointermove", { bubbles: true, pointerType: "touch" });
    const laterStop = vi.spyOn(laterMove, "stopImmediatePropagation");
    act(() => window.dispatchEvent(laterMove));

    expect(laterStop).not.toHaveBeenCalled();
    expect(onPointerCancel).not.toHaveBeenCalled();
  });
});
