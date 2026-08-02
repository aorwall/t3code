"use client";

import type { ScopedThreadRef, ThreadServer } from "@t3tools/contracts";

import { useEnvironmentQuery } from "~/state/query";
import { serversEnvironment } from "~/state/servers";

export interface ThreadPreviewServersView {
  readonly servers: ReadonlyArray<ThreadServer>;
  readonly isPending: boolean;
  readonly error: string | null;
  readonly refresh: () => void;
}

export function useThreadPreviewServers(
  threadRef: ScopedThreadRef | null,
): ThreadPreviewServersView {
  const seed = useEnvironmentQuery(
    threadRef === null
      ? null
      : serversEnvironment.list({
          environmentId: threadRef.environmentId,
          input: { threadId: threadRef.threadId },
        }),
  );
  const live = useEnvironmentQuery(
    threadRef === null
      ? null
      : serversEnvironment.status({
          environmentId: threadRef.environmentId,
          input: { threadId: threadRef.threadId },
        }),
  );

  return {
    servers: live.data?.servers ?? seed.data?.servers ?? [],
    isPending: seed.isPending && seed.data === null,
    error: seed.error ?? live.error,
    refresh: seed.refresh,
  };
}
