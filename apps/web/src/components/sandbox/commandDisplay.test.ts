import type { CommandSummary } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { formatElapsed, runningCommands } from "./commandDisplay";

function command(overrides: Partial<CommandSummary>): CommandSummary {
  return {
    id: "cmd-1",
    label: "mvn verify",
    state: "running",
    startedAtUnixMs: 0,
    deadlineUnixMs: 0,
    exitCode: null,
    ...overrides,
  };
}

describe("runningCommands", () => {
  it("keeps only the running ones, dropping every terminal state", () => {
    const commands: CommandSummary[] = [
      command({ id: "a", state: "running" }),
      command({ id: "b", state: "exited", exitCode: 0 }),
      command({ id: "c", state: "timedOut", exitCode: 124 }),
      command({ id: "d", state: "killed" }),
      command({ id: "e", state: "running" }),
    ];
    expect(runningCommands(commands).map((c) => c.id)).toStrictEqual(["a", "e"]);
  });

  it("treats an absent list as none", () => {
    expect(runningCommands(undefined)).toStrictEqual([]);
  });
});

describe("formatElapsed", () => {
  it("reads seconds under a minute", () => {
    expect(formatElapsed(0, 42_000)).toBe("42s");
  });

  it("rounds to whole minutes once past one", () => {
    expect(formatElapsed(0, 12 * 60_000 + 20_000)).toBe("12m");
  });

  it("carries minutes into an hour, dropping a zero minute remainder", () => {
    expect(formatElapsed(0, 60 * 60_000)).toBe("1h");
    expect(formatElapsed(0, (2 * 60 + 5) * 60_000)).toBe("2h 5m");
  });

  it("floors a clock that runs behind the start at zero rather than negative", () => {
    expect(formatElapsed(10_000, 0)).toBe("0s");
  });
});
