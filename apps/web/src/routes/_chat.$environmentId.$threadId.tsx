import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import ChatView from "../components/ChatView";
import { threadHasStarted } from "../components/ChatView.logic";
import { finalizePromotedDraftThreadByRef, useComposerDraftStore } from "../composerDraftStore";
import { resolveThreadRouteRef, resolveThreadRouteRenderState } from "../threadRoutes";
import { resolveThreadSyncPhase } from "../threadSync";
// Fork: a Moatless shell listing is the open work you follow, so a thread
// reached by link, subtask row or archive is absent from it and still real.
import {
  useAdoptedThread,
  useAutoFollowThread,
  useThreadAwaitingFirstAnswer,
} from "~/fork/unlistedThread";
import { useSidebarPendingFileDropStore } from "../sidebarPendingFileDropStore";
import { SidebarInset } from "~/components/ui/sidebar";
import {
  useEnvironmentThreadRefs,
  useThreadDetail,
  useThreadShell,
  useThreadStatus,
} from "../state/entities";
import { useEnvironmentQuery } from "../state/query";
import { environmentShell } from "../state/shell";

function ChatThreadRouteView() {
  const navigate = useNavigate();
  const threadRef = Route.useParams({
    select: (params) => resolveThreadRouteRef(params),
  });
  const shell = useEnvironmentQuery(
    threadRef === null ? null : environmentShell.stateAtom(threadRef.environmentId),
  );
  const serverThreadShell = useThreadShell(threadRef);
  const serverThreadDetail = useThreadDetail(threadRef);
  const serverThreadStatus = useThreadStatus(threadRef);
  const environmentThreadRefs = useEnvironmentThreadRefs(threadRef?.environmentId ?? null);
  const bootstrapComplete = shell.data?.snapshot._tag === "Some";
  const environmentHasServerThreads = environmentThreadRefs.length > 0;
  const draftThreadExists = useComposerDraftStore((store) =>
    threadRef ? store.getDraftThreadByRef(threadRef) !== null : false,
  );
  const draftThread = useComposerDraftStore((store) =>
    threadRef ? store.getDraftThreadByRef(threadRef) : null,
  );
  const environmentHasDraftThreads = useComposerDraftStore((store) => {
    if (!threadRef) {
      return false;
    }
    return store.hasDraftThreadsInEnvironment(threadRef.environmentId);
  });
  // Fork: fetch this thread's listing row, so a thread no listing carried is
  // named, grouped and badged like any other for as long as it is open here.
  useAdoptedThread(threadRef?.environmentId ?? null, threadRef?.threadId ?? null);
  // Fork: opening a thread the listing does not carry follows it, so it stays
  // in the sidebar after this route closes. Unfollow in the row menu is the way
  // back out.
  useAutoFollowThread(threadRef);
  const serverThreadAwaitingFirstAnswer = useThreadAwaitingFirstAnswer(threadRef);
  const renderState = resolveThreadRouteRenderState({
    bootstrapComplete,
    serverThreadShellExists: serverThreadShell !== null,
    serverThreadDetailExists: serverThreadDetail !== null,
    serverThreadDetailDeleted: serverThreadStatus === "deleted",
    draftThreadExists,
    // Fork: without this the route leaves for `/` on the first frame of every
    // thread the listing does not carry — before its subscription can answer.
    serverThreadAwaitingFirstAnswer,
  });
  const threadSyncPhase = resolveThreadSyncPhase({
    detailExists: serverThreadDetail !== null,
    shellExists: serverThreadShell !== null,
    status: serverThreadStatus,
  });
  const serverThreadStarted = threadHasStarted(serverThreadDetail);
  const environmentHasAnyThreads = environmentHasServerThreads || environmentHasDraftThreads;

  useEffect(() => {
    if (!threadRef || !bootstrapComplete) {
      return;
    }

    // Navigation already resolved onto this path, so a drop aimed here
    // passed its landing check; once the thread reads as missing it can
    // never be attached, release it even when there is nowhere to redirect.
    if (renderState === "missing") {
      const { clearPendingFileDropsForThread } = useSidebarPendingFileDropStore.getState();
      clearPendingFileDropsForThread(threadRef);
      if (environmentHasAnyThreads) {
        void navigate({ to: "/", replace: true });
      }
    }
  }, [bootstrapComplete, environmentHasAnyThreads, navigate, renderState, threadRef]);

  useEffect(() => {
    if (!threadRef || !serverThreadStarted || !draftThread) {
      return;
    }
    finalizePromotedDraftThreadByRef(threadRef);
  }, [draftThread, serverThreadStarted, threadRef]);

  if (!threadRef) {
    return null;
  }

  return (
    <SidebarInset className="h-svh min-h-0 overflow-hidden overscroll-y-none bg-background text-foreground md:h-dvh">
      {renderState === "ready" || (renderState === "loading" && serverThreadShell !== null) ? (
        <ChatView
          environmentId={threadRef.environmentId}
          threadId={threadRef.threadId}
          routeKind="server"
          threadSyncPhase={threadSyncPhase}
        />
      ) : null}
    </SidebarInset>
  );
}

export const Route = createFileRoute("/_chat/$environmentId/$threadId")({
  component: ChatThreadRouteView,
});
