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

import inventoryRaw from "../../../../docs/fork/inventory.json?raw";
import commandPaletteSource from "../components/CommandPalette.tsx?raw";
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
 * Some gates are read inline rather than through a lookup map, and sit on lines
 * upstream owns and edits. A merge that takes upstream's side of one drops the
 * gate with no type error and no failing assertion anywhere else — threads
 * quietly settle on a stranger's merged PR again. Same missing check as the maps
 * above, in the same idiom.
 *
 * Which symbol has to survive in which file is not restated here: it is read
 * from the `guard` entries in `docs/fork/inventory.json`, so the merge tooling
 * and this test cannot drift apart, and adding a guard needs no change here.
 *
 * The sources are reached through `import.meta.glob` rather than a static
 * `?raw` import per file, because upstream renames these files. A hard-coded
 * specifier turns that rename into an unresolved import — the whole suite fails
 * to build, at a module path, saying nothing about the gate. Going through the
 * glob makes the same rename fail as a named assertion below, which is the
 * finding: the inventory entry needs re-pointing at the file's new home.
 */
const WEB_SOURCE_PREFIX = "apps/web/src/";
const webSources: Record<string, string> = Object.fromEntries(
  Object.entries(
    import.meta.glob("../**/*.{ts,tsx}", {
      query: "?raw",
      import: "default",
      eager: true,
    }) as Record<string, string>,
  ).map(([specifier, source]) => [
    `${WEB_SOURCE_PREFIX}${specifier.replace(/^\.\.\//, "")}`,
    source,
  ]),
);

// Read as text rather than as a JSON module: `node:fs` is not available to this
// package (the Effect lint rule bans node builtins in `apps/web/src`), and a
// bare JSON import would need the file inside the app's own root.
type Guard = { readonly symbol: string; readonly files: readonly string[] };
const inventory = JSON.parse(inventoryRaw) as {
  inventory: readonly { id: string; mustSurvive: string; guard?: Guard }[];
};

const guards = inventory.inventory.flatMap((entry) => {
  const guard = entry.guard;
  if (!guard) return [];
  return guard.files
    .filter((file) => file.startsWith(WEB_SOURCE_PREFIX))
    .map((file) => ({ id: entry.id, mustSurvive: entry.mustSurvive, file, symbol: guard.symbol }));
});

describe("the inventory's delta guards", () => {
  it("has guards to check", () => {
    expect(guards.length).toBeGreaterThan(0);
  });

  for (const { id, mustSurvive, file, symbol } of guards) {
    it(`${id}: ${symbol} survives in ${file}`, () => {
      const source = webSources[file];
      expect(
        source,
        `docs/fork/inventory.json guards ${file}, which no longer exists. ` +
          `Upstream moved it; re-point the ${id} entry at its new home.`,
      ).toBeDefined();
      expect(source, mustSurvive).toContain(symbol);
    });
  }
});
