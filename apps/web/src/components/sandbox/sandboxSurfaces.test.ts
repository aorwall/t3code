/**
 * Fork-only: the rule for which right-panel surfaces survive a stopped sandbox.
 *
 * The split frees the surfaces the environment serves, and gates the ones that
 * read the live machine. Agents and Files are served, now that the backend
 * reads a file from the S3 snapshot. A browser tab splits on the page it holds
 * instead of on its kind. Get either wrong and a working surface hides behind a
 * machine it never needed, or a dead one offers to open.
 */
import type { PreviewSessionSnapshot } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import type { RightPanelSurface } from "~/rightPanelStore";

import {
  previewTabNeedsSandbox,
  resolveActiveSurfaceNeedsSandbox,
  resolveSurfaceGate,
  surfaceNeedsSandbox,
} from "./sandboxSurfaces";

describe("surfaceNeedsSandbox", () => {
  it("frees the surfaces the environment serves and gates the rest", () => {
    // `sandbox` is here for the opposite reason to the others: it reads the
    // live machine, but it is also the only way to start one.
    for (const kind of ["agents", "files", "file", "sandbox"] as const) {
      expect(surfaceNeedsSandbox(kind)).toBe(false);
    }
    for (const kind of ["diff", "preview", "terminal", "pull-request"] as const) {
      expect(surfaceNeedsSandbox(kind)).toBe(true);
    }
  });
});

describe("previewTabNeedsSandbox", () => {
  const ENVIRONMENT = "https://moatless.example.com";

  it("frees a tab on the environment's asset route", () => {
    expect(
      previewTabNeedsSandbox(`${ENVIRONMENT}/api/assets/task-1/docs/report.html`, ENVIRONMENT),
    ).toBe(false);
  });

  it("gates a server running inside the sandbox", () => {
    expect(previewTabNeedsSandbox("https://3000-task-1.preview.example.com/", ENVIRONMENT)).toBe(
      true,
    );
  });

  it("gates the asset route on another origin", () => {
    // The path alone says nothing: only this environment reads the snapshot.
    expect(
      previewTabNeedsSandbox("https://elsewhere.example.com/api/assets/task-1/a.html", ENVIRONMENT),
    ).toBe(true);
  });

  it("gates an empty tab, and one with no environment to compare against", () => {
    expect(previewTabNeedsSandbox(null, ENVIRONMENT)).toBe(true);
    expect(previewTabNeedsSandbox(`${ENVIRONMENT}/api/assets/task-1/a.html`, null)).toBe(true);
    expect(previewTabNeedsSandbox("not a url", ENVIRONMENT)).toBe(true);
  });
});

describe("resolveActiveSurfaceNeedsSandbox", () => {
  const ENVIRONMENT = "https://moatless.example.com";
  const browserSurface = (tabId: string): RightPanelSurface => ({
    id: `browser:${tabId}`,
    kind: "preview",
    resourceId: tabId,
  });
  const previewTab = (tabId: string, url: string | null): PreviewSessionSnapshot => ({
    threadId: "task-1",
    tabId,
    navStatus: url === null ? { _tag: "Idle" } : { _tag: "Success", url, title: "Report" },
    canGoBack: false,
    canGoForward: false,
    updatedAt: "2026-01-01T00:00:00.000Z",
  });
  const resolve = (input: {
    surfaces: readonly RightPanelSurface[];
    activeSurfaceId: string | null;
    previewSessions?: Record<string, PreviewSessionSnapshot>;
  }) =>
    resolveActiveSurfaceNeedsSandbox({
      surfaces: input.surfaces,
      activeSurfaceId: input.activeSurfaceId,
      previewSessions: input.previewSessions ?? {},
      environmentHttpBaseUrl: ENVIRONMENT,
    });

  it("frees a browser tab opened on a workspace file", () => {
    // The file surface beside it already renders this page with the sandbox
    // stopped, so gating the browser hid a working surface.
    expect(
      resolve({
        surfaces: [browserSurface("tab-1")],
        activeSurfaceId: "browser:tab-1",
        previewSessions: {
          "tab-1": previewTab("tab-1", `${ENVIRONMENT}/api/assets/task-1/docs/report.html`),
        },
      }),
    ).toBe(false);
  });

  it("gates a browser tab on a server inside the sandbox", () => {
    expect(
      resolve({
        surfaces: [browserSurface("tab-1")],
        activeSurfaceId: "browser:tab-1",
        previewSessions: {
          "tab-1": previewTab("tab-1", "https://3000-task-1.preview.example.com/"),
        },
      }),
    ).toBe(true);
  });

  it("gates a browser tab whose session it has not seen", () => {
    expect(resolve({ surfaces: [browserSurface("tab-1")], activeSurfaceId: "browser:tab-1" })).toBe(
      true,
    );
  });

  it("gates the empty browser tab", () => {
    expect(
      resolve({
        surfaces: [{ id: "browser:new", kind: "preview", resourceId: null }],
        activeSurfaceId: "browser:new",
      }),
    ).toBe(true);
  });

  it("keeps the kind's own answer for every other surface", () => {
    expect(resolve({ surfaces: [{ id: "files", kind: "files" }], activeSurfaceId: "files" })).toBe(
      false,
    );
    expect(resolve({ surfaces: [{ id: "diff", kind: "diff" }], activeSurfaceId: "diff" })).toBe(
      true,
    );
  });

  it("gates an id with no surface behind it, and frees an empty panel", () => {
    expect(resolve({ surfaces: [], activeSurfaceId: "browser:tab-1" })).toBe(true);
    expect(resolve({ surfaces: [], activeSurfaceId: null })).toBe(false);
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
