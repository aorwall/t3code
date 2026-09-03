/**
 * Fork-only: which right-panel surfaces stop working when the thread's sandbox
 * does, and what a card says when something has closed it.
 *
 * Most of the surfaces are windows onto the workspace — a shell in it, its
 * files, its diff, a server running inside it — so a stopped sandbox leaves
 * them nothing to show. Agents is not one of them: the roster is folded out of
 * the thread's own activity and its subtasks are other threads, both served by
 * the environment and both readable with the workspace stopped. Gating it with
 * the rest hid a working surface behind a machine it never needed.
 *
 * Pull requests would qualify on the same reasoning, but the surface is off
 * wholesale on this backend — the client reads `capabilities.pullRequests`,
 * which Moatless does not report — so gating it changes nothing that renders.
 */
import type { RightPanelKind } from "~/rightPanelStore";

/**
 * Surfaces the environment serves rather than the workspace.
 *
 * A kind absent from here needs the sandbox, which is the safe default: a new
 * surface is a window onto the workspace until someone says otherwise.
 */
const SANDBOX_INDEPENDENT_KINDS: ReadonlySet<RightPanelKind> = new Set<RightPanelKind>(["agents"]);

export function surfaceNeedsSandbox(kind: RightPanelKind): boolean {
  return !SANDBOX_INDEPENDENT_KINDS.has(kind);
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
