/**
 * Fork-only: the rule for which right-panel surfaces survive a stopped sandbox.
 *
 * The load-bearing claim is that the surfaces the environment serves — Agents,
 * and Files now that the backend reads them from the S3 snapshot — are not
 * gated on the workspace, while the ones that read the live machine are. Get
 * the split wrong and either a working surface hides behind a machine it never
 * needed, or a dead one offers to open.
 */
import { describe, expect, it } from "vite-plus/test";

import { resolveSurfaceGate, surfaceNeedsSandbox } from "./sandboxSurfaces";

describe("surfaceNeedsSandbox", () => {
  it("frees the surfaces the environment serves and gates the rest", () => {
    for (const kind of ["agents", "files", "file"] as const) {
      expect(surfaceNeedsSandbox(kind)).toBe(false);
    }
    for (const kind of ["diff", "preview", "terminal", "pull-request"] as const) {
      expect(surfaceNeedsSandbox(kind)).toBe(true);
    }
  });
});

describe("resolveSurfaceGate", () => {
  const SANDBOX_REASON = "Start the sandbox to use right-panel surfaces.";

  it("closes a workspace surface when the sandbox is down, with the sandbox's reason", () => {
    const gate = resolveSurfaceGate({
      available: true,
      reason: "own reason",
      needsSandbox: true,
      sandboxDisabled: true,
      sandboxReason: SANDBOX_REASON,
    });
    expect(gate.available).toBe(false);
    expect(gate.disabledReason).toBe(SANDBOX_REASON);
  });

  it("leaves an environment surface open while the sandbox is down", () => {
    const gate = resolveSurfaceGate({
      available: true,
      reason: "own reason",
      needsSandbox: false,
      sandboxDisabled: true,
      sandboxReason: SANDBOX_REASON,
    });
    expect(gate.available).toBe(true);
  });

  it("keeps a surface's own reason when it is unavailable on its own terms", () => {
    // The sandbox does not get to claim a surface it is not the only thing
    // standing in the way of: "Start the sandbox" must not promise a browser
    // to a web build that never had one.
    const gate = resolveSurfaceGate({
      available: false,
      reason: "Browser previews are not available in this runtime.",
      needsSandbox: true,
      sandboxDisabled: true,
      sandboxReason: SANDBOX_REASON,
    });
    expect(gate.available).toBe(false);
    expect(gate.disabledReason).toBe("Browser previews are not available in this runtime.");
  });

  it("is a no-op passthrough when the sandbox is up", () => {
    const gate = resolveSurfaceGate({
      available: true,
      reason: "own reason",
      needsSandbox: true,
      sandboxDisabled: false,
      sandboxReason: SANDBOX_REASON,
    });
    expect(gate.available).toBe(true);
    expect(gate.disabledReason).toBe("own reason");
  });
});
