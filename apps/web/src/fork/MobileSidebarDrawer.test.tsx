import { act, type CSSProperties } from "react";
import { create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { MobileSidebarDrawer } from "./MobileSidebarDrawer";

const PANEL = { offsetWidth: 320 };

function render(open: boolean, onPanelElementChange: (element: unknown) => void) {
  let renderer: ReactTestRenderer | undefined;
  act(() => {
    renderer = create(
      <MobileSidebarDrawer
        onOpenChange={() => {}}
        onPanelElementChange={onPanelElementChange}
        open={open}
      />,
      { createNodeMock: (element) => (element.type === "div" ? PANEL : null) },
    );
  });
  return {
    rerender(nextOpen: boolean) {
      act(() => {
        renderer!.update(
          <MobileSidebarDrawer
            onOpenChange={() => {}}
            onPanelElementChange={onPanelElementChange}
            open={nextOpen}
          />,
        );
      });
    },
    unmount() {
      act(() => renderer!.unmount());
    },
  };
}

describe("MobileSidebarDrawer onPanelElementChange", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    const listeners = { addEventListener: () => {}, removeEventListener: () => {} };
    vi.stubGlobal("document", { ...listeners, body: { style: { overflow: "" } } });
    vi.stubGlobal("window", {
      ...listeners,
      innerWidth: 390,
      setTimeout: globalThis.setTimeout,
      clearTimeout: globalThis.clearTimeout,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("reports the panel while open and null only after the closing slide", () => {
    const onPanelElementChange = vi.fn();
    const drawer = render(true, onPanelElementChange);
    expect(onPanelElementChange).toHaveBeenLastCalledWith(PANEL);

    drawer.rerender(false);
    act(() => vi.advanceTimersByTime(199));
    expect(onPanelElementChange).toHaveBeenLastCalledWith(PANEL);

    act(() => vi.advanceTimersByTime(1));
    expect(onPanelElementChange).toHaveBeenLastCalledWith(null);
  });

  it("keeps the panel reported when reopened mid-slide", () => {
    const onPanelElementChange = vi.fn();
    const drawer = render(true, onPanelElementChange);
    drawer.rerender(false);
    act(() => vi.advanceTimersByTime(100));
    drawer.rerender(true);
    act(() => vi.advanceTimersByTime(500));
    expect(onPanelElementChange).not.toHaveBeenCalledWith(null);
  });

  it("keeps its width when the caller passes a style", () => {
    let renderer: ReactTestRenderer | undefined;
    act(() => {
      renderer = create(
        <MobileSidebarDrawer
          onOpenChange={() => {}}
          open
          style={{ "--workspace-controls-left": "80px" } as CSSProperties}
        />,
      );
    });
    const panel = renderer!.root.findByProps({ "data-slot": "sidebar" });
    expect(panel.props.style).toMatchObject({
      "--sidebar-width": "calc(100vw - 0.75rem)",
      "--workspace-controls-left": "80px",
    });
  });

  it("reports null on unmount", () => {
    const onPanelElementChange = vi.fn();
    const drawer = render(true, onPanelElementChange);
    drawer.unmount();
    expect(onPanelElementChange).toHaveBeenLastCalledWith(null);
  });
});

describe("MobileSidebarDrawer row gestures", () => {
  type Listener = (event: object) => void;
  let windowListeners: Map<string, Listener>;
  let documentListeners: Map<string, Listener>;
  const fakeTarget = (listeners: Map<string, Listener>) => ({
    addEventListener: (type: string, listener: Listener) => listeners.set(type, listener),
    removeEventListener: (type: string) => listeners.delete(type),
  });

  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    windowListeners = new Map();
    documentListeners = new Map();
    vi.stubGlobal("document", {
      ...fakeTarget(documentListeners),
      body: { style: { overflow: "" } },
    });
    vi.stubGlobal("window", { ...fakeTarget(windowListeners), innerWidth: 390 });
    vi.stubGlobal(
      "PointerEvent",
      class extends Event {
        readonly pointerId: number;
        constructor(type: string, init: { pointerId: number }) {
          super(type);
          this.pointerId = init.pointerId;
        }
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // A finger lands on a thread row in the open drawer and moves by `dx`, `dy`.
  function swipeOnRow(dx: number, dy: number) {
    act(() => {
      create(<MobileSidebarDrawer onOpenChange={() => {}} open />, {
        createNodeMock: () => PANEL,
      });
    });
    const row = { dispatchEvent: vi.fn() };
    const touch = (x: number, y: number) => ({ touches: [{ clientX: x, clientY: y }] });
    const pointerMove = { pointerType: "touch", stopImmediatePropagation: vi.fn() };
    act(() => {
      windowListeners.get("pointerdown")!({
        isPrimary: true,
        pointerId: 7,
        pointerType: "touch",
        target: row,
      });
      documentListeners.get("touchstart")!({ ...touch(100, 100), preventDefault: () => {} });
      windowListeners.get("pointermove")!(pointerMove);
      documentListeners.get("touchmove")!({
        ...touch(100 + dx, 100 + dy),
        preventDefault: () => {},
      });
    });
    return { row, pointerMove };
  }

  it("holds back pointer moves and cancels the row's pointer on a horizontal swipe", () => {
    const { row, pointerMove } = swipeOnRow(-20, 2);
    expect(pointerMove.stopImmediatePropagation).toHaveBeenCalled();
    expect(row.dispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "pointercancel", pointerId: 7 }),
    );
  });

  it("leaves the row's pointer alone once a swipe turns out vertical", () => {
    const { row } = swipeOnRow(2, 20);
    const laterMove = { pointerType: "touch", stopImmediatePropagation: vi.fn() };
    windowListeners.get("pointermove")!(laterMove);
    expect(laterMove.stopImmediatePropagation).not.toHaveBeenCalled();
    expect(row.dispatchEvent).not.toHaveBeenCalled();
  });
});
