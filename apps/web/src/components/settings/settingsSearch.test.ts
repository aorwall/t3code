import { describe, expect, it } from "vite-plus/test";

import {
  isMoatlessAdminPath,
  MOATLESS_ADMIN_PATHS,
  searchableSetting,
  searchSettings,
  SETTINGS_SEARCH_ITEMS,
  type SettingsSearchItem,
} from "./settingsSearch";

const ITEMS: ReadonlyArray<SettingsSearchItem> = [
  {
    id: "word-wrap",
    title: "Word wrap",
    to: "/settings/general",
  },
  {
    id: "network-access",
    title: "Network access",
    to: "/settings/connections",
  },
  {
    id: "providers",
    title: "Providers",
    to: "/settings/providers",
  },
  {
    id: "provider-updates",
    title: "Update checks",
    to: "/settings/general",
  },
  {
    id: "automatic-updates",
    title: "Automatic updates",
    to: "/settings/general",
  },
];

describe("searchSettings", () => {
  it("matches only setting titles", () => {
    expect(searchSettings("word", ITEMS).map((item) => item.id)).toEqual(["word-wrap"]);
    expect(searchSettings("network", ITEMS).map((item) => item.id)).toEqual(["network-access"]);
    expect(searchSettings("connections", ITEMS)).toEqual([]);
    expect(searchSettings("claude", ITEMS)).toEqual([]);
  });

  it("matches normalized title substrings", () => {
    expect(searchSettings("  WORD   WRAP  ", ITEMS).map((item) => item.id)).toEqual(["word-wrap"]);
    // Whitespace in the query is collapsed, not dropped, so a run-together
    // query does not match a two-word title.
    expect(searchSettings("wordwrap")).toEqual([]);
  });

  it("keeps catalog order for multiple title matches", () => {
    expect(searchSettings("update", ITEMS).map((item) => item.id)).toEqual([
      "provider-updates",
      "automatic-updates",
    ]);
  });

  it("returns no results for an empty query", () => {
    expect(searchSettings("   ", ITEMS)).toEqual([]);
  });

  it("keeps catalog result ids unique", () => {
    const ids = SETTINGS_SEARCH_ITEMS.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("serves anchor props to panels from the catalog", () => {
    expect(searchableSetting("word-wrap")).toEqual({ id: "word-wrap", title: "Word wrap" });
    expect(searchableSetting("archive")).toEqual({ id: "archive", title: "Archived threads" });
  });

  it("routes appearance settings to their current section", () => {
    expect(searchSettings("theme")[0]).toMatchObject({
      id: "theme",
      to: "/settings/appearance",
    });
    expect(searchSettings("word wrap")[0]).toMatchObject({
      id: "word-wrap",
      to: "/settings/appearance",
    });
    expect(searchSettings("environment identification")[0]).toMatchObject({
      id: "environment-identification",
      to: "/settings/appearance",
      targetId: "appearance",
    });
  });
});

describe("moatless administration entries", () => {
  it("is reachable from search by its own name", () => {
    expect(searchSettings("workspaces").map((item) => item.id)).toContain("workspaces");
  });

  it("sends repositories to the workspace that contains them", () => {
    // Repositories are not a page of their own here; they are a section of a
    // workspace. Searching for one has to land somewhere that exists.
    expect(searchSettings("repositories")[0]).toMatchObject({
      id: "workspace-repositories",
      to: "/settings/workspaces",
    });
  });
});

describe("isMoatlessAdminPath", () => {
  it("recognises every administration page", () => {
    for (const path of MOATLESS_ADMIN_PATHS) {
      expect(isMoatlessAdminPath(path)).toBe(true);
    }
  });

  it("recognises a page below one of them", () => {
    // The guard runs on the concrete pathname, so a workspace detail page has
    // to be admitted by prefix or it is reachable without an admin check.
    expect(isMoatlessAdminPath("/settings/workspaces/ws_1")).toBe(true);
  });

  it("leaves the settings pages this fork did not add alone", () => {
    expect(isMoatlessAdminPath("/settings/general")).toBe(false);
    expect(isMoatlessAdminPath("/settings/appearance")).toBe(false);
  });

  it("does not admit a path that merely starts with an admin path's characters", () => {
    expect(isMoatlessAdminPath("/settings/workspaces-archive")).toBe(false);
  });
});
