import * as Schema from "effect/Schema";
import { describe, expect, it } from "vite-plus/test";

import { ScriptsRunInput, ScriptsRunResult } from "./scripts.ts";

const decodeInput = Schema.decodeUnknownSync(ScriptsRunInput);
const decodeResult = Schema.decodeUnknownSync(ScriptsRunResult);

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
