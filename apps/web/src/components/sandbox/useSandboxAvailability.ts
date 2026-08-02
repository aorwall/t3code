import type { SandboxStatusResult, ScopedThreadRef } from "@t3tools/contracts";
import { useEffect, useMemo } from "react";

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
  const query = useEnvironmentQuery(
    threadRef === null
      ? null
      : sandboxEnvironment.status({
          environmentId: threadRef.environmentId,
          input: { threadId: threadRef.threadId },
        }),
  );
  const { data, error, isPending: queryIsPending, refresh } = query;
  const sandboxStatus = data?.sandboxStatus ?? null;
  const isPending = queryIsPending && sandboxStatus === null;

  useEffect(() => {
    if (threadRef === null) return;
    refresh();
  }, [refresh, threadRef?.environmentId, threadRef?.threadId]);

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
