import { describe, expect, it } from "vite-plus/test";

import { resolveThreadForkSubmission } from "./threadForkDialog";

describe("resolveThreadForkSubmission", () => {
  it("sends only sameSandbox when the message and branch are blank", () => {
    expect(resolveThreadForkSubmission({ sameSandbox: true, message: "  ", branch: "" })).toEqual({
      sameSandbox: true,
    });
  });

  it("trims and carries a non-blank message", () => {
    expect(
      resolveThreadForkSubmission({ sameSandbox: true, message: "  finish the fix  ", branch: "" }),
    ).toEqual({ sameSandbox: true, message: "finish the fix" });
  });

  it("carries a trimmed branch for an isolated fork", () => {
    expect(
      resolveThreadForkSubmission({ sameSandbox: false, message: "", branch: "  feat/checkout  " }),
    ).toEqual({ sameSandbox: false, branch: "feat/checkout" });
  });

  it("drops the branch when sameSandbox is on, even if the draft still carries one", () => {
    expect(
      resolveThreadForkSubmission({ sameSandbox: true, message: "", branch: "feat/checkout" }),
    ).toEqual({ sameSandbox: true });
  });
});
