/**
 * Fork-only. Which pull requests a thread surface shows, against Moatless.
 *
 * Upstream derives `VcsStatusResult.pr` by looking up the checked-out branch on
 * the git host, so its surfaces gate the pull request on `refName` matching the
 * thread's branch: without that check the pill beside the branch selector would
 * name a pull request belonging to some other branch.
 *
 * Moatless derives it from the Task's GitHub PR bindings, which name no branch
 * at all. The same gate there reports nothing for most Tasks that have a pull
 * request: `tasks.branch` holds the base picked at creation and is never
 * updated, while the agent commits on whatever branch it cut. So the check is
 * not merely unnecessary here, it is the bug — and dropping it is safe for the
 * same reason it is needed upstream, since a binding-derived pull request is
 * the Task's own by construction.
 *
 * A Task can be bound to several, which is why the surfaces read a list.
 */
import type { ThreadLinkedPullRequest, VcsStatusResult } from "@t3tools/contracts";

/** Stable identity so a surface can key and compare rows without a summary. */
const EMPTY: readonly ThreadLinkedPullRequest[] = [];

/** The fields of a thread this module reads, on the shell and on the detail. */
export interface ForkThreadPullRequestSource {
  readonly linkedPullRequest?: ThreadLinkedPullRequest | null | undefined;
  readonly linkedPullRequests?: readonly ThreadLinkedPullRequest[] | undefined;
}

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

/**
 * Every pull request a thread is bound to, primary first.
 *
 * The server orders the list and the primary is its first element, so nothing
 * here re-decides it: the states that choice was made from are not on the wire.
 * A server too old to send the list still sends `linkedPullRequest`, which then
 * stands in as a list of one.
 */
export function forkThreadPullRequests(
  thread: ForkThreadPullRequestSource | null | undefined,
): readonly ThreadLinkedPullRequest[] {
  if (thread == null) return EMPTY;
  const all = thread.linkedPullRequests;
  if (all !== undefined && all.length > 0) return all;
  return thread.linkedPullRequest == null ? EMPTY : [thread.linkedPullRequest];
}

/**
 * The bound pull requests a surface is not already showing.
 *
 * Compared against what is on screen rather than sliced off the front: the
 * displayed one carries a state and comes from the status snapshot, the list
 * carries none and comes from the thread, and the two are refreshed
 * independently. Slicing would report one too few for as long as they disagree.
 */
export function forkAdditionalPullRequests(
  all: readonly ThreadLinkedPullRequest[],
  shown: { readonly number: number } | null | undefined,
): readonly ThreadLinkedPullRequest[] {
  if (shown == null) return all;
  return all.filter((pullRequest) => pullRequest.number !== shown.number);
}

/** Identity of one bound pull request, for React keys and comparisons. */
export function forkPullRequestKey(pullRequest: ThreadLinkedPullRequest): string {
  return `${pullRequest.repository}#${pullRequest.number}`;
}

/**
 * The rows a menu shows for a thread's pull requests, empty when it should keep
 * upstream's single row.
 *
 * One bound pull request needs no list: upstream's row already opens it, and
 * two rows saying the same thing is worse than one. The threshold is the whole
 * rule, which is why it lives here rather than in each menu.
 */
export function forkPullRequestMenuRows(
  thread: ForkThreadPullRequestSource | null | undefined,
): readonly ThreadLinkedPullRequest[] {
  const all = forkThreadPullRequests(thread);
  return all.length > 1 ? all : EMPTY;
}
