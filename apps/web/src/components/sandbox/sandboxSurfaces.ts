/**
 * Fork-only: which right-panel surfaces stop working when the thread's sandbox does, and what a
 * card says when something has closed it. Shell, diff and in-sandbox servers need a live machine;
 * files and pull requests are served by the environment. A snapshot never stored answers the file
 * read "sandbox not running", shown in the panel. A browser tab: see [`previewTabNeedsSandbox`].
 */
import type { PreviewSessionSnapshot } from "@t3tools/contracts";

import type { RightPanelKind, RightPanelSurface } from "~/rightPanelStore";

/**
 * Surfaces the environment serves rather than the live workspace.
 * `files`/`file` come from the S3 snapshot, `pull-requests` from the backend's store, `pull-request`
 * from the git host. A kind absent here needs the sandbox (the safe default). `sandbox` must stay
 * open precisely when the sandbox is down: it is where one is started.
 */
const SANDBOX_INDEPENDENT_KINDS: ReadonlySet<RightPanelKind> = new Set<RightPanelKind>([
  "files",
  "file",
  "pull-requests",
  "pull-request",
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
 * A page on one of [`ENVIRONMENT_PAGE_PREFIXES`] (opened file, Artifact) renders with the sandbox
 * stopped. Every other URL is a server inside it, or an empty tab.
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
 * A surface unavailable on its own terms keeps its own reason: "Start the sandbox" on the Browser
 * card would promise a browser a web build never had. The sandbox only speaks for surfaces it is
 * the sole blocker of.
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
