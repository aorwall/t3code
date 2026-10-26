import { describe, expect, it } from "vite-plus/test";

import { autoFollowDecision, threadAwaitsFirstAnswer } from "./unlistedThread";

describe("threadAwaitsFirstAnswer", () => {
  it("waits while the subscription has neither data nor an answer", () => {
    expect(threadAwaitsFirstAnswer("empty", null)).toBe(true);
    // `markSynchronizing` runs before the subscription sends anything, so this
    // is the state a cold deep link spends its whole first round trip in.
    expect(threadAwaitsFirstAnswer("synchronizing", null)).toBe(true);
  });

  it("stops waiting once the environment has answered", () => {
    expect(threadAwaitsFirstAnswer("empty", "Could not synchronize the thread.")).toBe(false);
    expect(threadAwaitsFirstAnswer("synchronizing", "Thread not found.")).toBe(false);
    expect(threadAwaitsFirstAnswer("deleted", null)).toBe(false);
    expect(threadAwaitsFirstAnswer("cached", null)).toBe(false);
    expect(threadAwaitsFirstAnswer("live", null)).toBe(false);
  });
});

describe("autoFollowDecision", () => {
  // regression: unfollowing the open thread dropped it from the listing, and
  // the route took that for an unlisted thread and followed it straight back.
  it("settles a thread that was already listed without following it", () => {
    expect(autoFollowDecision({ listed: true, archived: false })).toBe("decided");
  });

  it("follows an open thread the listing does not carry", () => {
    expect(autoFollowDecision({ listed: false, archived: false })).toBe("follow");
  });

  it("leaves an archived unlisted thread undecided", () => {
    expect(autoFollowDecision({ listed: false, archived: true })).toBe("undecided");
  });
});
