/**
 * The registry's two lookup maps key off strings that live in upstream code —
 * a settings route path and a palette action's `value`. Nothing type-checks
 * that pairing, and both lookups treat an unknown key as *enabled*, so a
 * rename upstream turns a gate off silently rather than breaking a build.
 *
 * These tests are that missing check: they read the keys back out of the
 * upstream sources rather than restating them.
 */
import { describe, expect, it } from "vite-plus/test";

import chatViewSource from "../components/ChatView.tsx?raw";
import commandPaletteSource from "../components/CommandPalette.tsx?raw";
import sidebarSource from "../components/Sidebar.tsx?raw";
import connectionsRouteSource from "../routes/settings.connections.tsx?raw";
import diagnosticsRouteSource from "../routes/settings.diagnostics.tsx?raw";
import keybindingsRouteSource from "../routes/settings.keybindings.tsx?raw";
import providersRouteSource from "../routes/settings.providers.tsx?raw";
import sourceControlRouteSource from "../routes/settings.source-control.tsx?raw";
import {
  FEATURE_BY_PALETTE_ACTION,
  FEATURE_BY_SETTINGS_PATH,
  FEATURES,
  paletteActionEnabled,
  settingsPathEnabled,
} from "./features";

const ROUTE_SOURCES: Readonly<Record<string, string>> = {
  "/settings/keybindings": keybindingsRouteSource,
  "/settings/providers": providersRouteSource,
  "/settings/source-control": sourceControlRouteSource,
  "/settings/connections": connectionsRouteSource,
  "/settings/diagnostics": diagnosticsRouteSource,
};

describe("the settings path map", () => {
  it("names only paths that have a route", () => {
    for (const path of Object.keys(FEATURE_BY_SETTINGS_PATH)) {
      expect(ROUTE_SOURCES[path]).toContain(`createFileRoute("${path}")`);
    }
  });

  it("leaves unlisted paths reachable", () => {
    expect(settingsPathEnabled("/settings/general")).toBe(true);
    expect(settingsPathEnabled("/settings/appearance")).toBe(true);
  });

  it("refuses a listed path whose feature is off", () => {
    for (const [path, feature] of Object.entries(FEATURE_BY_SETTINGS_PATH)) {
      expect(settingsPathEnabled(path)).toBe(FEATURES[feature]);
    }
  });
});

describe("the palette action map", () => {
  it("names only values the palette actually pushes", () => {
    for (const value of Object.keys(FEATURE_BY_PALETTE_ACTION)) {
      expect(commandPaletteSource).toContain(`value: "${value}"`);
    }
  });

  it("leaves unlisted actions offered", () => {
    expect(paletteActionEnabled("action:new-thread")).toBe(true);
  });

  it("refuses a listed action whose feature is off", () => {
    for (const [value, feature] of Object.entries(FEATURE_BY_PALETTE_ACTION)) {
      expect(paletteActionEnabled(value)).toBe(FEATURES[feature]);
    }
  });
});

/**
 * `prThreadSettling` is read inline rather than through a lookup map, and both
 * of its gates sit on a line upstream owns and edits. A merge that takes
 * upstream's side of either one drops the gate with no type error and no
 * failing assertion anywhere else — threads quietly settle on a stranger's
 * merged PR again. Same missing check as the maps above, in the same idiom.
 */
describe("the PR-settling gate", () => {
  it("survives on both surfaces that resolve a settled state", () => {
    for (const source of [sidebarSource, chatViewSource]) {
      expect(source).toContain("FEATURES.prThreadSettling");
    }
  });
});

/**
 * `serverUpdateBanner` is also read inline, on the composer-banner line
 * upstream owns in `ChatView`. A merge taking upstream's side drops the gate
 * with no type error, and the "Server update available" banner and its
 * `npx t3` command return against a Moatless server that cannot run them.
 * Same missing check as above, in the same idiom.
 */
describe("the server-update-banner gate", () => {
  it("survives on the composer banner it guards", () => {
    expect(chatViewSource).toContain("FEATURES.serverUpdateBanner");
  });
});
