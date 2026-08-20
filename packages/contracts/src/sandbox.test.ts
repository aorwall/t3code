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
});
