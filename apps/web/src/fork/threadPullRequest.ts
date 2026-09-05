/**
 * Fork-only. Which pull request a thread surface shows, against Moatless.
 *
 * Upstream derives `VcsStatusResult.pr` by looking up the checked-out branch on
 * the git host, so its surfaces gate the pull request on `refName` matching the
 * thread's branch: without that check the pill beside the branch selector would
 * name a pull request belonging to some other branch.
 *
 * Moatless derives it from the Task's GitHub PR binding, which names no branch
 * at all. The same gate there reports nothing for most Tasks that have a pull
 * request: `tasks.branch` holds the base picked at creation and is never
 * updated, while the agent commits on whatever branch it cut. So the check is
 * not merely unnecessary here, it is the bug — and dropping it is safe for the
 * same reason it is needed upstream, since a binding-derived pull request is
 * the Task's own by construction.
 */
import type { VcsStatusResult } from "@t3tools/contracts";

/**
 * The pull request to show beside a thread's branch, or `null`.
 *
 * Takes the status snapshot the surface already reads, so a caller adds no
 * query. The branch arguments upstream's `resolveThreadPr` weighs are
 * deliberately absent rather than ignored: there is no branch in the answer.
 */
export function resolveForkThreadPr(
  gitStatus: VcsStatusResult | null,
): VcsStatusResult["pr"] | null {
  return gitStatus?.pr ?? null;
}
