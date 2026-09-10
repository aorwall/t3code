/**
 * Fork-only: the sandbox panel's read.
 *
 * The same push-or-poll choice `useSandboxAvailability` makes for the status
 * indicator, at a tenth the rate. Both are needed because they answer different
 * questions and the backend serves them as two subscriptions; see the
 * `SandboxDetail` contract module.
 */
import type { SandboxDetailResult, ScopedThreadRef } from "@t3tools/contracts";
import { useEffect, useMemo } from "react";

import { useEnvironment } from "~/state/environments";
import { useEnvironmentQuery, type EnvironmentQueryView } from "~/state/query";
import { sandboxEnvironment } from "~/state/sandbox";

export interface SandboxDetailView extends EnvironmentQueryView<SandboxDetailResult> {
  /** False on a server without `capabilities.sandboxDetail`, where nothing was
      asked for and the panel offers no controls. */
  readonly supported: boolean;
}

export function useSandboxDetail(threadRef: ScopedThreadRef | null): SandboxDetailView {
  const environment = useEnvironment(threadRef?.environmentId ?? null);
  const capabilities = environment?.serverConfig?.environment.capabilities;
  const supported = capabilities?.sandboxDetail === true;
  // The detail push rides the same server-side loop as the status push, so a
  // server that serves detail at all serves it pushed unless it predates the
  // status push entirely.
  const pushed = supported && capabilities?.sandboxStatusPush === true;

  const live = useEnvironmentQuery(
    threadRef === null || !pushed
      ? null
      : sandboxEnvironment.detailStream({
          environmentId: threadRef.environmentId,
          input: { threadId: threadRef.threadId },
        }),
  );
  const polled = useEnvironmentQuery(
    threadRef === null || !supported || pushed
      ? null
      : sandboxEnvironment.detail({
          environmentId: threadRef.environmentId,
          input: { threadId: threadRef.threadId },
        }),
  );
  const { data, error, isPending: queryIsPending, isSuccess, refresh } = pushed ? live : polled;
  const isPending = supported && queryIsPending && data === null;

  useEffect(() => {
    if (threadRef === null || !supported || pushed) return;
    refresh();
  }, [pushed, refresh, supported, threadRef?.environmentId, threadRef?.threadId]);

  return useMemo(
    () => ({ data, error, isPending, isSuccess, refresh, supported }),
    [data, error, isPending, isSuccess, refresh, supported],
  );
}
