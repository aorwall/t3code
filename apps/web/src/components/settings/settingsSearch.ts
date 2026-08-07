export type SettingsPath =
  | "/settings/general"
  | "/settings/appearance"
  | "/settings/keybindings"
  | "/settings/providers"
  | "/settings/source-control"
  | "/settings/connections"
  | "/settings/beta"
  | "/settings/archived"
  | MoatlessAdminPath;

/**
 * Settings pages that administer the Moatless deployment rather than this
 * client. Fork-only, and split out so the nav and the route guard can name the
 * group without listing its members twice.
 */
export type MoatlessAdminPath =
  | "/settings/workspaces"
  | "/settings/loops"
  | "/settings/integrations"
  | "/settings/skills"
  | "/settings/secrets"
  | "/settings/users";

export const MOATLESS_ADMIN_PATHS = [
  "/settings/workspaces",
  "/settings/loops",
  "/settings/integrations",
  "/settings/skills",
  "/settings/secrets",
  "/settings/users",
] as const satisfies ReadonlyArray<MoatlessAdminPath>;

const MOATLESS_ADMIN_PATH_SET: ReadonlySet<string> = new Set(MOATLESS_ADMIN_PATHS);

/**
 * Whether a path administers the deployment, including its detail routes —
 * `/settings/workspaces/42` is as administrative as `/settings/workspaces`.
 */
export function isMoatlessAdminPath(pathname: string): boolean {
  if (MOATLESS_ADMIN_PATH_SET.has(pathname)) return true;
  return MOATLESS_ADMIN_PATHS.some((path) => pathname.startsWith(`${path}/`));
}

export interface SettingsSearchItem {
  readonly id: string;
  readonly title: string;
  readonly to: SettingsPath;
  readonly targetId?: string;
}

/**
 * Section labels in sidebar order. The sidebar nav and the search-result
 * subtitles both render from this record, so each label exists once.
 */
export const SETTINGS_SECTION_LABELS: Readonly<Record<SettingsPath, string>> = {
  "/settings/general": "General",
  "/settings/appearance": "Appearance",
  "/settings/keybindings": "Keybindings",
  "/settings/providers": "Providers",
  "/settings/source-control": "Source Control",
  "/settings/connections": "Connections",
  "/settings/beta": "Beta",
  "/settings/archived": "Archive",
  "/settings/workspaces": "Workspaces",
  "/settings/loops": "Loops",
  "/settings/integrations": "Integrations",
  "/settings/skills": "Skills",
  "/settings/secrets": "Secrets",
  "/settings/users": "Users",
};

/**
 * Every searchable setting, in result order. This catalog is the single
 * source of truth for anchor ids and visible titles: panels render both via
 * `searchableSetting`, so a retitle (or, later, a translation pass) happens
 * here once instead of separately in the panel and the index.
 */
