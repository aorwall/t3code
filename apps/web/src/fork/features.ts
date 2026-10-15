import type { ExecutionEnvironmentDescriptor } from "@t3tools/contracts";

/**
 * Which product surfaces this client shows, decided by the server it serves.
 *
 * Fork-only, and the one place any of it is decided. One build serves both a
 * Moatless deployment and a T3 server, so a surface is shown unless the primary
 * environment's descriptor names it in `capabilities.unsupportedSurfaces`. A T3
 * server sends no such list and gets upstream's whole UI; Moatless lists what
 * it cannot back. `moatlessApi` says the same origin also serves Moatless's own
 * REST API, which the login route and the administration pages need.
 *
 * A typed `UnsupportedMethodError` is the right answer to a *call*. It is the
 * wrong answer to a Terminal tab that should never have been on the screen, so
 * a surface the server cannot back is still absent rather than refused.
 *
 * # Read synchronously, not through a hook
 *
 * The root route's `beforeLoad` resolves the primary descriptor before anything
 * renders, and it does not change for the life of the page. So `FEATURES.x`
 * stays one expression inside upstream code, with no props, hook or
 * subscription, which is what keeps merges cheap. Do not read it at module
 * scope: that runs before the descriptor arrives and sees every surface on.
 *
 * # Turning one on
 *
 * Drop the name from the backend's `unsupportedSurfaces` when the backend
 * serves it. Once no deployment in service lists it, remove the entry here and
 * every gate that named it, so the code reads the way upstream's does.
 */

/**
 * The surfaces a server can opt out of, and what each one covers. Only the
 * keys matter.
 *
 * A name is one thing a person can see, not one RPC method. Where the backend
 * simply never produces data — no approvals raised, no checkpoints recorded —
 * the surface is already empty and a flag would gate nothing.
 */
