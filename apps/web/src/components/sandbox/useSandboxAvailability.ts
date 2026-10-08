import type { SandboxStatusResult, ScopedThreadRef } from "@t3tools/contracts";
import { useEffect, useMemo } from "react";

import { useEnvironment } from "~/state/environments";
import { useEnvironmentQuery, type EnvironmentQueryView } from "~/state/query";
import { sandboxEnvironment } from "~/state/sandbox";

type SandboxStatus = SandboxStatusResult["sandboxStatus"];

export interface SandboxAvailability {
  readonly ready: boolean;
  readonly surfaceDisabled: boolean;
  readonly surfaceDisabledReason: string;
  readonly status: EnvironmentQueryView<SandboxStatusResult>;
}

function disabledReason(
  status: SandboxStatus | null,
  isPending: boolean,
  error: string | null,
): string {
  if (error) return error;
  if (isPending) return "Checking sandbox status.";
  switch (status) {
    case "initializing":
      return "The sandbox is starting.";
    case "removing":
      return "The sandbox is being removed.";
    case "removed":
      return "Start the sandbox to recreate the workspace environment.";
    case "error":
      return "Retry starting the sandbox.";
    default:
      return "Start the sandbox to use right-panel surfaces.";
  }
}

const FAILED_STREAM_RETRY_MS = 3_000;

/**
 * Resubscribes a pushed sandbox stream that ended in a failure. The client
 * never retries a refusal, and the atom keeps it per thread, so a draft that
 * subscribed before its task existed reads "This thread is not available."
 * until a reload. Each failed retry toggles `isPending`, which schedules the next.
 */
export function useRetryFailedSandboxStream(
  enabled: boolean,
  query: Pick<EnvironmentQueryView<unknown>, "error" | "isPending" | "refresh">,
): void {
  const { error, isPending, refresh } = query;
  useEffect(() => {
    if (!enabled || error === null || isPending) return;
    const timer = setTimeout(refresh, FAILED_STREAM_RETRY_MS);
    return () => clearTimeout(timer);
  }, [enabled, error, isPending, refresh]);
}

export function useSandboxAvailability(threadRef: ScopedThreadRef | null): SandboxAvailability {
  // Where the environment pushes lifecycle, one subscription replaces the
  // poll entirely — it is seeded with the current status, so there is nothing
  // left for a read to answer first.
  const environment = useEnvironment(threadRef?.environmentId ?? null);
  const pushed = environment?.serverConfig?.environment.capabilities.sandboxStatusPush === true;

  const live = useEnvironmentQuery(
    threadRef === null || !pushed
      ? null
      : sandboxEnvironment.statusStream({
          environmentId: threadRef.environmentId,
          input: { threadId: threadRef.threadId },
        }),
  );
  const polled = useEnvironmentQuery(
    threadRef === null || pushed
      ? null
      : sandboxEnvironment.status({
          environmentId: threadRef.environmentId,
          input: { threadId: threadRef.threadId },
        }),
  );
  const query = pushed ? live : polled;
  const {
    data,
    dataUpdatedAt,
    error,
    failure,
    isPending: queryIsPending,
    isSuccess,
    refresh,
  } = query;
  const sandboxStatus = data?.sandboxStatus ?? null;
  const isPending = queryIsPending && sandboxStatus === null;

  useEffect(() => {
    if (threadRef === null || pushed) return;
    refresh();
  }, [pushed, refresh, threadRef?.environmentId, threadRef?.threadId]);
  useRetryFailedSandboxStream(threadRef !== null && pushed, live);

  const status = useMemo<EnvironmentQueryView<SandboxStatusResult>>(
    () => ({
      data,
      dataUpdatedAt,
      error,
      failure,
      isPending,
      isSuccess,
      refresh,
    }),
    [data, dataUpdatedAt, error, failure, isPending, isSuccess, refresh],
  );

  const ready = sandboxStatus === "ready";

  return {
    ready,
    surfaceDisabled: !ready,
    surfaceDisabledReason: disabledReason(sandboxStatus, isPending, error),
    status,
  };
}
