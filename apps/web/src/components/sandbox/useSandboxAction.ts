/**
 * Fork-only: running one sandbox lifecycle action for a thread, shared by the
 * Sandbox panel's buttons and the thread details row's menu so the two confirm
 * and report alike.
 */
import {
  isAtomCommandInterrupted,
  squashAtomCommandFailure,
} from "@t3tools/client-runtime/state/runtime";
import type { ScopedThreadRef } from "@t3tools/contracts";
import { useCallback, useState } from "react";

import { requestConfirmDialog } from "~/confirmDialog";
import { sandboxEnvironment } from "~/state/sandbox";
import { useAtomCommand } from "~/state/use-atom-command";

import {
  SANDBOX_ACTION_CONFIRMATIONS,
  SANDBOX_CONFIRM_ACTIONS,
  type SandboxAction,
} from "./sandboxPanelFormat";

function failureMessage(error: unknown): string {
  return error instanceof Error && error.message.trim().length > 0
    ? error.message
    : "The sandbox request failed.";
}

/**
 * `run` resolves to the failure message, or null when the action succeeded, was
 * declined at the confirm step, or was interrupted. `onSettled` runs after every
 * request that was sent, so the caller can refresh what it reads.
 */
export function useSandboxAction(threadRef: ScopedThreadRef, onSettled: () => void) {
  const start = useAtomCommand(sandboxEnvironment.start, { reportFailure: false });
  const stop = useAtomCommand(sandboxEnvironment.stop, { reportFailure: false });
  const restart = useAtomCommand(sandboxEnvironment.restart, { reportFailure: false });
  const redeploy = useAtomCommand(sandboxEnvironment.redeploy, { reportFailure: false });
  const cleanup = useAtomCommand(sandboxEnvironment.cleanup, { reportFailure: false });
  const [pending, setPending] = useState<SandboxAction | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (action: SandboxAction): Promise<string | null> => {
      if (SANDBOX_CONFIRM_ACTIONS.has(action)) {
        // Undefined means no themed host is mounted, and the click itself was
        // the request; the same reading `ServerUpdateAction` takes.
        const confirmed =
          (await requestConfirmDialog(SANDBOX_ACTION_CONFIRMATIONS[action] ?? "", {
            variant: "destructive",
          })) ?? true;
        if (!confirmed) return null;
      }
      const commands = { start, stop, restart, redeploy, cleanup };
      setError(null);
      setPending(action);
      const result = await commands[action]({
        environmentId: threadRef.environmentId,
        input: { threadId: threadRef.threadId },
      });
      setPending(null);
      onSettled();
      if (result._tag === "Success" || isAtomCommandInterrupted(result)) return null;
      const message = failureMessage(squashAtomCommandFailure(result));
      setError(message);
      return message;
    },
    [
      cleanup,
      onSettled,
      redeploy,
      restart,
      start,
      stop,
      threadRef.environmentId,
      threadRef.threadId,
    ],
  );

  return { run, pending, error };
}