const SURFACES = {
  /**
   * Per-turn git diffs: the diff panel's "Latest turn" / "Turn" scopes and the
   * inline changed-files cards under each assistant turn. Backed by the
   * `orchestration.getTurnDiff` / `getFullThreadDiff` RPCs, which the backend
   * does not serve. Working-tree and branch-range diffs are unaffected.
   */
  turnDiffs: true,
  /** Adding and removing projects, and the source-control settings behind them. */
  projectManagement: true,
  /**
   * Searching workspace files by *content*. Path search, reading and listing
   * are served.
   *
   * Split from a single `workspaceSearch` flag once the backend grew path
   * search: the Sandbox has a file-name search RPC and no content-search one,
   * so the two halves stopped sharing a fate.
   */
  workspaceSearchContents: true,
  /**
   * Opening a workspace path in an external editor, through
   * `shell.openInEditor`. An editor runs on the machine the workspace is on,
   * and here that machine is a sandbox in a cluster — a call that succeeded
   * would open a window nobody is sitting at.
   *
   * Five ways in: the chat header's Open in picker, the same picker in a file
   * preview's header, a transcript path link's Open in action and its
   * modifier-click, a path link clicked in terminal output, and the commit
   * dialog's file rows, whose only click action this is. Revealing a path in a
   * file manager rides the same method and goes with them. What stays is the
   * file panel, where a transcript path link and a diff's file already open.
   */
  openInEditor: true,
  /** Editing server-side settings: keybindings. */
  serverAdministration: true,
  /**
   * Configuring a provider instance: adding and removing one, its display name
   * and accent colour, its runtime flags, its environment variables, its custom
   * models, the usage-limit sources and the health-check interval. All of it
   * persists through `server.updateSettings`, which the backend does not
   * dispatch, and `server.getSettings` answers `{}` — so every control would
   * show a contract default as though it were the server's configuration.
   *
   * The provider list, its live status and its refresh are reads the backend
   * serves, and the Models section's hidden, favourite and order controls are
   * client settings, so the page is otherwise whole.
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
   * The composer's "Server update available" banner, raised on version skew
   * between this web build and the connected server. It offers to run T3's
   * server self-update — `npx t3@<version>` — which the Moatless backend, a
   * separate Rust server, does not implement: skew against it is expected and
   * the npx command does not apply. Gating it drops the idle offer along with
   * the in-flight and failed update progress that offer drives.
   */
  serverUpdateBanner: true,
  /**
   * The sidebar's project-grouping setting, which combines matching
   * repositories across environments. This build runs a single environment, so
   * there is nothing to group across.
   */
  projectGrouping: true,
  /**
   * The composer's Access picker, which chooses how much an agent may do
   * without asking. Every Moatless task runs in its own throwaway sandbox, so a
   * thread is always `full-access` and there is no tier to pick between.
   *
   * Also the General page's Permissions row under New threads, which sets the
   * same tier as the default for every new thread.
   */
  accessMode: true,
  /**
   * The composer's Workspace picker, which runs a thread either in the
   * project's own checkout or in a git worktree cut for it. Moatless has no
   * worktree: a task runs in its own sandbox, its checkout is that sandbox's,
   * and `worktreePath` is never set. So the picker's other entries — "New
   * worktree" and the "Previous worktree" hop — name a place the backend
   * cannot put a thread, and the branch selector behind them would offer to
   * pick a base ref for a worktree nobody cuts.
   *
   * Off also swaps the thread details panel's workspace row for a sandbox row:
   * the sandbox's state and a menu to start, stop, restart or redeploy it.
   *
   * The General page's Workspace, Submodules and Start from origin rows set
   * the defaults behind the same picker: where a new thread starts, how a new
   * worktree populates submodules, and which ref it is cut from.
   */
  worktreeSelection: true,
  /**
   * The browser's "Recently used" list: the URLs a thread's preview has
   * opened, offered in an empty browser tab. The history is keyed by project
   * and every thread of that project reads it, while a thread's own preview
   * URL names the sandbox of the task that raised it (`https://task--5733.…`)
   * — a script's published port, for instance. So one thread's entries point
   * every other thread at a sandbox it does not own, and at a host that stops
   * with that task.
   *
   * The store behind the list still records a visit and its title. This gates
   * the surface, not the writes.
   */
  browserHistory: true,
  /**
   * The SnapShots settings page, which configures T3's cross-platform window
   * capture: a global shortcut grabs the foreground window and hands the image,
   * and optionally the window's accessibility text, to the composer. Every
   * control on it drives `window.desktopBridge`, which a browser tab does not
   * have. Upstream renders the page with an "unavailable" notice instead of
   * hiding it, so without this gate a hosted build lists a sidebar section and
   * six searchable rows for a feature it can never run.
   */
  snapShots: true,
  /**
   * The "Revert files too" choice in the rewind dialog, which sends
   * `thread.checkpoint.revert`. Moatless rewinds the conversation and refuses
   * that command: it records no per-turn worktree snapshot, so there is no
   * state to put the files back to. "Revert and keep changes" is served and is
   * the whole dialog without this.
   */
  checkpointFileRestore: true,
  /**
   * The right panel's Pull request surface: one pull request read from its
   * host, with its summary, its files and its timeline. Moatless serves
   * `pullRequests.detail`, the diff and the guided review for a pull request a
   * task is bound to; `activity` and the review actions are not served and
   * degrade inside the surface.
   *
   * What `capabilities.pullRequests` cannot decide is the launcher, which keeps
   * an unavailable surface on screen with a one-line reason: upstream's reads
   * "No pull request on this branch yet", a wait that never ends on a server
   * that lists this surface as unsupported. This drops the row there.
   */
  pullRequestSurface: true,
  /**
   * The Pull Requests page: every change request on a server, listed and
   * searched through `pullRequests.list`, and reached from the sidebar entry,
   * the palette's "Open pull requests" and a pull request link opened away
   * from any thread. A server can back one pull request a thread links — its
   * detail, diff and guided review — without listing a host; then a link
   * outside a thread opens the host instead.
   */
  pullRequestList: true,
  /**
   * The device hub: an iOS Simulator or Android Emulator a person and the agent
   * share, offered as a right-panel surface and a Devices settings section.
   * Every method behind it is refused — `device.configure`, `list`, `open`,
   * `action` and the `subscribeDeviceState` stream — and the surface asks for
   * none of them until someone opens it, so nothing renders the refusal first.
   * Upstream's launcher offers Device on any thread; ungated, that row opens
   * `DeviceSetup`, whose "Enable the device hub" step calls `device.configure`
   * and shows the refusal. The settings section is the same dead end reached
   * from the other side: it saves hosts through `server.updateSettings`, which
   * the backend does not dispatch either.
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
   * The General page's Model row under New threads: the environment's default
   * model and effort. The client applies it to a new draft itself, so the
   * backend only has to store `defaultModelSelection` — but its server config
   * carries `settings: {}` and it refuses `server.updateSettings`, so the row
   * shows the built-in default and every change fails to save. A Workspace's
   * own default model is edited on its project page and is served.
   */
  defaultModelSetting: true,
  /**
   * General page rows that tune what upstream's server does on its own:
   * snoozing and auto-resuming usage-limited threads, checking provider CLIs
   * for updates, continuing threads after a restart, the background-activity
   * policy, and the model that writes thread titles. The backend does none of
   * it — its agents live in sandbox images and name their own threads — and
   * every row saves through `server.updateSettings`, which it refuses.
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
 * Settings sections that are the whole of one feature.
 *
 * Every control on these pages calls methods in one group, so the section has
 * nothing to show when the group is off and both ways in are refused: the
 * sidebar leaves it out, and `/settings`'s `beforeLoad` redirects a typed URL.
 *
 * A section is deliberately absent when its page mixes server-backed and
 * client-only state. **General** and **Appearance** persist through
 * `splitPatch` to `localStorage` and keep working, so the server-only
 * affordances inside them are gated one by one instead.
 */
export const FEATURE_BY_SETTINGS_PATH: Readonly<Record<string, FeatureName>> = {
  "/settings/keybindings": "serverAdministration",
  "/settings/snap-shot": "snapShots",
  "/settings/source-control": "projectManagement",
  "/settings/connections": "connections",
  "/settings/diagnostics": "diagnostics",
  "/settings/scheduled-tasks": "scheduledTasks",
};

/**
 * Settings sections served by the Moatless REST API alone. The administration
 * pages are gated by `readIsMoatlessAdmin`, which answers no without the API.
 */
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
  "snooze-limited-threads": "serverBehaviorSettings",
  "auto-resume-limited-threads": "serverBehaviorSettings",
  "provider-update-checks": "serverBehaviorSettings",
  "continue-threads-after-server-update": "serverBehaviorSettings",
  "background-activity": "serverBehaviorSettings",
  "text-generation-model": "serverBehaviorSettings",
  diagnostics: "diagnostics",
};

/** Whether a settings search item is offered in this build. Unlisted ids are. */
export function settingsSearchItemEnabled(id: string): boolean {
  const feature = FEATURE_BY_SETTINGS_SEARCH_ID[id];
  return feature === undefined || FEATURES[feature];
}

/**
 * Command palette actions that drive a gated surface, by their `value`.
 *
 * Keyed by value so the palette can filter its finished list in one place
 * instead of wrapping each `push` in a conditional. Every wrapped block would
 * be a re-indented block, and a re-indented block is what turns an upstream
 * edit nearby into a conflict.
 */
export const FEATURE_BY_PALETTE_ACTION: Readonly<Record<string, FeatureName>> = {
  "action:add-project": "projectManagement",
  "action:search-project-contents": "workspaceSearchContents",
  "action:pull-requests": "pullRequestList",
};

/** Whether a palette item is offered in this build. Unlisted values are. */
export function paletteActionEnabled(value: string): boolean {
  const feature = FEATURE_BY_PALETTE_ACTION[value];
  return feature === undefined || FEATURES[feature];
}
