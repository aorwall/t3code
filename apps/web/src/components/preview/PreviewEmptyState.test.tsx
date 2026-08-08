// Fork: this component reads Moatless thread preview servers rather than
// upstream's discovered local servers, so the test drives
// `useThreadPreviewServers` instead of upstream's `useDiscoveredLocalServers`.
// See docs/fork/upstream-merge-inventory.md → "Hosted web preview".
import { EnvironmentId, type ScopedThreadRef, ThreadId } from "@t3tools/contracts";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vite-plus/test";

const mocks = vi.hoisted(() => ({
  view: {
    servers: [] as Array<{
      name: string;
      label: string;
      port: number;
      status: string;
      url: string | null;
      error: string | null;
      detail: string | null;
      default: boolean;
    }>,
    isPending: false,
    error: null as string | null,
  },
}));

vi.mock("./useThreadPreviewServers", () => ({
  useThreadPreviewServers: () => mocks.view,
}));

import { PreviewEmptyState } from "./PreviewEmptyState";

const threadRef: ScopedThreadRef = {
  environmentId: EnvironmentId.make("env-1"),
  threadId: ThreadId.make("thread-1"),
};

function server(name: string, port: number, url: string | null) {
  return {
    name,
    label: name,
    port,
    status: url === null ? "starting" : "started",
    url,
    error: null,
    detail: null,
    default: false,
  };
}

function render() {
  return renderToStaticMarkup(
    <PreviewEmptyState threadRef={threadRef} onOpenUrl={() => undefined} />,
  );
}

describe("PreviewEmptyState", () => {
  it("lists each preview server once servers are reported", () => {
    mocks.view = {
      servers: [server("web", 5173, "http://localhost:5173"), server("api", 8080, null)],
      isPending: false,
      error: null,
    };
    const html = render();
    expect(html).toContain("Preview Servers");
    expect(html).toContain("web");
    expect(html).toContain("api");
    expect(html).toContain("port 5173");
  });

  it("shows the loading copy while the first list is pending", () => {
    mocks.view = { servers: [], isPending: true, error: null };
    const html = render();
    expect(html).toContain("No preview yet");
    expect(html).toContain("Loading preview servers...");
  });

  it("surfaces an error in the empty state", () => {
    mocks.view = { servers: [], isPending: false, error: "sandbox is stopped" };
    const html = render();
    expect(html).toContain("No preview yet");
    expect(html).toContain("sandbox is stopped");
  });

  it("keeps the default empty copy when there is nothing to show", () => {
    mocks.view = { servers: [], isPending: false, error: null };
    const html = render();
    expect(html).toContain("No preview yet");
    expect(html).toContain("Type a URL above");
  });
});
