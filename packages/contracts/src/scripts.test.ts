import * as Schema from "effect/Schema";
import { describe, expect, it } from "vite-plus/test";

import { SandboxNotRunningError } from "./sandbox.ts";
import { ScriptsRunInput, ScriptsRunResult } from "./scripts.ts";

const decodeInput = Schema.decodeUnknownSync(ScriptsRunInput);
const decodeResult = Schema.decodeUnknownSync(ScriptsRunResult);
const decodeNotRunning = Schema.decodeUnknownSync(SandboxNotRunningError);

describe("ScriptsRunInput", () => {
  it("decodes a thread-scoped run request", () => {
    expect(decodeInput({ threadId: "thread-1", scriptId: "dev" })).toStrictEqual({
      threadId: "thread-1",
      scriptId: "dev",
    });
  });

  it("rejects a blank script id", () => {
    expect(() => decodeInput({ threadId: "thread-1", scriptId: "" })).toThrow();
  });
});

describe("ScriptsRunResult", () => {
  it("carries the hosting terminal and a served-port url", () => {
    expect(
      decodeResult({ terminalId: "script-dev", url: "https://task--3000.example.dev" }),
    ).toStrictEqual({ terminalId: "script-dev", url: "https://task--3000.example.dev" });
  });

  it("allows a null url when the script serves no port", () => {
    expect(decodeResult({ terminalId: "script-dev", url: null })).toStrictEqual({
      terminalId: "script-dev",
      url: null,
    });
  });
});

describe("a stopped sandbox refusing scripts.run", () => {
  /**
   * The wire shape Moatless emits for this refusal
   * (`scripts_failure_exit`'s `SandboxError::NotReady` arm). The client starts
   * the sandbox and re-runs on the strength of this tag, so a drift between the
   * two sides silently turns auto-start back into an error message.
   */
  it("decodes the tagged refusal the environment sends", () => {
    const error = decodeNotRunning({
      _tag: "SandboxNotRunningError",
      threadId: "thread-1",
    });

    expect(error).toBeInstanceOf(SandboxNotRunningError);
    expect(error.threadId).toBe("thread-1");
  });

  it("says which thread has no sandbox", () => {
    expect(new SandboxNotRunningError({ threadId: "thread-1" }).message).toContain("thread-1");
  });
});
