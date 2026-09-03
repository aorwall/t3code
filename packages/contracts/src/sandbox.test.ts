import * as Schema from "effect/Schema";
import { describe, expect, it } from "vite-plus/test";

import { SandboxStatusResult, SandboxStatusSubscribeInput } from "./sandbox.ts";

const decodeSubscribeInput = Schema.decodeUnknownSync(SandboxStatusSubscribeInput);
const decodeStatus = Schema.decodeUnknownSync(SandboxStatusResult);

describe("sandbox.subscribeStatus", () => {
  it("subscribes per thread", () => {
    expect(decodeSubscribeInput({ threadId: "thread-1" })).toStrictEqual({ threadId: "thread-1" });
  });

  it("rejects a subscription with no thread", () => {
    expect(() => decodeSubscribeInput({})).toThrow();
  });

  /**
   * The pushed value is the same shape `sandbox.status` answers with, which is
   * what lets the indicator read either source without caring which one it got.
   * Moatless emits this from one `sandbox::status` call shared by the seed and
   * the poller, so a divergence here would be a divergence there.
   */
  it("pushes the same shape the read answers with", () => {
    expect(decodeStatus({ sandboxStatus: "ready" })).toStrictEqual({ sandboxStatus: "ready" });
  });

  it("rejects a status outside the lifecycle vocabulary", () => {
    expect(() => decodeStatus({ sandboxStatus: "starting" })).toThrow();
  });

  /**
   * A `moat cmd` command carried beside an idle agent — the state the key
   * exists for. `commands` is `optionalKey`, so a payload without it decodes
   * to a value without the key, not to one with `[]`.
   */
  it("carries the registered commands when the server reports them", () => {
    expect(
      decodeStatus({
        sandboxStatus: "ready",
        agentStatus: "idle",
        commands: [
          {
            id: "cmd-1",
            label: "mvn verify",
            state: "running",
            startedAtUnixMs: 1_754_000_000_000,
            deadlineUnixMs: 1_754_003_600_000,
            exitCode: null,
          },
        ],
      }),
    ).toStrictEqual({
      sandboxStatus: "ready",
      agentStatus: "idle",
      commands: [
        {
          id: "cmd-1",
          label: "mvn verify",
          state: "running",
          startedAtUnixMs: 1_754_000_000_000,
          deadlineUnixMs: 1_754_003_600_000,
          exitCode: null,
        },
      ],
    });
  });

  it("omits the commands key rather than defaulting it to empty", () => {
    expect(decodeStatus({ sandboxStatus: "ready" })).toStrictEqual({ sandboxStatus: "ready" });
  });

  it("rejects a command state outside the vocabulary", () => {
    expect(() =>
      decodeStatus({
        sandboxStatus: "ready",
        commands: [
          {
            id: "cmd-1",
            label: "mvn verify",
            state: "sleeping",
            startedAtUnixMs: 1,
            deadlineUnixMs: 2,
            exitCode: null,
          },
        ],
      }),
    ).toThrow();
  });
});
