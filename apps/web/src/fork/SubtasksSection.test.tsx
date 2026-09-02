import { UnsupportedMethodError } from "@t3tools/contracts";
import * as Cause from "effect/Cause";
import { describe, expect, it } from "vite-plus/test";

import { subtaskLoadError } from "./SubtasksSection";

describe("subtaskLoadError", () => {
  it("says nothing when the environment does not serve the method", () => {
    const refusal = new UnsupportedMethodError({
      method: "subtasks.list",
      message: "This environment does not have subtasks.",
    });

    expect(subtaskLoadError(Cause.fail(refusal))).toBeNull();
  });

  /**
   * The refusal crossed a socket and was rebuilt by the schema decoder, so the
   * classification has to hold for the decoded shape and not only for an
   * instance of the class this bundle holds.
   */
  it("recognises a refusal rebuilt from the wire", () => {
    expect(
      subtaskLoadError(
        Cause.fail({
          _tag: "UnsupportedMethodError",
          method: "subtasks.list",
          message: "This environment does not have subtasks.",
        }),
      ),
    ).toBeNull();
  });

  it("surfaces every other failure, so a section that empties itself is not silent", () => {
    expect(subtaskLoadError(Cause.fail(new Error("socket closed")))).toBe(
      "Could not load this thread's subtasks.",
    );
    expect(subtaskLoadError(Cause.fail({ _tag: "EnvironmentAuthorizationError" }))).toBe(
      "Could not load this thread's subtasks.",
    );
    expect(subtaskLoadError(Cause.die("boom"))).toBe("Could not load this thread's subtasks.");
  });
});
