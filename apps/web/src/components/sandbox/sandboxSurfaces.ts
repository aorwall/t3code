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
 * Linked pull requests are not either: the list is the thread's own
 * `pullRequests` and each row's summary comes from the backend's store. A
 * single pull request's detail reads the git host through
 * `capabilities.pullRequests`, which Moatless does not report, so that surface
 * stays gated and never opens on this backend anyway.
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
 * when no sandbox is running, and `pull-requests` because
 * `pullRequests.summary` reads the backend's own store. A kind absent from here
 * needs the sandbox, which is the safe default: a new surface is a window onto
 * the live workspace until someone says otherwise.
 *
 * `sandbox` is the one surface that must stay open precisely when the sandbox
 * is down: it is where the person starts one.
 */
const SANDBOX_INDEPENDENT_KINDS: ReadonlySet<RightPanelKind> = new Set<RightPanelKind>([
  "agents",
  "files",
  "file",
  "pull-requests",
  "sandbox",
]);

export function surfaceNeedsSandbox(kind: RightPanelKind): boolean {
  return !SANDBOX_INDEPENDENT_KINDS.has(kind);
}

/**
 * Routes the environment serves a page from without a sandbox: a workspace
 * file (`ASSET_ROUTE_PREFIX` in `crates/t3code/src/assets.rs`), read from the
 * snapshot when none is running, and a published Artifact, held in object
 * storage.
 */
const ENVIRONMENT_PAGE_PREFIXES = ["/api/assets/", "/api/v1/artifacts/"] as const;

/**
 * Whether the browser tab showing `url` needs the sandbox.
 *
 * A page on one of [`ENVIRONMENT_PAGE_PREFIXES`] renders with the sandbox
 * stopped: an HTML or PDF file `openFileInPreview` opened, or an Artifact a
 * chat link opened. Every other URL is a server inside the sandbox, or an
 * empty tab someone types one into.
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
    ENVIRONMENT_PAGE_PREFIXES.some((prefix) => page.pathname.startsWith(prefix))
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
