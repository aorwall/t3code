/**
 * Fork-only: which right-panel surfaces stop working when the thread's sandbox
 * does, and what a card says when something has closed it.
 *
 * A shell in the workspace, its diff and a server running inside it are windows
 * onto a live machine, so a stopped sandbox leaves them nothing to show. Agents
 * and files are not: the agent roster is folded out of the thread's own
 * activity and its subtasks, and the file tree, a file's contents and the name
 * search are served from the workspace snapshot S3 holds — all readable with
 * the sandbox stopped. Gating those hid a working surface behind a machine they
 * did not need. A snapshot the environment never stored (a Task from before the
 * mirror, or a tar-only fork) answers the file read as "sandbox not running",
 * so the surface shows that in its own panel rather than being closed outright.
 *
 * Pull requests would qualify on the same reasoning, but the surface is off
 * wholesale on this backend — the client reads `capabilities.pullRequests`,
 * which Moatless does not report — so gating it changes nothing that renders.
 *
 * A browser tab is the one surface whose answer depends on the page it holds
 * rather than on the kind alone — see [`previewTabNeedsSandbox`].
 */
import type { PreviewSessionSnapshot } from "@t3tools/contracts";

import type { RightPanelKind, RightPanelSurface } from "~/rightPanelStore";

/**
 * Surfaces the environment serves rather than the live workspace.
 *
 * `files`/`file` are here because the backend reads them from the S3 snapshot
 * when no sandbox is running. A kind absent from here needs the sandbox, which
 * is the safe default: a new surface is a window onto the live workspace until
 * someone says otherwise.
 *
 * `sandbox` is the one surface that must stay open precisely when the sandbox
 * is down: it is where the person starts one.
 */
const SANDBOX_INDEPENDENT_KINDS: ReadonlySet<RightPanelKind> = new Set<RightPanelKind>([
  "agents",
  "files",
  "file",
  "sandbox",
]);

export function surfaceNeedsSandbox(kind: RightPanelKind): boolean {
  return !SANDBOX_INDEPENDENT_KINDS.has(kind);
}

/**
 * Where the environment serves a workspace file to a frame, from
 * `ASSET_ROUTE_PREFIX` in `crates/t3code/src/assets.rs`.
 */
const ASSET_ROUTE_PREFIX = "/api/assets/";

/**
 * Whether the browser tab showing `url` needs the sandbox.
 *
 * `openFileInPreview` opens an HTML or PDF file at the environment's own asset
 * route, and the environment reads that file from the workspace snapshot when
 * no sandbox is running. Such a tab renders with the sandbox stopped, so gating
 * it hid a page the file surface beside it was already showing. Every other URL
 * is a server inside the sandbox, or an empty tab someone types one into.
 */
export function previewTabNeedsSandbox(
  url: string | null,
  environmentHttpBaseUrl: string | null,
): boolean {
  if (url === null || environmentHttpBaseUrl === null) return true;
  if (!URL.canParse(url) || !URL.canParse(environmentHttpBaseUrl)) return true;
  const page = new URL(url);
  return !(
    page.origin === new URL(environmentHttpBaseUrl).origin &&
    page.pathname.startsWith(ASSET_ROUTE_PREFIX)
  );
}

/**
 * Whether the open surface is one the stopped sandbox has emptied.
 *
 * An id with no surface behind it counts as one that needs the sandbox, so a
 * stale tab cannot slip past the gate.
 */
export function resolveActiveSurfaceNeedsSandbox(input: {
  readonly surfaces: readonly RightPanelSurface[];
  readonly activeSurfaceId: string | null;
  readonly previewSessions: Readonly<Record<string, PreviewSessionSnapshot>>;
  readonly environmentHttpBaseUrl: string | null;
}): boolean {
  if (input.activeSurfaceId === null) return false;
  const surface = input.surfaces.find((entry) => entry.id === input.activeSurfaceId);
  if (surface === undefined) return true;
  if (surface.kind !== "preview") return surfaceNeedsSandbox(surface.kind);
  const navStatus =
    surface.resourceId === null ? undefined : input.previewSessions[surface.resourceId]?.navStatus;
  return previewTabNeedsSandbox(
    navStatus === undefined || navStatus._tag === "Idle" ? null : navStatus.url,
    input.environmentHttpBaseUrl,
  );
}

export interface SurfaceGate {
  readonly available: boolean;
  /** Shown only while `available` is false. */
  readonly disabledReason: string;
}

/**
 * Whether a surface can be opened, and why not.
 *
 * A surface that is unavailable on its own terms keeps its own reason: with the
 * sandbox stopped, "Start the sandbox" on the Browser card would promise that
 * starting one puts a browser in a web build that has never had one. The
 * sandbox only speaks for surfaces it is the sole thing standing in the way of.
 */
export function resolveSurfaceGate(input: {
  readonly available: boolean;
  readonly reason: string;
  readonly needsSandbox: boolean;
  readonly sandboxDisabled: boolean;
  readonly sandboxReason: string;
}): SurfaceGate {
  if (!input.available) {
    return { available: false, disabledReason: input.reason };
  }
  if (input.needsSandbox && input.sandboxDisabled) {
    return { available: false, disabledReason: input.sandboxReason };
  }
  return { available: true, disabledReason: input.reason };
}
