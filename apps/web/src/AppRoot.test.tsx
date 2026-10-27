import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { RouterProvider } from "@tanstack/react-router";
import { describe, expect, it, vi } from "vite-plus/test";

import { ElectronBrowserHost } from "./browser/ElectronBrowserHost";
import { WebBrowserHost } from "./browser/WebBrowserHost";
import { QuitHoldOverlay } from "./components/QuitHoldOverlay";
import { AppAtomRegistryProvider } from "./rpc/atomRegistry";
import type { AppRouter } from "./router";
import { AppRoot } from "./AppRoot";

// `AppRoot` is called as a plain function here, outside a render, so its
// `useEffect` would throw on React's null dispatcher.
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useEffect: () => {},
}));

describe("AppRoot", () => {
  it("shares the application atom registry with routed UI and both browser hosts", () => {
    const root = AppRoot({ router: {} as AppRouter });

    expect(root.type).toBe(AppAtomRegistryProvider);
    const children = Children.toArray(
      (root as ReactElement<{ readonly children: ReactNode }>).props.children,
    );
    expect(children).toHaveLength(4);
    expect(isValidElement(children[0]) && children[0].type).toBe(RouterProvider);
    expect(isValidElement(children[1]) && children[1].type).toBe(ElectronBrowserHost);
    expect(isValidElement(children[2]) && children[2].type).toBe(WebBrowserHost);
    expect(isValidElement(children[3]) && children[3].type).toBe(QuitHoldOverlay);
  });
});
