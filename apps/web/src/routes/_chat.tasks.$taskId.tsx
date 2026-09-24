/**
 * Fork-only. `/tasks/<task id>` is the URL Moatless prints for a task, so a
 * link pasted from Slack, a pull request or the Moatless UI lands here. It
 * forwards to the thread route under the connected deployment's environment.
 *
 * Sits under `_chat` so an unauthenticated visitor gets the login redirect and
 * the return-to that layout already owns, and so this static path outranks
 * `$environmentId/$threadId`, which would otherwise match `/tasks/<task id>`
 * with `tasks` read as an environment.
 */
import { useAtomValue } from "@effect/atom-react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";

import { Button } from "../components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "../components/ui/empty";
import { SidebarInset } from "../components/ui/sidebar";
import { environmentCatalog } from "../connection/catalog";
import { resolveMoatlessTaskLink } from "../fork/moatlessTaskLink";
import { usePrimaryEnvironmentId } from "../state/environments";

function MoatlessTaskLinkRouteView() {
  const navigate = useNavigate();
  const taskId = Route.useParams({ select: (params) => params.taskId });
  const primaryEnvironmentId = usePrimaryEnvironmentId();
  const catalogReady = useAtomValue(environmentCatalog.catalogValueAtom).isReady;
  const resolution = useMemo(
    () => resolveMoatlessTaskLink({ taskId, primaryEnvironmentId, catalogReady }),
    [catalogReady, primaryEnvironmentId, taskId],
  );

  useEffect(() => {
    if (resolution.kind !== "resolved") {
      return;
    }
    void navigate({
      to: "/$environmentId/$threadId",
      params: {
        environmentId: resolution.environmentId,
        threadId: resolution.threadId,
      },
      replace: true,
    });
  }, [navigate, resolution]);

  if (resolution.kind !== "unresolvable") {
    return null;
  }

  return (
    <SidebarInset className="h-dvh min-h-0 overflow-hidden overscroll-y-none">
      <Empty className="flex-1">
        <EmptyHeader className="max-w-md">
          <EmptyTitle>Couldn’t open this task</EmptyTitle>
          <EmptyDescription className="mt-2">
            This browser isn’t connected to a Moatless deployment, so there is nowhere to look the
            task up.
          </EmptyDescription>
          <div className="mt-5 flex justify-center">
            <Button render={<Link to="/" />} size="sm">
              Go to your threads
            </Button>
          </div>
        </EmptyHeader>
      </Empty>
    </SidebarInset>
  );
}

export const Route = createFileRoute("/_chat/tasks/$taskId")({
  component: MoatlessTaskLinkRouteView,
});
