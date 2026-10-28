import type { ExecutionEnvironmentDescriptor } from "@t3tools/contracts";

/**
 * Fork-only. Which product surfaces this client shows, decided by the server it serves.
 * A surface is shown unless the primary descriptor lists it in `capabilities.unsupportedSurfaces`.
 * Read `FEATURES.x` synchronously, never at module scope: it runs before the descriptor arrives
 * and sees every surface on. Remove an entry and its gates once no deployment lists it.
 */

/**
 * The surfaces a server can opt out of; only the keys matter.
 * A name is one thing a person can see, not one RPC method. Where the backend never produces
 * data, the surface is already empty and a flag would gate nothing.
 */
const SURFACES = {
  /**
   * Per-turn git diffs: the diff panel's "Latest turn" / "Turn" scopes and the
   * inline changed-files cards under each assistant turn. Backed by the
   * `orchestration.getTurnDiff` / `getFullThreadDiff` RPCs, which the backend
   * does not serve. Working-tree and branch-range diffs are unaffected.
   */
  turnDiffs: true,
  /**
   * Adding, renaming and removing projects, and the source-control settings
   * behind them. A Moatless Workspace is declared in git or with the moat CLI.
   */
  projectManagement: true,
  /**
   * Searching workspace files by *content*. The Sandbox has a file-name search RPC but no
   * content-search one; path search, reading and listing are served.
   */
  workspaceSearchContents: true,
  /**
   * Opening a workspace path in an external editor (`shell.openInEditor`). The workspace is a
   * sandbox in a cluster, so a call that succeeded would open a window nobody sits at.
   * Covers every picker, path-link Open in, terminal links and commit dialog rows.
   * The file panel, where path links and diffs already open, stays.
   */
  openInEditor: true,
  /** Editing server-side settings: keybindings. */
  serverAdministration: true,
  /**
   * Configuring a provider instance (add/remove, names, flags, env vars, models, limits,
   * health interval). All persists via `server.updateSettings`, which the backend does not
   * dispatch, and `server.getSettings` answers `{}`, so controls would show contract defaults
   * as the server's config. The provider list, status and client-side model settings stay.
   */
  providerConfiguration: true,
  /**
   * Trace, process and resource-telemetry diagnostics, and the General page's
   * View diagnostics row that links to them.
   */
  diagnostics: true,
  /**
   * The Connections settings page: device pairing, SSH environments, WSL, and
   * server-exposure controls for a self-hosted T3 server. The Moatless backend
   * is reached over the web and manages none of this.
   */
  connections: true,
  /**
   * Streaming assistant output token-by-token. The Moatless backend delivers
   * each assistant message once it is complete, so the setting governs nothing.
   */
  assistantStreaming: true,
  /**
   * The composer's "Server update available" banner. It offers T3's `npx t3@<version>`
   * self-update, which the Rust Moatless backend does not implement; skew against it is
   * expected. Gating drops the idle offer and the update progress it drives.
   */
  serverUpdateBanner: true,
  /**
   * The sidebar's project-grouping setting, which combines matching
   * repositories across environments. This build runs a single environment, so
   * there is nothing to group across.
   */
  projectGrouping: true,
  /**
   * The composer's Access picker and the General page's Permissions row. Every Moatless task
   * runs in a throwaway sandbox, so a thread is always `full-access`: no tier to pick.
   */
  accessMode: true,
  /**
   * The composer's Workspace picker and the branch selector behind it. Moatless has no worktree
   * (`worktreePath` is never set), so "New worktree" and "Previous worktree" name places the
   * backend cannot put a thread. Off swaps the details panel's workspace row for a sandbox row,
   * and gates the General page's Workspace, Submodules and Start from origin rows.
   */
  worktreeSelection: true,
  /**
   * The browser's "Recently used" list. History is keyed by project, but a preview URL names
   * the sandbox of the task that raised it, so entries would point other threads at a host
   * that stops with that task. Gates the surface, not the writes.
   */
  browserHistory: true,
  /**
   * The SnapShots settings page. Every control drives `window.desktopBridge`, which a browser
   * tab lacks, and upstream shows an "unavailable" notice instead of hiding it, so a hosted
   * build would list a section and six rows for a feature it can never run.
   */
  snapShots: true,
  /**
   * The "Revert files too" choice in the rewind dialog (`thread.checkpoint.revert`).
   * Moatless records no per-turn worktree snapshot, so it refuses the command.
   */
  checkpointFileRestore: true,
  /**
   * The right panel's Pull request surface. `activity` and the review actions are not served.
   * Also drops the launcher row: upstream's "No pull request on this branch yet" wait would
   * never end on a server that lists this surface as unsupported.
   */
  pullRequestSurface: true,
  /**
   * The device hub (simulator/emulator surface and Devices settings section). Every method
   * behind it is refused, and ungated, the launcher's Device row opens `DeviceSetup`, whose
   * `device.configure` step shows the refusal. Settings saves via `server.updateSettings`, also refused.
   */
  deviceHub: true,
  /**
   * Merging a fork back into the thread it came from, from the Lineage
   * section. `thread.merge_back` carries the fork's conversation into its
   * parent as handed-off context; the backend refuses it, since a Moatless
   * fork shares no conversation store with its parent to merge.
   */
  mergeBack: true,
  /**
   * The Scheduled tasks settings page and the thread details Automations
   * panel. Moatless schedules work as Loops, and the backend serves none of
   * the `scheduledTasks.*` methods behind them.
   */
  scheduledTasks: true,
  /**
   * The General page's Model row under New threads. The backend refuses
   * `server.updateSettings` and reports `settings: {}`, so the row would show the built-in
   * default and every change would fail to save.
   */
  defaultModelSetting: true,
  /**
   * General page rows tuning what upstream's server does on its own (usage-limit snoozing,
   * CLI update checks, restart resume, background policy, title model) and the Beta page's
   * Guest links. The backend does none of it and refuses `server.updateSettings`, which every
   * row saves through.
   */
  serverBehaviorSettings: true,
} satisfies Record<string, true>;

