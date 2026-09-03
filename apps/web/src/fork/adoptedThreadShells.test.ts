import type {
  EnvironmentId,
  OrchestrationShellSnapshot,
  OrchestrationThreadShell,
  ScopedThreadRef,
  ThreadId,
} from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { graftThreadShells, missingThreadIds } from "./adoptedThreadShells";

const ENVIRONMENT = "env-1" as EnvironmentId;
const OTHER_ENVIRONMENT = "env-2" as EnvironmentId;

/** Only the id is read by anything under test; the rest is shape. */
function row(id: string): OrchestrationThreadShell {
  return { id: id as ThreadId } as unknown as OrchestrationThreadShell;
}

function snapshot(...ids: ReadonlyArray<string>): OrchestrationShellSnapshot {
  return {
    snapshotSequence: 0,
    projects: [],
    threads: ids.map(row),
    updatedAt: "2026-09-01T00:00:00.000Z",
  } as unknown as OrchestrationShellSnapshot;
}

function ref(environmentId: EnvironmentId, threadId: string): ScopedThreadRef {
  return { environmentId, threadId: threadId as ThreadId };
}

describe("missingThreadIds", () => {
  /**
   * The load-bearing property: a thread the listing already carries must never
   * reach the network. Held threads are the ones a route is showing, and most
   * of them are listed.
   */
  it("asks for nothing when the listing already carries the held threads", () => {
    expect(
      missingThreadIds(snapshot("t-1", "t-2"), ENVIRONMENT, [
        ref(ENVIRONMENT, "t-1"),
        ref(ENVIRONMENT, "t-2"),
      ]),
    ).toEqual([]);
  });

  it("asks only for the threads the listing left out", () => {
    expect(
      missingThreadIds(snapshot("t-1"), ENVIRONMENT, [
        ref(ENVIRONMENT, "t-1"),
        ref(ENVIRONMENT, "t-archived"),
      ]),
    ).toEqual(["t-archived"]);
  });

  /** A thread id means nothing outside the environment that issued it. */
  it("ignores threads held against another environment", () => {
    expect(
      missingThreadIds(snapshot(), ENVIRONMENT, [ref(OTHER_ENVIRONMENT, "t-elsewhere")]),
    ).toEqual([]);
  });
});

describe("graftThreadShells", () => {
  /**
   * Identity, not equality: every thread-shell atom derives from this snapshot,
   * so a fresh object on every read would re-render the sidebar on every tick
   * for the overwhelmingly common case of nothing being adopted at all.
   */
  it("hands back the same snapshot when nothing was adopted", () => {
    const listing = snapshot("t-1");

    expect(graftThreadShells(listing, [])).toBe(listing);
  });

  it("appends adopted rows without disturbing the listing's own", () => {
    const grafted = graftThreadShells(snapshot("t-1"), [row("t-archived")]);

    expect(grafted.threads.map((thread) => thread.id)).toEqual(["t-1", "t-archived"]);
  });
});
