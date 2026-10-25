/**
 * Fork-only. Which terminal the environment raised for a thread, if any.
 * `scripts.run` opens sessions nobody here asked for and upstream's drawer only opens on click,
 * so the session would run behind a closed drawer. The backend marks them with `announced`.
 * Watch `announcedOpens`, not the id: two starts of one terminal must read as two events.
 */
import type { TerminalMetadataState } from "@t3tools/client-runtime/state/terminal";
import type { EnvironmentId, ThreadId } from "@t3tools/contracts";

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
  return announcedTerminalFor(state, input.threadId);
}
