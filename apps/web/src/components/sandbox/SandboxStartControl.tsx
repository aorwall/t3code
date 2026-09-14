/**
 * Fork-only: the one-click way to start a stopped sandbox from the disabled
 * surface state, so starting one no longer requires a detour through the
 * Sandbox panel.
 *
 * Renders nothing while the sandbox's status is still unknown or mid-transition
 * (`initializing`/`removing`) — `sandboxActionsFor` already excludes `start`
 * there, and offering it would race the transition already under way.
 */
import {
  isAtomCommandInterrupted,
  squashAtomCommandFailure,
} from "@t3tools/client-runtime/state/runtime";
import type { SandboxStatusResult, ScopedThreadRef } from "@t3tools/contracts";
import { LoaderCircleIcon, PlayIcon } from "lucide-react";
import { useCallback, useState } from "react";

import type { EnvironmentQueryView } from "~/state/query";
import { sandboxEnvironment } from "~/state/sandbox";
import { useAtomCommand } from "~/state/use-atom-command";

import { Button } from "../ui/button";
import { sandboxActionsFor } from "./sandboxPanelFormat";

interface SandboxStartControlProps {
  readonly threadRef: ScopedThreadRef;
  readonly status: EnvironmentQueryView<SandboxStatusResult>;
}

function failureMessage(error: unknown): string {
  return error instanceof Error && error.message.trim().length > 0
    ? error.message
    : "The sandbox request failed.";
}

export function SandboxStartControl({ threadRef, status }: SandboxStartControlProps) {
  const start = useAtomCommand(sandboxEnvironment.start, { reportFailure: false });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { refresh } = status;

  const sandboxStatus = status.isPending ? null : (status.data?.sandboxStatus ?? null);
  const canStart = sandboxActionsFor(sandboxStatus).has("start");
  const starting = pending || status.data?.sandboxStatus === "initializing";

  const run = useCallback(async () => {
    setError(null);
    setPending(true);
    const result = await start({
      environmentId: threadRef.environmentId,
      input: { threadId: threadRef.threadId },
    });
    setPending(false);
    refresh();
    if (result._tag === "Success" || isAtomCommandInterrupted(result)) return;
    setError(failureMessage(squashAtomCommandFailure(result)));
  }, [refresh, start, threadRef.environmentId, threadRef.threadId]);

  if (!canStart && !starting) return null;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <Button size="sm" onClick={() => void run()} disabled={starting}>
        {starting ? (
          <LoaderCircleIcon className="size-3.5 animate-spin" />
        ) : (
          <PlayIcon className="size-3.5" />
        )}
        <span>{starting ? "Starting…" : "Start sandbox"}</span>
      </Button>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
