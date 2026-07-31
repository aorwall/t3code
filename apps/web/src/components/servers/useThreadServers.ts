"use client";

import type { ScopedThreadRef, ServersListResult, ThreadServer } from "@t3tools/contracts";

import { useEnvironmentQuery } from "~/state/query";
import { serversEnvironment } from "~/state/servers";

export interface ThreadServersView {
  readonly servers: ReadonlyArray<ThreadServer>;
  readonly sandboxStatus: ServersListResult["sandboxStatus"] | null;
  readonly isPending: boolean;
  /** Set once the list was read and has since failed to refresh. */
  readonly error: string | null;
  readonly refresh: () => void;
}

/**
 * Whether this thread has any servers to show.
 *
 * Reads the seed only. The status subscription costs a poll per subscribed
 * client, and deciding whether to offer a menu entry does not need one.
 */
export function useThreadDeclaresServers(threadRef: ScopedThreadRef | null): boolean {
  const seed = useEnvironmentQuery(
    threadRef === null
      ? null
      : serversEnvironment.list({
          environmentId: threadRef.environmentId,
          input: { threadId: threadRef.threadId },
        }),
  );
  return (seed.data?.servers.length ?? 0) > 0;
}

/**
 * A thread's servers, seeded from a read and kept current by a subscription.
 *
 * The subscription carries the list and nothing else, so the environment's own
 * state stays with the seed. It is the newer of the two whenever it has spoken:
 * an idle subscription is silent, so the absence of a snapshot means the list
 * has not moved since the seed, not that it is unknown.
 */
export function useThreadServers(threadRef: ScopedThreadRef | null): ThreadServersView {
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
    sandboxStatus: seed.data?.sandboxStatus ?? null,
    isPending: seed.isPending && seed.data === null,
    error: seed.error ?? live.error,
    refresh: seed.refresh,
  };
}
