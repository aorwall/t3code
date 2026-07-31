import { RouterProvider } from "@tanstack/react-router";

import { ElectronBrowserHost } from "./browser/ElectronBrowserHost";
import { WebBrowserHost } from "./browser/WebBrowserHost";
import { PreviewAutomationHosts } from "./components/preview/PreviewAutomationHosts";
import { AppAtomRegistryProvider } from "./rpc/atomRegistry";
import type { AppRouter } from "./router";

/**
 * Owns renderer-wide providers. The browser hosts intentionally sit outside the
 * router so their pages survive route transitions, but they must share the same
 * atom registry as routed UI. Exactly one of the two renders anything: the
 * Electron host in the desktop app, the web host everywhere else.
 */
export function AppRoot({ router }: { readonly router: AppRouter }) {
  return (
    <AppAtomRegistryProvider>
      <RouterProvider router={router} />
      <PreviewAutomationHosts />
      <ElectronBrowserHost />
      <WebBrowserHost />
    </AppAtomRegistryProvider>
  );
}
