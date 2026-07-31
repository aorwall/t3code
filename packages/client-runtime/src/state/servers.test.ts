import { describe, expect, it } from "vite-plus/test";

import { appendServerLogLine, SERVER_LOG_LINE_LIMIT, type ServerLogBuffer } from "./servers.ts";

const EMPTY: ServerLogBuffer = { name: "", lines: [], dropped: 0 };

function fold(lines: readonly string[]): ServerLogBuffer {
  return lines.reduce<ServerLogBuffer>(
    (buffer, line) => appendServerLogLine(buffer, { threadId: "t", name: "web", line })[0],
    EMPTY,
  );
}

describe("appendServerLogLine", () => {
  it("accumulates, so a remounted panel keeps what the subscription already sent", () => {
    const [next, emitted] = appendServerLogLine(fold(["one", "two"]), {
      threadId: "t",
      name: "web",
      line: "three",
    });

    expect(next.lines).toEqual(["one", "two", "three"]);
    expect(emitted).toEqual([next]);
  });

  it("drops from the front past the limit and counts what it dropped", () => {
    const overflowing = Array.from({ length: SERVER_LOG_LINE_LIMIT + 3 }, (_, index) => `${index}`);

    const buffer = fold(overflowing);

    expect(buffer.lines).toHaveLength(SERVER_LOG_LINE_LIMIT);
    expect(buffer.dropped).toBe(3);
    expect(buffer.lines[0]).toBe("3");
    expect(buffer.lines.at(-1)).toBe(`${SERVER_LOG_LINE_LIMIT + 2}`);
  });

  it("keeps an empty line, because a blank line is output too", () => {
    expect(fold(["", "after"]).lines).toEqual(["", "after"]);
  });
});
