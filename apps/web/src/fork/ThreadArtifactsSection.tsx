/**
 * Fork-only. The Artifacts a thread's task has published — the HTML pages an
 * agent publishes with `moat artifact publish` — as a section of the thread
 * details panel, below the agents.
 *
 * A row opens the page in the right panel's browser, like the chat's artifact
 * chip (`MoatlessArtifactChip`); a modifier click, or a client with no in-app
 * browser, keeps the anchor's own new-tab behaviour.
 */
import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import { isAtomCommandInterrupted } from "@t3tools/client-runtime/state/runtime";
import {
  AuthPreviewOperateScope,
  type EnvironmentId,
  type ScopedThreadRef,
  type ThreadId,
} from "@t3tools/contracts";
import { customInstance, type MoatlessResponse } from "@t3tools/moatless-api/customInstance";
import { FileTextIcon } from "lucide-react";
import { useEffect, useRef } from "react";

import { recordVisitForThread } from "~/browserHistoryStore";
import { openUrlInPreview } from "~/browser/openFileInPreview";
import { ThreadDetailsSection } from "~/components/chat/ThreadDetailsSection";
import {
  THREAD_DETAILS_PANEL_ICON_CLASS,
  THREAD_DETAILS_PANEL_LABEL_CLASS,
  THREAD_DETAILS_PANEL_ROW_CLASS,
} from "~/components/chat/threadDetailsPanelStyles";
import { resolvePrimaryEnvironmentHttpUrl } from "~/environments/primary/target";
import { readLocalApi } from "~/localApi";
import { cn } from "~/lib/utils";
import { moatlessQuery, useMoatlessQuery } from "~/moatless/query";
import { isPreviewSupportedInRuntime } from "~/previewStateStore";
import { useThreadShell } from "~/state/entities";
import { previewEnvironment } from "~/state/preview";
import { useEnvironmentScope } from "~/state/session";
import { useAtomCommand } from "~/state/use-atom-command";
import { formatRelativeTimeLabel } from "~/timestampFormat";

import { moatlessApiAvailable } from "./features";

/** The fields of the backend's `ArtifactResponse` this section reads. */
export interface TaskArtifact {
  readonly artifactId: string;
  readonly title: string;
  readonly updatedAt: string;
}

interface ListArtifactsResponse {
  readonly items: ReadonlyArray<TaskArtifact>;
}

/** A task's Artifacts, most recently updated first. A thread id is its task id. */
function taskArtifactsQuery(threadId: ThreadId) {
  return moatlessQuery<ListArtifactsResponse>(`tasks/${threadId}/artifacts`, () =>
    customInstance<MoatlessResponse<unknown>>(
      `/api/v1/tasks/${encodeURIComponent(threadId)}/artifacts`,
      { method: "GET" },
    ),
  );
}

/**
 * The URL that always redirects to an Artifact's latest version, on the
 * client's own origin rather than the backend's configured public URL in
 * `latestUrl`: the in-app browser and the chat chip both recognise this form.
 */
export function artifactLatestHref(artifactId: string): string {
  const path = `/api/v1/artifacts/${encodeURIComponent(artifactId)}`;
  try {
    return resolvePrimaryEnvironmentHttpUrl(path);
  } catch {
    // No primary target to resolve against: the page is served same-origin.
    return new URL(path, window.location.origin).toString();
  }
}

/** The section, or nothing when the thread has no Artifacts or the server is not Moatless. */
export function ThreadArtifactsSection(props: {
  readonly environmentId: EnvironmentId;
  readonly threadId: ThreadId;
}) {
  if (!moatlessApiAvailable()) return null;
  return <ArtifactsList {...props} />;
}

function ArtifactsList(props: {
  readonly environmentId: EnvironmentId;
  readonly threadId: ThreadId;
}) {
  const threadRef = scopeThreadRef(props.environmentId, props.threadId);
  const query = taskArtifactsQuery(props.threadId);
  const { data, error, refresh } = useMoatlessQuery(query);
  useRefreshWhenRunSettles(threadRef, refresh);

  const artifacts = data?.items ?? [];
  if (error === null && artifacts.length === 0) return null;

  return (
    <ThreadDetailsSection
      headingId="thread-details-artifacts-heading"
      title={artifacts.length > 0 ? `Artifacts · ${artifacts.length}` : "Artifacts"}
      data-thread-artifacts-panel
    >
      {error !== null && artifacts.length === 0 ? (
        <p className="px-2.5 py-1.5 text-2xs text-destructive">Could not load artifacts.</p>
      ) : null}
      <ul className="m-0 list-none p-0">
        {artifacts.map((artifact) => (
          <li key={artifact.artifactId}>
            <ArtifactRow artifact={artifact} threadRef={threadRef} />
          </li>
        ))}
      </ul>
    </ThreadDetailsSection>
  );
}

/**
 * Refetch when the thread's latest run changes status. An agent publishes
 * during a run, so a run that settles is when the list is likely to have grown;
 * refetching on every new message instead would read the list per tool call.
 */
function useRefreshWhenRunSettles(threadRef: ScopedThreadRef, refresh: () => void) {
  const latestRun = useThreadShell(threadRef)?.latestRun ?? null;
  const runKey = latestRun === null ? null : `${latestRun.runId}:${latestRun.status}`;
  const previous = useRef(runKey);
  useEffect(() => {
    if (previous.current === runKey) return;
    previous.current = runKey;
    refresh();
  }, [refresh, runKey]);
}

function ArtifactRow(props: {
  readonly artifact: TaskArtifact;
  readonly threadRef: ScopedThreadRef;
}) {
  const { artifact, threadRef } = props;
  const href = artifactLatestHref(artifact.artifactId);
  const openPreview = useAtomCommand(previewEnvironment.open, { reportFailure: false });
  const canOperatePreview = useEnvironmentScope(threadRef.environmentId, AuthPreviewOperateScope);
  const canOpenInPreview = canOperatePreview && isPreviewSupportedInRuntime();
  const updated = formatRelativeTimeLabel(artifact.updatedAt);

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Open artifact ${artifact.title}`}
      className={cn("flex items-center", THREAD_DETAILS_PANEL_ROW_CLASS)}
      onClick={(event) => {
        if (
          !canOpenInPreview ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        ) {
          return;
        }
        event.preventDefault();
        void openUrlInPreview({ threadRef, url: href, openPreview }).then((result) => {
          if (result._tag === "Success") {
            recordVisitForThread(threadRef, href);
            return;
          }
          if (isAtomCommandInterrupted(result)) return;
          // The panel could not take it; the page is still worth showing.
          void readLocalApi()?.shell.openExternal(href);
        });
      }}
    >
      <FileTextIcon aria-hidden className={THREAD_DETAILS_PANEL_ICON_CLASS} />
      <span className={cn("min-w-0 flex-1 truncate", THREAD_DETAILS_PANEL_LABEL_CLASS)}>
        {artifact.title}
      </span>
      {updated === "" ? null : (
        <span className="shrink-0 text-2xs font-normal tabular-nums text-muted-foreground">
          {updated}
        </span>
      )}
    </a>
  );
}
