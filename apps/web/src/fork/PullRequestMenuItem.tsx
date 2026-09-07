/**
 * Fork-only. One menu row for a pull request a Moatless Task is bound to.
 *
 * A `ThreadLinkedPullRequest` carries a repository, a number and a URL, and no
 * title or state — so a row built from it alone can only say "View PR #7", and
 * two of those tell a reader nothing about which one they want. The state and
 * the title are read here per row, through `pullRequests.summary`, which is the
 * same call the sidebar already makes for a thread's primary pull request.
 *
 * The rows mount when the menu opens, so that call is paid on open rather than
 * on every render of the composer.
 */
import type { EnvironmentId, ThreadLinkedPullRequest } from "@t3tools/contracts";
import type { MouseEvent as ReactMouseEvent } from "react";

import { cn } from "~/lib/utils";
import { getSourceControlPresentation } from "~/sourceControlPresentation";

import { resolvePullRequestState } from "../components/pullRequest/pullRequestPresentation";
import { useLinkedThreadPullRequest } from "../components/ThreadStatusIndicators";
import { MenuItem } from "../components/ui/menu";

export function ForkPullRequestMenuItem({
  environmentId,
  pullRequest,
  onOpen,
}: {
  readonly environmentId: EnvironmentId | null;
  readonly pullRequest: ThreadLinkedPullRequest;
  /** Runs on activation, with the row's own click event so a modifier still reaches it. */
  readonly onOpen: (event: ReactMouseEvent<HTMLElement>) => void;
}) {
  const status = useLinkedThreadPullRequest(environmentId, pullRequest);
  const presentation = getSourceControlPresentation(status?.sourceControlProvider ?? null);
  const state =
    status === null
      ? null
      : resolvePullRequestState({ state: status.pr.state, isDraft: status.pr.isDraft === true });
  // Until the summary answers there is no state to show, and the provider's own
  // icon is the one thing true of every row: a status icon here would have to
  // invent "open". The title line keeps its height either way, so the popup does
  // not jump as the rows fill in.
  const StateIcon = state?.Icon ?? presentation.Icon;

  return (
    <MenuItem
      // Bounded here rather than on either popup: both size themselves to their
      // content, and a title is long enough to stretch a menu off the screen.
      className="max-w-[22rem] items-start gap-2 py-1.5"
      onClick={(event) => {
        onOpen(event);
      }}
    >
      <StateIcon className={cn("mt-0.5 size-3.5 shrink-0", state?.toneClassName)} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex min-w-0 items-baseline gap-1.5">
          <span className={cn("shrink-0 font-medium tabular-nums", state?.toneClassName)}>
            #{pullRequest.number}
          </span>
          <span className="min-w-0 truncate text-muted-foreground text-xs">
            {pullRequest.repository}
          </span>
          {state ? (
            <span className="ms-auto shrink-0 text-muted-foreground/70 text-xs">{state.label}</span>
          ) : null}
        </span>
        <span className="min-h-4 min-w-0 truncate text-muted-foreground text-xs">
          {status?.pr.title ?? ""}
        </span>
      </span>
    </MenuItem>
  );
}
