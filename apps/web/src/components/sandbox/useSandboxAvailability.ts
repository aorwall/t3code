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
  const { data, error, isPending: queryIsPending, refresh } = query;
  const sandboxStatus = data?.sandboxStatus ?? null;
  const isPending = queryIsPending && sandboxStatus === null;

  useEffect(() => {
    if (threadRef === null || pushed) return;
    refresh();
  }, [pushed, refresh, threadRef?.environmentId, threadRef?.threadId]);

  const status = useMemo<EnvironmentQueryView<SandboxStatusResult>>(
    () => ({
      data,
      error,
      isPending,
      refresh,
    }),
    [data, error, isPending, refresh],
  );

  const ready = sandboxStatus === "ready";

  return {
    ready,
    surfaceDisabled: !ready,
    surfaceDisabledReason: disabledReason(sandboxStatus, isPending, error),
    status,
  };
}
