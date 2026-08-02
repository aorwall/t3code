import {
  isAtomCommandInterrupted,
  squashAtomCommandFailure,
} from "@t3tools/client-runtime/state/runtime";
import type { SandboxStatusResult, ScopedThreadRef } from "@t3tools/contracts";
import { AlertTriangleIcon, LoaderCircleIcon, PlayIcon, SquareIcon } from "lucide-react";
import { useCallback, useState } from "react";

import { cn } from "~/lib/utils";
import type { EnvironmentQueryView } from "~/state/query";
import { sandboxEnvironment } from "~/state/sandbox";
import { useAtomCommand } from "~/state/use-atom-command";

import { Button } from "./ui/button";

type SandboxStatus = SandboxStatusResult["sandboxStatus"];

const STATUS_COPY: Record<SandboxStatus, { readonly tone: "muted" | "warning" | "error" }> = {
  not_created: {
    tone: "warning",
  },
  initializing: {
    tone: "muted",
  },
  ready: {
    tone: "muted",
  },
  stopped: {
    tone: "warning",
  },
  removing: {
    tone: "muted",
  },
  removed: {
    tone: "warning",
  },
  error: {
    tone: "error",
  },
};

const STARTABLE_STATUSES = new Set<SandboxStatus>(["not_created", "stopped", "removed", "error"]);

interface SandboxStatusControlProps {
  readonly threadRef: ScopedThreadRef;
  readonly status: EnvironmentQueryView<SandboxStatusResult>;
  readonly className?: string | undefined;
  /**
   * Drop the status text and keep only the indicator and its action, for hosts
   * too narrow to spare the width. The text moves to the hover title.
   */
  readonly compact?: boolean | undefined;
}

function failureMessage(error: unknown): string {
  return error instanceof Error && error.message.trim().length > 0
    ? error.message
    : "The sandbox request failed.";
}

export function SandboxStatusControl({
  threadRef,
  status,
  className,
  compact,
}: SandboxStatusControlProps) {
  const startSandbox = useAtomCommand(sandboxEnvironment.start, { reportFailure: false });
  const stopSandbox = useAtomCommand(sandboxEnvironment.stop, { reportFailure: false });
  const [pendingAction, setPendingAction] = useState<"start" | "stop" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const { refresh } = status;
  const sandboxStatus = status.data?.sandboxStatus ?? null;

  const startable =
    !status.isPending && sandboxStatus !== null && STARTABLE_STATUSES.has(sandboxStatus);
  const stoppable = !status.isPending && sandboxStatus === "ready";

  const handleStart = useCallback(async () => {
    setActionError(null);
    setPendingAction("start");
    const result = await startSandbox({
      environmentId: threadRef.environmentId,
      input: { threadId: threadRef.threadId },
    });
    setPendingAction(null);
    refresh();
    if (result._tag === "Success" || isAtomCommandInterrupted(result)) {
      return;
    }
    setActionError(failureMessage(squashAtomCommandFailure(result)));
  }, [refresh, startSandbox, threadRef.environmentId, threadRef.threadId]);

  const handleStop = useCallback(async () => {
    setActionError(null);
    setPendingAction("stop");
    const result = await stopSandbox({
      environmentId: threadRef.environmentId,
      input: { threadId: threadRef.threadId },
    });
    setPendingAction(null);
    refresh();
    if (result._tag === "Success" || isAtomCommandInterrupted(result)) {
      return;
    }
    setActionError(failureMessage(squashAtomCommandFailure(result)));
  }, [refresh, stopSandbox, threadRef.environmentId, threadRef.threadId]);

  const statusMeta = !status.isPending && sandboxStatus ? STATUS_COPY[sandboxStatus] : null;
  const tone =
    actionError || status.error
      ? "error"
      : status.isPending
        ? "muted"
        : (statusMeta?.tone ?? "warning");
  const label =
    status.isPending && !actionError && !status.error
      ? "Checking sandbox status"
      : sandboxStatus === "ready"
        ? "Sandbox running"
        : "Sandbox unavailable";
  const showRetry = Boolean(status.error) && !startable;
  const actionLabel = sandboxStatus === "error" || actionError ? "Retry" : "Start";

  return (
    <div
      aria-live="polite"
      title={compact ? label : undefined}
      className={cn(
        "flex min-w-0 shrink-0 items-center gap-2 rounded-md border border-border/70 bg-background px-2 py-1 shadow-xs",
        tone === "error" && "border-destructive/35 bg-destructive/5",
        tone === "warning" && "border-warning/35 bg-warning/5",
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        {status.isPending || sandboxStatus === "initializing" || sandboxStatus === "removing" ? (
          <LoaderCircleIcon className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
        ) : tone === "error" ? (
          <AlertTriangleIcon className="size-3.5 shrink-0 text-destructive" />
        ) : (
          <span className="size-2 shrink-0 rounded-full bg-warning" />
        )}
        <div
          className={cn(
            "min-w-0 truncate text-xs font-medium text-foreground",
            compact && "sr-only",
          )}
        >
          {label}
        </div>
      </div>
      {showRetry ? (
        <Button size="xs" variant="outline" onClick={status.refresh}>
          Retry
        </Button>
      ) : startable ? (
        <Button size="xs" variant="outline" disabled={pendingAction !== null} onClick={handleStart}>
          {pendingAction === "start" ? (
            <LoaderCircleIcon className="size-3.5 animate-spin" />
          ) : (
            <PlayIcon className="size-3.5" />
          )}
          <span>{actionLabel}</span>
        </Button>
      ) : stoppable ? (
        <Button size="xs" variant="outline" disabled={pendingAction !== null} onClick={handleStop}>
          {pendingAction === "stop" ? (
            <LoaderCircleIcon className="size-3.5 animate-spin" />
          ) : (
            <SquareIcon className="size-3.5" />
          )}
          <span>Stop</span>
        </Button>
      ) : null}
    </div>
  );
}