export type FeatureName = keyof typeof SURFACES;

let unsupportedSurfaces: ReadonlySet<string> = new Set();
let moatlessApi = false;

/**
 * Adopt the primary environment's descriptor. `null` restores the state before
 * one arrived: every surface on and no Moatless API.
 */
export function applyPrimaryEnvironmentDescriptor(
  descriptor: ExecutionEnvironmentDescriptor | null,
): void {
  unsupportedSurfaces = new Set(descriptor?.capabilities.unsupportedSurfaces ?? []);
  moatlessApi = descriptor?.capabilities.moatlessApi === true;
}

/** Whether each surface is shown against the primary environment. */
export const FEATURES = Object.defineProperties(
  {},
  Object.fromEntries(
    Object.keys(SURFACES).map((name) => [
      name,
      { enumerable: true, get: () => !unsupportedSurfaces.has(name) },
    ]),
  ),
) as Readonly<Record<FeatureName, boolean>>;

/** Whether the primary origin serves the Moatless REST API and cookie login. */
export function moatlessApiAvailable(): boolean {
  return moatlessApi;
}

/** Where an unauthenticated browser signs in: Moatless's login or T3 pairing. */
export function signInPath(): "/login" | "/pair" {
  return moatlessApi ? "/login" : "/pair";
}

/**
 * Settings sections that are the whole of one feature: the sidebar omits them and
 * `/settings`'s `beforeLoad` redirects a typed URL when the group is off.
 * **General** and **Appearance** are absent: they mix client-only state, so gate inside them.
 */
export const FEATURE_BY_SETTINGS_PATH: Readonly<Record<string, FeatureName>> = {
  "/settings/keybindings": "serverAdministration",
  "/settings/snap-shot": "snapShots",
  "/settings/source-control": "projectManagement",
  "/settings/connections": "connections",
  "/settings/diagnostics": "diagnostics",
  "/settings/scheduled-tasks": "scheduledTasks",
  "/settings/devices": "deviceHub",
};

/** Settings sections served by the Moatless REST API alone. */
const MOATLESS_API_SETTINGS_PATHS: ReadonlySet<string> = new Set(["/settings/version-control"]);

/** Whether a settings path is reachable against this server. Unlisted paths are. */
export function settingsPathEnabled(pathname: string): boolean {
  if (MOATLESS_API_SETTINGS_PATHS.has(pathname)) return moatlessApi;
  const feature = FEATURE_BY_SETTINGS_PATH[pathname];
  return feature === undefined || FEATURES[feature];
}

/**
 * Settings search results for a row this build does not render, by item `id`.
 *
 * A gate inside a settings page leaves the row's search item behind, and a
 * result for it lands on the page at an anchor that is not there.
 */
export const FEATURE_BY_SETTINGS_SEARCH_ID: Readonly<Record<string, FeatureName>> = {
  "project-defaults": "defaultModelSetting",
  "default-model": "defaultModelSetting",
  "default-permissions": "accessMode",
  "new-threads": "worktreeSelection",
  "worktree-submodules": "worktreeSelection",
  "start-from-origin": "worktreeSelection",
  "project-grouping": "projectGrouping",
  "add-project-starts-in": "projectManagement",
  "project-overview": "projectManagement",
  "snooze-limited-threads": "serverBehaviorSettings",
  "auto-resume-limited-threads": "serverBehaviorSettings",
  "provider-update-checks": "serverBehaviorSettings",
  "continue-threads-after-server-update": "serverBehaviorSettings",
  "background-activity": "serverBehaviorSettings",
  "text-generation-model": "serverBehaviorSettings",
  "thread-title-instructions": "serverBehaviorSettings",
  "guest-links": "serverBehaviorSettings",
  "snooze-options": "serverBehaviorSettings",
  "linked-environments": "serverBehaviorSettings",
  diagnostics: "diagnostics",
  "mobile-app": "connections",
};

/** Whether a settings search item is offered in this build. Unlisted ids are. */
export function settingsSearchItemEnabled(id: string): boolean {
  const feature = FEATURE_BY_SETTINGS_SEARCH_ID[id];
  return feature === undefined || FEATURES[feature];
}

/**
 * Command palette actions that drive a gated surface, by `value`.
 * Keyed so the palette filters its finished list in one place; wrapping each `push` would
 * re-indent upstream blocks and turn nearby upstream edits into conflicts.
 */
export const FEATURE_BY_PALETTE_ACTION: Readonly<Record<string, FeatureName>> = {
  "action:add-project": "projectManagement",
  "action:search-project-contents": "workspaceSearchContents",
};

/** Whether a palette item is offered in this build. Unlisted values are. */
export function paletteActionEnabled(value: string): boolean {
  const feature = FEATURE_BY_PALETTE_ACTION[value];
  return feature === undefined || FEATURES[feature];
}
