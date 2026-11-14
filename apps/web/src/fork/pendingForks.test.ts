import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import { EnvironmentId, ThreadId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { beginPendingFork, readPendingForks } from "./pendingForks";

const source = scopeThreadRef(EnvironmentId.make("env-1"), ThreadId.make("source"));
const other = scopeThreadRef(EnvironmentId.make("env-1"), ThreadId.make("other"));

describe("pending forks", () => {
  it("lists each fork under its own source until that fork settles", () => {
    const settleFirst = beginPendingFork(source, "Source fork");
    const settleSecond = beginPendingFork(source, "Source fork");

    expect(readPendingForks(source).map((fork) => fork.title)).toEqual([
      "Source fork",
      "Source fork",
    ]);
    expect(readPendingForks(other)).toEqual([]);

    settleFirst();
    expect(readPendingForks(source)).toHaveLength(1);
    settleSecond();
    expect(readPendingForks(source)).toEqual([]);
  });
});
