/**
 * Which product surfaces this fork's build shows.
 *
 * Fork-only, and the one place any of it is decided. The Moatless backend
 * implements part of the T3 client contract, and now refuses the rest with a
 * typed `UnsupportedMethodError` the client can render. That fixed the worst of
 * it — a person no longer sees "unexpected server error" where they should have
 * seen an explanation — and it does not make this table redundant.
 *
 * A typed refusal is the right answer to a *call*. It is the wrong answer to a
 * Terminal tab that should never have been on the screen: nothing renders a
 * refusal until someone reaches for the feature, and by then they have already
 * been told the feature exists. A surface we cannot serve is still absent here,
 * and what the refusal buys is that being wrong about one is now survivable.
 *
 * # Turning one on
 *
 * Delete it. Not `false` → `true`: remove the entry from `FEATURES` and remove
 * every gate that named it, so the code reads the way upstream's does. A flag
 * left at `true` is a gate that can never be false — dead weight on every merge
 * and a standing invitation to wonder what it is still protecting.
 *
 * Every name below is therefore a surface this build does *not* show, and the
 * table's length is how much of T3 the backend has yet to reach. Deleting a
 * flag is the last commit of the work that made its surface real, not a
 * separate cleanup to schedule.
 *
 * # Why a constant and not a server capability
 *
 * A capability on the wire would be the more general answer, and it is the
 * wrong trade here: it costs a contract field, a decode path, a default that
 * must point the opposite way to every flag beside it, and a subscription at
 * every call site — all to express something that does not vary at runtime.
 * A constant is importable anywhere, so a gate needs no props threaded to it
 * and no hook, which is what keeps each one to a single expression inside
 * upstream code and keeps merges cheap.
 *
 * # Keeping the merge cost down
 *
 * Every gate reads `FEATURES.x` in one expression and adds nothing else — no
 * new props, no effects, no state. Upstream can rewrite the code around it and
 * git will usually carry the gate through untouched.
 */

/**
 * The surfaces, and what each one covers.
 *
 * A name is one thing a person can see, not one RPC method. Where the backend
 * simply never produces data — no approvals raised, no checkpoints recorded —
 * the surface is already empty and a flag would gate nothing.
 */
export const FEATURES = {
  /**
   * Per-turn git diffs: the diff panel's "Latest turn" / "Turn" scopes and the
   * inline changed-files cards under each assistant turn. Backed by the
   * `orchestration.getTurnDiff` / `getFullThreadDiff` RPCs, which the backend
   * does not serve. Working-tree and branch-range diffs are unaffected.
   */
  turnDiffs: false,
  /** Adding and removing projects, and the source-control settings behind them. */
  projectManagement: false,
  /**
   * Searching workspace files by *content*. Path search, reading and listing
   * are served.
   *
   * Split from a single `workspaceSearch` flag once the backend grew path
   * search: the Sandbox has a file-name search RPC and no content-search one,
   * so the two halves stopped sharing a fate.
   */
  workspaceSearchContents: false,
  /** Opening a workspace path in an external editor. */
  workspaceOpenIn: false,
  /** Editing server-side settings: keybindings and provider instances. */
  serverAdministration: false,
  /** Trace, process and resource-telemetry diagnostics. */
  diagnostics: false,
  /**
   * Deleting a thread. Archiving is served — it is closing a Moatless task —
   * but closing keeps the conversation and its history, so there is nothing
   * behind a control that promises to clear them.
   */
  threadDeletion: false,
  /**
   * The Connections settings page: device pairing, SSH environments, WSL, and
   * server-exposure controls for a self-hosted T3 server. The Moatless backend
   * is reached over the web and manages none of this.
   */
  connections: false,
  /**
   * Streaming assistant output token-by-token. The Moatless backend delivers
   * each assistant message once it is complete, so the setting governs nothing.
   */
  assistantStreaming: false,
  /**
   * The composer's "Server update available" banner, raised on version skew
   * between this web build and the connected server. It offers to run T3's
   * server self-update — `npx t3@<version>` — which the Moatless backend, a
   * separate Rust server, does not implement: skew against it is expected and
   * the npx command does not apply. Gating it drops the idle offer along with
   * the in-flight and failed update progress that offer drives.
   */
  serverUpdateBanner: false,
  /**
   * The sidebar's project-grouping setting, which combines matching
   * repositories across environments. This build runs a single environment, so
   * there is nothing to group across.
   */
  projectGrouping: false,
  /**
   * The composer's Access picker, which chooses how much an agent may do
   * without asking. Every Moatless task runs in its own throwaway sandbox, so a
   * thread is always `full-access` and there is no tier to pick between.
   */
  accessMode: false,
  /**
   * The chat's terminal-drawer button, which splits the screen horizontally by
   * opening a terminal across the bottom.
   *
   * Not a backend gap — the drawer works. The fork shows one way to reach a
   * terminal, the right panel's terminal surface, and drops the button that
   * splits the chat horizontally beside it. `terminal.toggle` still opens the
   * drawer for anyone who wants it.
   */
  terminalDrawerToggle: false,
  /**
   * A thread's pull request deciding whether it is settled: merged or closed
   * settles it outright, open holds it out of the settled shelf.
   *
   * The one flag here that gates a *rule* rather than a screen, because the
   * rule is only ever seen as a screen — a row moving to Settled on its own.
   * `effectiveSettled` reads the PR that `resolveThreadPr` matched by branch
   * name, and against Moatless a branch is not a strong enough key: the
   * backend reports the oldest pull request the Task was ever connected to,
   * not one the thread produced. A thread sitting on `main` therefore inherits
   * a stranger's PR, and the day that PR merges the thread files itself under
   * Settled every time the agent goes idle. Confirmed on a live thread whose
   * newest message was minutes old.
   *
   * Off, this drops both directions of the rule — open PRs stop suppressing
   * the inactivity path too. Settling is then inactivity plus the explicit
   * user override, both of which are statements about the thread itself. PRs
   * keep their row indicator, the branch toolbar and the settled-shelf hover
   * colour; they only stop deciding.
   *
   * Turn this on when the backend reports the change request for the
   * checkout's own ref — see the convergence watch list.
   */
  prThreadSettling: false,
} satisfies Record<string, boolean>;

export type FeatureName = keyof typeof FEATURES;

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
  "/settings/providers": "serverAdministration",
  "/settings/source-control": "projectManagement",
  "/settings/connections": "connections",
  "/settings/diagnostics": "diagnostics",
};

/** Whether a settings path is reachable in this build. Unlisted paths are. */
export function settingsPathEnabled(pathname: string): boolean {
  const feature = FEATURE_BY_SETTINGS_PATH[pathname];
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
};

/** Whether a palette item is offered in this build. Unlisted values are. */
export function paletteActionEnabled(value: string): boolean {
  const feature = FEATURE_BY_PALETTE_ACTION[value];
  return feature === undefined || FEATURES[feature];
}
