/**
 * Fork-only: the sandbox panel's presentation rules.
 *
 * These pin the three decisions a render test would not reach: which control a
 * lifecycle state may offer, which of a container's four reason fields explains
 * it, and that a missing metric never reads as a zero.
 */
import type { SandboxContainerInfo } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import {
  containerReason,
  eventIsWarning,
  formatCpu,
  formatIdleTimeout,
  formatMemory,
  imageUpdateAvailable,
  sandboxActionsFor,
  shortImageRef,
  totalContainerResources,
} from "./sandboxPanelFormat";

function container(overrides: Partial<SandboxContainerInfo> = {}): SandboxContainerInfo {
  return {
    name: "agent",
    state: "running",
    restartCount: 0,
    exitCode: null,
    terminatedReason: null,
    lastExitCode: null,
    lastTerminatedReason: null,
    waitingReason: null,
    cpuMillicores: null,
    memoryMb: null,
    ...overrides,
  };
}

describe("sandboxActionsFor", () => {
  it("offers nothing while a transition is already under way", () => {
    expect([...sandboxActionsFor("initializing")]).toEqual([]);
    expect([...sandboxActionsFor("removing")]).toEqual([]);
    expect([...sandboxActionsFor(null)]).toEqual([]);
  });

  it("offers restart only where a pod exists to replace", () => {
    expect(sandboxActionsFor("ready").has("restart")).toBe(true);
    expect(sandboxActionsFor("error").has("restart")).toBe(true);
    expect(sandboxActionsFor("stopped").has("restart")).toBe(false);
    expect(sandboxActionsFor("not_created").has("restart")).toBe(false);
  });

  it("keeps cleanup reachable from stopped, which is where someone finishes", () => {
    expect(sandboxActionsFor("stopped").has("cleanup")).toBe(true);
  });

  it("offers a never-created sandbox nothing but start", () => {
    expect([...sandboxActionsFor("not_created")]).toEqual(["start"]);
    expect([...sandboxActionsFor("removed")]).toEqual(["start"]);
  });

  it("never offers start and stop together", () => {
    for (const status of ["ready", "stopped", "error", "not_created", "removed"] as const) {
      const actions = sandboxActionsFor(status);
      expect(actions.has("start") && actions.has("stop")).toBe(false);
    }
  });
});

describe("containerReason", () => {
  it("says nothing about a running container", () => {
    expect(containerReason(container({ waitingReason: "CrashLoopBackOff" }))).toBeNull();
  });

  it("explains a crash loop with the previous run's reason", () => {
    expect(
      containerReason(
        container({
          state: "waiting",
          waitingReason: "CrashLoopBackOff",
          lastTerminatedReason: "Error",
          lastExitCode: 1,
        }),
      ),
    ).toBe("CrashLoopBackOff after Error (exit 1)");
  });

  it("uses the waiting reason alone when there is no previous run", () => {
    expect(
      containerReason(container({ state: "waiting", waitingReason: "ImagePullBackOff" })),
    ).toBe("ImagePullBackOff");
  });

  it("falls back to the terminated reason, then to the previous one", () => {
    expect(
      containerReason(
        container({ state: "terminated", terminatedReason: "OOMKilled", exitCode: 137 }),
      ),
    ).toBe("OOMKilled (exit 137)");
    expect(
      containerReason(container({ state: "unknown", lastTerminatedReason: "Completed" })),
    ).toBe("Completed");
  });

  it("says nothing when the runtime published no reason at all", () => {
    expect(containerReason(container({ state: "unknown" }))).toBeNull();
  });
});

describe("totalContainerResources", () => {
  it("refuses a partial sum, which would understate the pod", () => {
    expect(
      totalContainerResources([
        container({ cpuMillicores: 100, memoryMb: 200 }),
        container({ cpuMillicores: null, memoryMb: 300 }),
      ]),
    ).toEqual({ cpuMillicores: null, memoryMb: 500 });
  });

  it("sums once every container has reported", () => {
    expect(
      totalContainerResources([
        container({ cpuMillicores: 100, memoryMb: 200 }),
        container({ cpuMillicores: 50, memoryMb: 300 }),
      ]),
    ).toEqual({ cpuMillicores: 150, memoryMb: 500 });
  });

  it("answers null for an empty pod rather than zero", () => {
    expect(totalContainerResources([])).toEqual({ cpuMillicores: null, memoryMb: null });
  });
});

describe("metric formatting", () => {
  it("renders a missing metric as a dash, never as a zero", () => {
    expect(formatCpu(null)).toBe("—");
    expect(formatMemory(null)).toBe("—");
  });

  it("keeps a real zero distinct from a missing one", () => {
    expect(formatCpu(0)).toBe("0m");
    expect(formatMemory(0)).toBe("0 MiB");
  });

  it("switches memory to GiB once it passes a gibibyte", () => {
    expect(formatMemory(812)).toBe("812 MiB");
    expect(formatMemory(1229)).toBe("1.2 GiB");
  });
});

describe("formatIdleTimeout", () => {
  it("uses the setter's own words for a value the setter offers", () => {
    expect(formatIdleTimeout(0)).toBe("Never");
    expect(formatIdleTimeout(60)).toBe("1 hour");
    expect(formatIdleTimeout(1440)).toBe("24 hours");
  });

  it("renders a value set elsewhere", () => {
    expect(formatIdleTimeout(45)).toBe("45 minutes");
    expect(formatIdleTimeout(180)).toBe("3 hours");
    expect(formatIdleTimeout(90)).toBe("90 minutes");
  });
});

describe("shortImageRef", () => {
  it("keeps the part a redeploy changes", () => {
    expect(shortImageRef("ghcr.io/soaplabs/moatless-sandbox:v2.1.0")).toBe(
      "moatless-sandbox:v2.1.0",
    );
    expect(shortImageRef("moatless-sandbox:latest")).toBe("moatless-sandbox:latest");
  });
});

describe("eventIsWarning", () => {
  it("reads an unrecognized severity as ordinary rather than as an alarm", () => {
    const event = { reason: "Pulled", message: "", count: null, lastTimestamp: null };
    expect(eventIsWarning({ ...event, severity: "Warning" })).toBe(true);
    expect(eventIsWarning({ ...event, severity: "Normal" })).toBe(false);
    expect(eventIsWarning({ ...event, severity: "Emergency" })).toBe(false);
    expect(eventIsWarning({ ...event, severity: null })).toBe(false);
  });
});

describe("imageUpdateAvailable", () => {
  it("treats an unknown latest tag as no update, not as being behind one", () => {
    expect(imageUpdateAvailable({ current: "a", latest: null, upToDate: null })).toBe(false);
    expect(imageUpdateAvailable({ current: "a", latest: "b", upToDate: false })).toBe(true);
    expect(imageUpdateAvailable({ current: "a", latest: "a", upToDate: true })).toBe(false);
  });
});
