/**
 * Which product surfaces this fork's build shows.
 *
 * Fork-only, and the one place any of it is decided. The Moatless backend
 * implements part of the T3 client contract; calling a method it does not
 * implement comes back as a defect rather than a typed error, so the person
 * sees "unexpected server error" where they should have seen nothing at all.
 * A surface we cannot serve therefore has to be absent, not merely broken.
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
  /** Terminal panels, the terminal drawer, and their keybindings. */
  terminal: false,
  /** Git and VCS controls: the header's git menu and the composer's context strip. */
  versionControl: false,
  /** Adding and removing projects, and the source-control settings behind them. */
  projectManagement: false,
  /** Searching workspace files by path or content. Reading and listing are served. */
  workspaceSearch: false,
  /** Opening a workspace path in an external editor. */
  workspaceOpenIn: false,
  /** Editing server-side settings: keybindings and provider instances. */
  serverAdministration: false,
  /** Trace, process and resource-telemetry diagnostics. */
  diagnostics: false,
  /** Deleting and archiving threads. */
  threadArchival: false,
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
 * `splitPatch` to `localStorage` and keep working; **Providers** renders a
 * list the server does publish. Hiding those would take working controls with
 * them, so the server-only affordances inside them are gated one by one.
 */
export const FEATURE_BY_SETTINGS_PATH: Readonly<Record<string, FeatureName>> = {
  "/settings/keybindings": "serverAdministration",
  "/settings/source-control": "projectManagement",
  "/settings/archived": "threadArchival",
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
  "action:open-file-picker": "workspaceSearch",
  "action:search-project-contents": "workspaceSearch",
};

/** Whether a palette item is offered in this build. Unlisted values are. */
export function paletteActionEnabled(value: string): boolean {
  const feature = FEATURE_BY_PALETTE_ACTION[value];
  return feature === undefined || FEATURES[feature];
}
