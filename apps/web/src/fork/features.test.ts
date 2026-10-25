/**
 * The registry's lookup maps key off upstream strings (a settings route path, a palette `value`).
 * Unknown keys count as *enabled*, so an upstream rename silently turns a gate off.
 * These tests read the keys back out of the upstream sources rather than restating them.
 */
import { describe, expect, it } from "vite-plus/test";

import inventoryRaw from "../../../../docs/fork/inventory.json?raw";
import commandPaletteSource from "../components/CommandPalette.tsx?raw";
import connectionsRouteSource from "../routes/settings.connections.tsx?raw";
import diagnosticsRouteSource from "../routes/settings.diagnostics.tsx?raw";
import keybindingsRouteSource from "../routes/settings.keybindings.tsx?raw";
import providersRouteSource from "../routes/settings.providers.tsx?raw";
import scheduledTasksRouteSource from "../routes/settings.scheduled-tasks.tsx?raw";
import snapShotRouteSource from "../routes/settings.snap-shot.tsx?raw";
import sourceControlRouteSource from "../routes/settings.source-control.tsx?raw";
import type { ExecutionEnvironmentDescriptor } from "@t3tools/contracts";
import { afterEach } from "vite-plus/test";

import {
  filterAvailableSettingsSearchItems,
  SETTINGS_SEARCH_ITEMS,
} from "../components/settings/settingsSearch";
import {
  applyPrimaryEnvironmentDescriptor,
  FEATURE_BY_PALETTE_ACTION,
  FEATURE_BY_SETTINGS_PATH,
  FEATURE_BY_SETTINGS_SEARCH_ID,
  FEATURES,
  moatlessApiAvailable,
  paletteActionEnabled,
  settingsPathEnabled,
  settingsSearchItemEnabled,
  signInPath,
} from "./features";

function descriptorWith(
  capabilities: ExecutionEnvironmentDescriptor["capabilities"],
): ExecutionEnvironmentDescriptor {
  return {
    environmentId: "env" as ExecutionEnvironmentDescriptor["environmentId"],
    label: "Server",
    platform: { os: "linux", arch: "x64" },
    serverVersion: "1.0.0",
    capabilities,
  };
}

afterEach(() => {
  applyPrimaryEnvironmentDescriptor(null);
});

describe("the primary environment's descriptor", () => {
  it("shows every surface to a T3 server, which lists none", () => {
    applyPrimaryEnvironmentDescriptor(descriptorWith({ repositoryIdentity: true }));

    expect(Object.values(FEATURES).every(Boolean)).toBe(true);
    expect(moatlessApiAvailable()).toBe(false);
    expect(signInPath()).toBe("/pair");
    expect(settingsPathEnabled("/settings/version-control")).toBe(false);
  });

  it("hides what a Moatless server lists and nothing else", () => {
    applyPrimaryEnvironmentDescriptor(
      descriptorWith({
        repositoryIdentity: false,
        moatlessApi: true,
        unsupportedSurfaces: ["turnDiffs", "connections", "aSurfaceThisClientLacks"],
      }),
    );

    expect(FEATURES.turnDiffs).toBe(false);
    expect(FEATURES.openInEditor).toBe(true);
    expect(settingsPathEnabled("/settings/connections")).toBe(false);
    expect(settingsPathEnabled("/settings/version-control")).toBe(true);
    expect(signInPath()).toBe("/login");
  });

  it("survives a spread, which is how tests override one surface", () => {
    applyPrimaryEnvironmentDescriptor(
      descriptorWith({ repositoryIdentity: false, unsupportedSurfaces: ["deviceHub"] }),
    );

    expect({ ...FEATURES, turnDiffs: false }).toMatchObject({ deviceHub: false, turnDiffs: false });
  });
});

const ROUTE_SOURCES: Readonly<Record<string, string>> = {
  "/settings/keybindings": keybindingsRouteSource,
  "/settings/snap-shot": snapShotRouteSource,
  "/settings/providers": providersRouteSource,
  "/settings/source-control": sourceControlRouteSource,
  "/settings/connections": connectionsRouteSource,
  "/settings/diagnostics": diagnosticsRouteSource,
  "/settings/scheduled-tasks": scheduledTasksRouteSource,
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

describe("the settings search id map", () => {
  const availableIds = new Set(
    filterAvailableSettingsSearchItems({
      hasCloudPublicConfig: true,
      hasEnvironment: true,
      hasProviderSettingsEnvironment: true,
      hasMacProviderSettingsEnvironment: true,
      canManageLocalBackend: true,
      isWslSettingsRowVisible: true,
      hasThreadAutoSettlement: true,
      forgejoEnabled: true,
    }).map((item) => item.id),
  );

  it("names only ids that are search items", () => {
    const ids = new Set<string>(SETTINGS_SEARCH_ITEMS.map((item) => item.id));
    for (const id of Object.keys(FEATURE_BY_SETTINGS_SEARCH_ID)) {
      expect(ids.has(id), id).toBe(true);
    }
  });

  it("leaves unlisted ids searchable", () => {
    expect(settingsSearchItemEnabled("time-format")).toBe(true);
    expect(availableIds.has("time-format")).toBe(true);
  });

  it("drops a listed id whose feature is off from the available items", () => {
    for (const [id, feature] of Object.entries(FEATURE_BY_SETTINGS_SEARCH_ID)) {
      expect(settingsSearchItemEnabled(id)).toBe(FEATURES[feature]);
      expect(availableIds.has(id), id).toBe(FEATURES[feature]);
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
 * Some gates are read inline on lines upstream edits; a merge taking upstream's side drops
 * the gate with no type error or failing test. Which symbol must survive in which file is read
 * from the `guard` entries in `docs/fork/inventory.json`.
 * Sources load via `import.meta.glob` so an upstream rename fails as a named assertion.
 */
const WEB_SOURCE_PREFIX = "apps/web/src/";
const FORK_SOURCE_PREFIX = "apps/web/src/fork/";

/** A glob key is relative to this file, and a sibling comes back as `./name.ts`
    rather than `../fork/name.ts` — so a guard on a fork-only file reads as a
    file that no longer exists unless both shapes resolve. */
function repoPath(specifier: string): string {
  return specifier.startsWith("../")
    ? `${WEB_SOURCE_PREFIX}${specifier.slice("../".length)}`
    : `${FORK_SOURCE_PREFIX}${specifier.replace(/^\.\//, "")}`;
}

const webSources: Record<string, string> = Object.fromEntries(
  Object.entries(
    import.meta.glob("../**/*.{ts,tsx}", {
      query: "?raw",
      import: "default",
      eager: true,
    }) as Record<string, string>,
  ).map(([specifier, source]) => [repoPath(specifier), source]),
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

  it.each(guards)("$id: $symbol survives in $file", ({ id, mustSurvive, file, symbol }) => {
    const source = webSources[file];
    expect(
      source,
      `docs/fork/inventory.json guards ${file}, which no longer exists. ` +
        `Upstream moved it; re-point the ${id} entry at its new home.`,
    ).toBeDefined();
    expect(source, mustSurvive).toContain(symbol);
  });
});
