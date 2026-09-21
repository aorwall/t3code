/**
 * Fork-only. Which terminal the environment raised for a thread, if any.
 *
 * Moatless starts terminal sessions nobody on this side asked for: `scripts.run`
 * and `moat tasks scripts run` open one on the Task's sandbox, and the whole
 * point of that session is to be watched. Upstream's drawer only ever opens
 * because someone clicked, so without this the session runs to completion
 * behind a closed drawer and the person waiting on it sees nothing.
 *
 * The backend marks exactly those starts with `announced` on the metadata
 * stream and marks nothing else, so this reads as an event rather than as a
 * rule about which terminals deserve a drawer. `announcedOpens` counts them
 * stream-wide: the count is what a caller watches, because two starts of one
 * terminal have to read as two events, and a caller that watched the id alone
 * would miss the second.
 */
import type { TerminalMetadataState } from "@t3tools/client-runtime/state/terminal";
import type { EnvironmentId, ThreadId } from "@t3tools/contracts";
import { useMemo } from "react";

import { useEnvironmentQuery } from "~/state/query";
import { terminalEnvironment } from "~/state/terminal";

export interface AnnouncedTerminal {
  /** The terminal to raise, or null when the last announcement was another
      thread's — or when there has not been one. */
  readonly terminalId: string | null;
  /** Announcements seen on this stream, across every thread. A caller fires
      when this moves and `terminalId` is set; an announcement for a thread it
      is not watching moves the count alone, which is what keeps that caller
      from firing late on an id it skipped. */
  readonly opens: number;
}

const NO_ANNOUNCEMENT: AnnouncedTerminal = { terminalId: null, opens: 0 };

/** What a viewer of `threadId` should raise, given the stream's current state. */
export function announcedTerminalFor(
  metadata: TerminalMetadataState | null | undefined,
  threadId: ThreadId | null,
): AnnouncedTerminal {
  if (metadata == null || threadId === null || metadata.announcedOpens === 0) {
    return NO_ANNOUNCEMENT;
  }
  const announced = metadata.announced;
  return {
    terminalId: announced !== null && announced.threadId === threadId ? announced.terminalId : null,
    opens: metadata.announcedOpens,
  };
}

/** Read the environment's terminal announcements for one thread. */
export function useAnnouncedTerminal(input: {
  readonly environmentId: EnvironmentId | null;
  readonly threadId: ThreadId | null;
}): AnnouncedTerminal {
  const metadata = useEnvironmentQuery(
    input.environmentId === null
      ? null
      : terminalEnvironment.metadata({ environmentId: input.environmentId, input: null }),
  );
  const state = metadata.data;
  return useMemo(() => announcedTerminalFor(state, input.threadId), [state, input.threadId]);
}
