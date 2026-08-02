import { useParams } from "@tanstack/react-router";
import { useMemo } from "react";

import { useComposerDraftStore } from "../../composerDraftStore";
import { resolveActiveThreadRouteRef, resolveThreadRouteTarget } from "../../threadRoutes";
import { SandboxStatusControl } from "../SandboxStatusControl";
import { useSandboxAvailability } from "./useSandboxAvailability";

/**
 * Sandbox status and start/stop for the thread the route is on, hosted in the
 * sidebar so it stays in one place instead of moving with the chat header's
 * per-thread actions.
 *
 * A draft route has no sandbox until the draft is promoted to a server thread,
 * and a route with no thread at all has nothing to report — both render
 * nothing.
 */
export function SidebarSandboxStatus() {
  const routeTarget = useParams({
    strict: false,
    select: (params) => resolveThreadRouteTarget(params),
  });
  const routeDraftThread = useComposerDraftStore((store) =>
    routeTarget?.kind === "draft" ? store.getDraftSession(routeTarget.draftId) : null,
  );
  const threadRef = useMemo(
    () => resolveActiveThreadRouteRef(routeTarget, routeDraftThread),
    [routeDraftThread, routeTarget],
  );
  const { status } = useSandboxAvailability(threadRef);

  if (threadRef === null) {
    return null;
  }

  // The footer is a stretching flex column, so the pill already spans the
  // sidebar — the label takes the room and the action button sits at the end.
  return <SandboxStatusControl threadRef={threadRef} status={status} className="justify-between" />;
}
