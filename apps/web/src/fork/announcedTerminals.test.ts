import type { TerminalMetadataState } from "@t3tools/client-runtime/state/terminal";
import { ThreadId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { announcedTerminalFor } from "./announcedTerminals";

const MINE = ThreadId.make("thread-mine");
const THEIRS = ThreadId.make("thread-theirs");

const state = (
  announced: TerminalMetadataState["announced"],
  announcedOpens: number,
): TerminalMetadataState => ({ terminals: [], announced, announcedOpens });

describe("announcedTerminalFor", () => {
  it("names the terminal the environment raised on this thread", () => {
    const view = announcedTerminalFor(state({ threadId: MINE, terminalId: "term-1" }, 1), MINE);

    expect(view).toEqual({ terminalId: "term-1", opens: 1 });
  });

  it("raises nothing before the environment has announced anything", () => {
    expect(announcedTerminalFor(state(null, 0), MINE)).toEqual({ terminalId: null, opens: 0 });
    expect(announcedTerminalFor(null, MINE)).toEqual({ terminalId: null, opens: 0 });
  });

  // The count is stream-wide, so another thread's announcement still moves it.
  // Reporting that move with no terminal id is what stops a viewer of this
  // thread from opening a drawer for a session on someone else's, while still
  // letting it fire on the next one that is its own.
  it("carries another thread's announcement as a move with nothing to raise", () => {
    const theirs = announcedTerminalFor(state({ threadId: THEIRS, terminalId: "term-2" }, 2), MINE);
    expect(theirs).toEqual({ terminalId: null, opens: 2 });

    const mineNext = announcedTerminalFor(state({ threadId: MINE, terminalId: "term-3" }, 3), MINE);
    expect(mineNext).toEqual({ terminalId: "term-3", opens: 3 });
  });

  it("raises nothing while no thread is in view", () => {
    expect(announcedTerminalFor(state({ threadId: MINE, terminalId: "term-1" }, 1), null)).toEqual({
      terminalId: null,
      opens: 0,
    });
  });
});
