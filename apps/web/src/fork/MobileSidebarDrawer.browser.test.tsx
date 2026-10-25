/**
 * Fork-only. Replaces the deleted MobileSidebarDrawer.test.tsx (upstream dropped
 * react-test-renderer) with the same coverage on real DOM and real Pointer/TouchEvents.
 */
import { type CSSProperties } from "react";
import { describe, expect, it, vi } from "vite-plus/test";

import { act, fakeTimers, render } from "../../test/render";
import { MobileSidebarDrawer } from "./MobileSidebarDrawer";

function panelOf(container: HTMLElement) {
  return container.querySelector<HTMLDivElement>('[data-slot="sidebar"]');
}

function drawerElement(open: boolean, onPanelElementChange: (element: unknown) => void) {
  return (
    <MobileSidebarDrawer
      onOpenChange={() => {}}
      onPanelElementChange={onPanelElementChange}
      open={open}
    />
  );
}

describe("MobileSidebarDrawer onPanelElementChange", () => {
  it("reports the panel while open and null only after the closing slide", async () => {
    const onPanelElementChange = vi.fn();
    // The drawer has no links or navigation, so it needs no router.
    await using screen = await render(drawerElement(true, onPanelElementChange), {
      router: false,
    });
    using _timers = fakeTimers();
    const panel = panelOf(screen.container);
    expect(onPanelElementChange).toHaveBeenLastCalledWith(panel);

    await screen.rerender(drawerElement(false, onPanelElementChange));
    await act(() => vi.advanceTimersByTime(199));
    expect(onPanelElementChange).toHaveBeenLastCalledWith(panel);

    await act(() => vi.advanceTimersByTime(1));
    expect(onPanelElementChange).toHaveBeenLastCalledWith(null);
  });

  it("keeps the panel reported when reopened mid-slide", async () => {
    const onPanelElementChange = vi.fn();
    // The drawer has no links or navigation, so it needs no router.
    await using screen = await render(drawerElement(true, onPanelElementChange), {
      router: false,
    });
    using _timers = fakeTimers();
    await screen.rerender(drawerElement(false, onPanelElementChange));
    await act(() => vi.advanceTimersByTime(100));
    await screen.rerender(drawerElement(true, onPanelElementChange));
    await act(() => vi.advanceTimersByTime(500));
    expect(onPanelElementChange).not.toHaveBeenCalledWith(null);
  });

  it("keeps its width when the caller passes a style", async () => {
    // The drawer has no links or navigation, so it needs no router.
    await using screen = await render(
      <MobileSidebarDrawer
        onOpenChange={() => {}}
        open
        style={{ "--workspace-controls-left": "80px" } as CSSProperties}
      />,
      { router: false },
    );
    const panel = panelOf(screen.container)!;
    expect(panel.style.getPropertyValue("--sidebar-width")).toBe("calc(100vw - 0.75rem)");
    expect(panel.style.getPropertyValue("--workspace-controls-left")).toBe("80px");
  });

  it("reports null on unmount", async () => {
    const onPanelElementChange = vi.fn();
    // The drawer has no links or navigation, so it needs no router.
    await using screen = await render(drawerElement(true, onPanelElementChange), {
      router: false,
    });
    await screen.unmount();
    expect(onPanelElementChange).toHaveBeenLastCalledWith(null);
  });
});

describe("MobileSidebarDrawer row gestures", () => {
  function dispatchPointer(target: EventTarget, type: string, init: PointerEventInit = {}) {
    const event = new PointerEvent(type, { bubbles: true, ...init });
    return act(() => target.dispatchEvent(event));
  }

  async function dispatchTouch(target: Element, type: string, x: number, y: number) {
    const touch = new Touch({ identifier: 1, target, clientX: x, clientY: y });
    const event = new TouchEvent(type, { touches: [touch], bubbles: true, cancelable: true });
    await act(() => target.dispatchEvent(event));
  }

  // A finger lands on a thread row in the open drawer and moves by `dx`, `dy`.
  async function swipeOnRow(row: HTMLElement, dx: number, dy: number) {
    const onPointerCancel = vi.fn();
    row.addEventListener("pointercancel", onPointerCancel);

    await dispatchPointer(row, "pointerdown", {
      isPrimary: true,
      pointerId: 7,
      pointerType: "touch",
    });
    await dispatchTouch(row, "touchstart", 100, 100);
    const firstMove = new PointerEvent("pointermove", { bubbles: true, pointerType: "touch" });
    const stopImmediatePropagation = vi.spyOn(firstMove, "stopImmediatePropagation");
    await act(() => window.dispatchEvent(firstMove));
    await dispatchTouch(row, "touchmove", 100 + dx, 100 + dy);

    return { onPointerCancel, stopImmediatePropagation };
  }

  // Pins the panel and viewport measurements the drag math reads, so a
  // swipe's dx/dy produce the same claimed base and axis lock every run.
  function pinMeasurements() {
    const offsetWidth = vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(320);
    const innerWidth = vi.spyOn(window, "innerWidth", "get").mockReturnValue(390);
    return {
      [Symbol.dispose]() {
        offsetWidth.mockRestore();
        innerWidth.mockRestore();
      },
    };
  }

  it("holds back pointer moves and cancels the row's pointer on a horizontal swipe", async () => {
    using _measurements = pinMeasurements();
    // The drawer has no links or navigation, so it needs no router.
    await using screen = await render(<MobileSidebarDrawer onOpenChange={() => {}} open />, {
      router: false,
    });
    const row = document.createElement("div");
    screen.container.append(row);
    const { onPointerCancel, stopImmediatePropagation } = await swipeOnRow(row, -20, 2);

    expect(stopImmediatePropagation).toHaveBeenCalled();
    expect(onPointerCancel).toHaveBeenCalledOnce();
    expect(onPointerCancel.mock.calls[0]![0]).toMatchObject({
      type: "pointercancel",
      pointerId: 7,
    });
  });

  it("leaves the row's pointer alone once a swipe turns out vertical", async () => {
    using _measurements = pinMeasurements();
    // The drawer has no links or navigation, so it needs no router.
    await using screen = await render(<MobileSidebarDrawer onOpenChange={() => {}} open />, {
      router: false,
    });
    const row = document.createElement("div");
    screen.container.append(row);
    const { onPointerCancel } = await swipeOnRow(row, 2, 20);

    const laterMove = new PointerEvent("pointermove", { bubbles: true, pointerType: "touch" });
    const laterStop = vi.spyOn(laterMove, "stopImmediatePropagation");
    await act(() => window.dispatchEvent(laterMove));

    expect(laterStop).not.toHaveBeenCalled();
    expect(onPointerCancel).not.toHaveBeenCalled();
  });
});
