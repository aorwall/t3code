import { ThreadId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { makeThreadFixture } from "../test-fixtures";
import { resolveThreadParent, threadParentLabel } from "./ThreadParentLine";

const parentId = ThreadId.make("thread-parent");

const subagentOf = (creationSource: "mcp" | "provider") => {
  const lineage = {
    rootThreadId: parentId,
    parentThreadId: parentId,
    relationshipToParent: "subagent" as const,
  };
  const thread = makeThreadFixture({ lineage });
  return { ...thread, source: { ...thread.source, lineage, creationSource } };
};

describe("thread parent line", () => {
  it("names a fork's source thread", () => {
    const fork = makeThreadFixture({
      forkedFrom: { type: "run", threadId: parentId, runId: "run-1" as never },
      lineage: { rootThreadId: parentId, parentThreadId: parentId, relationshipToParent: "fork" },
    });

    expect(resolveThreadParent(fork)).toEqual({ kind: "fork", threadId: parentId });
  });

  it("names the thread that delegated a subtask, not a provider-native subagent's", () => {
    expect(resolveThreadParent(subagentOf("mcp"))).toEqual({ kind: "subtask", threadId: parentId });
    expect(resolveThreadParent(subagentOf("provider"))).toBeNull();
  });

  it("shows nothing for a root thread", () => {
    expect(resolveThreadParent(makeThreadFixture())).toBeNull();
  });

  it("falls back to the bare noun while the parent's title is unknown", () => {
    expect(threadParentLabel("fork", "Fix checkout")).toBe("Fork of Fix checkout");
    expect(threadParentLabel("subtask", "Fix checkout")).toBe("Subtask of Fix checkout");
    expect(threadParentLabel("fork", null)).toBe("Fork");
    expect(threadParentLabel("subtask", "  ")).toBe("Subtask");
  });
});
