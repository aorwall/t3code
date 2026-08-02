import {
  isAtomCommandInterrupted,
  squashAtomCommandFailure,
} from "@t3tools/client-runtime/state/runtime";
import type { SandboxStatusResult, ScopedThreadRef } from "@t3tools/contracts";
import { AlertTriangleIcon, LoaderCircleIcon, PlayIcon } from "lucide-react";
import { useCallback, useState } from "react";

import { cn } from "~/lib/utils";
import type { EnvironmentQueryView } from "~/state/query";
import { serversEnvironment } from "~/state/servers";
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
}

function failureMessage(error: unknown): string {
  return error instanceof Error && error.message.trim().length > 0
    ? error.message
    : "Could not start the sandbox.";
}

export function SandboxStatusControl({ threadRef, status, className }: SandboxStatusControlProps) {
  const startSandbox = useAtomCommand(serversEnvironment.startSandbox, { reportFailure: false });
  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const { refresh } = status;
  const sandboxStatus = status.data?.sandboxStatus ?? null;

  const startable =
    !status.isPending && sandboxStatus !== null && STARTABLE_STATUSES.has(sandboxStatus);

  const handleStart = useCallback(async () => {
    setStartError(null);
    setIsStarting(true);
    const result = await startSandbox({
      environmentId: threadRef.environmentId,
      input: { threadId: threadRef.threadId },
    });
    setIsStarting(false);
    refresh();
    if (result._tag === "Success" || isAtomCommandInterrupted(result)) {
      return;
    }
    setStartError(failureMessage(squashAtomCommandFailure(result)));
  }, [refresh, startSandbox, threadRef.environmentId, threadRef.threadId]);

  const statusMeta = !status.isPending && sandboxStatus ? STATUS_COPY[sandboxStatus] : null;
  const tone =
    startError || status.error
      ? "error"
      : status.isPending
        ? "muted"
        : (statusMeta?.tone ?? "warning");
  const label =
    status.isPending && !startError && !status.error
      ? "Checking sandbox status"
      : sandboxStatus === "ready"
        ? "Sandbox running"
        : "Sandbox unavailable";
  const showRetry = Boolean(status.error) && !startable;
  const actionLabel = sandboxStatus === "error" || startError ? "Retry" : "Start";

  return (
    <div
      aria-live="polite"
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
        <div className="min-w-0 truncate text-xs font-medium text-foreground">{label}</div>
      </div>
      {showRetry ? (
        <Button size="xs" variant="outline" onClick={status.refresh}>
          Retry
        </Button>
      ) : startable ? (
        <Button size="xs" variant="outline" disabled={isStarting} onClick={handleStart}>
          {isStarting ? (
            <LoaderCircleIcon className="size-3.5 animate-spin" />
          ) : (
            <PlayIcon className="size-3.5" />
          )}
          <span>{actionLabel}</span>
        </Button>
      ) : null}
    </div>
  );
}