export const SETTINGS_SEARCH_ITEMS = [
  {
    id: "theme",
    title: "Theme",
    to: "/settings/appearance",
  },
  {
    // Prefixed because the slider control already owns the `glass-opacity` id.
    id: "setting-glass-opacity",
    title: "Glass opacity",
    to: "/settings/appearance",
  },
  {
    id: "environment-identification",
    title: "Environment identification",
    to: "/settings/appearance",
    // The setting is stage-dependent, so its parent section is the stable destination.
    targetId: "appearance",
  },
  {
    id: "interface-font",
    title: "Interface font",
    to: "/settings/appearance",
  },
  {
    id: "prompt-font",
    title: "Prompt font",
    to: "/settings/appearance",
  },
  {
    id: "code-font",
    title: "Code font",
    to: "/settings/appearance",
  },
  {
    id: "terminal-font",
    title: "Terminal font",
    to: "/settings/appearance",
  },
  {
    id: "font-smoothing",
    title: "Font smoothing",
    to: "/settings/appearance",
  },
  {
    id: "word-wrap",
    title: "Word wrap",
    to: "/settings/appearance",
  },
  {
    id: "project-grouping",
    title: "Project grouping",
    to: "/settings/general",
  },
  {
    id: "time-format",
    title: "Time format",
    to: "/settings/general",
  },
  {
    id: "hide-whitespace-changes",
    title: "Hide whitespace changes",
    to: "/settings/general",
  },
  {
    id: "assistant-output",
    title: "Assistant output",
    to: "/settings/general",
  },
  {
    id: "provider-update-checks",
    title: "Provider update checks",
    to: "/settings/general",
  },
  {
    id: "auto-open-task-panel",
    title: "Auto-open task panel",
    to: "/settings/general",
  },
  {
    id: "new-threads",
    title: "New threads",
    to: "/settings/general",
  },
  {
    id: "start-from-origin",
    title: "Start from origin",
    to: "/settings/general",
    targetId: "new-threads",
  },
  {
    id: "add-project-starts-in",
    title: "Add project starts in",
    to: "/settings/general",
  },
  {
    id: "archive-confirmation",
    title: "Archive confirmation",
    to: "/settings/general",
  },
  {
    id: "delete-confirmation",
    title: "Delete confirmation",
    to: "/settings/general",
  },
  {
    id: "text-generation-model",
    title: "Text generation model",
    to: "/settings/general",
  },
  {
    id: "diagnostics",
    title: "Diagnostics",
    to: "/settings/general",
  },
  {
    id: "keybindings",
    title: "Keybindings",
    to: "/settings/keybindings",
  },
  {
    id: "providers",
    title: "Providers",
    to: "/settings/providers",
  },
  {
    id: "source-control",
    title: "Source control",
    to: "/settings/source-control",
  },
  {
    id: "remote-environments",
    title: "Remote environments",
    to: "/settings/connections",
  },
  {
    id: "sidebar-v2",
    title: "Sidebar v2",
    to: "/settings/beta",
  },
  {
    id: "auto-settle-inactive-threads",
    title: "Auto-settle inactive threads",
    to: "/settings/beta",
    targetId: "sidebar-v2",
  },
  {
    id: "archive",
    title: "Archived threads",
    to: "/settings/archived",
  },
  {
    id: "workspaces",
    title: "Workspaces",
    to: "/settings/workspaces",
  },
  {
    id: "workspace-repositories",
    title: "Repositories",
    to: "/settings/workspaces",
    // Repositories are composed inside a workspace rather than listed on their
    // own, so the list page is where somebody searching for one should land.
    targetId: "workspaces",
  },
  {
    id: "loops",
    title: "Loops",
    to: "/settings/loops",
  },
  {
    id: "integrations-connections",
    title: "Connections",
    to: "/settings/integrations",
  },
  {
    id: "integrations-apps",
    title: "Apps",
    to: "/settings/integrations",
  },
  {
    id: "integrations-github",
    title: "GitHub",
    to: "/settings/integrations",
  },
  {
    id: "skills",
    title: "Skills",
    to: "/settings/skills",
  },
  {
    id: "secrets",
    title: "Secrets",
    to: "/settings/secrets",
  },
  {
    id: "users",
    title: "Users",
    to: "/settings/users",
  },
] as const satisfies ReadonlyArray<SettingsSearchItem>;

export type SettingsSearchItemId = (typeof SETTINGS_SEARCH_ITEMS)[number]["id"];

const SEARCH_ITEMS_BY_ID = Object.fromEntries(
  SETTINGS_SEARCH_ITEMS.map((item) => [item.id, item]),
) as Readonly<Record<SettingsSearchItemId, SettingsSearchItem>>;

/**
 * `id` and `title` props for the element a search item anchors to. Panels
 * spread (or pick from) this instead of restating the strings, so the catalog
 * and the rendered settings cannot drift apart.
 */
export function searchableSetting(id: SettingsSearchItemId): {
  readonly id: string;
  readonly title: string;
} {
  const { id: anchorId, title } = SEARCH_ITEMS_BY_ID[id];
  return { id: anchorId, title };
}

/**
 * Exported for the Moatless administration list filters, which search the rows
 * of a list rather than the settings catalog but should decide what "matches"
 * the same way this page does. Upstream uses it only inside this module.
 */
export function normalizeSearchText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function searchSettings(
  query: string,
  items: ReadonlyArray<SettingsSearchItem> = SETTINGS_SEARCH_ITEMS,
): ReadonlyArray<SettingsSearchItem> {
  const normalizedQuery = normalizeSearchText(query);
  if (normalizedQuery.length === 0) return [];

  return items.filter((item) => normalizeSearchText(item.title).includes(normalizedQuery));
}
