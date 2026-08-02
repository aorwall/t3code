import type { SandboxStatusResult, ScopedThreadRef } from "@t3tools/contracts";
import { useEffect, useMemo } from "react";

import type { EnvironmentQueryView } from "~/state/query";

import { useThreadPreviewServers } from "../preview/useThreadPreviewServers";

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
  const previewServers = useThreadPreviewServers(threadRef);
  const sandboxStatus = previewServers.sandboxStatus;
  const isPending = previewServers.isPending && sandboxStatus === null;

  useEffect(() => {
    if (threadRef === null) return;
    previewServers.refresh();
  }, [threadRef?.environmentId, threadRef?.threadId]);

  const status = useMemo<EnvironmentQueryView<SandboxStatusResult>>(
    () => ({
      data: sandboxStatus === null ? null : { sandboxStatus },
      error: previewServers.error,
      isPending,
      refresh: previewServers.refresh,
    }),
    [isPending, previewServers.error, previewServers.refresh, sandboxStatus],
  );

  const ready = sandboxStatus === "ready";

  return {
    ready,
    surfaceDisabled: !ready,
    surfaceDisabledReason: disabledReason(sandboxStatus, isPending, previewServers.error),
    status,
  };
}
