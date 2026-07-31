import { EnvironmentId, type ThreadServer, ThreadId } from "@t3tools/contracts";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const mocks = vi.hoisted(() => ({
  servers: [] as ThreadServer[],
  sandboxStatus: "ready" as string | null,
  isPending: false,
  addBrowserSurface: vi.fn(async (_input: unknown) => ({
    _tag: "Success" as const,
    value: void 0,
  })),
  logStreamFor: null as string | null,
}));

vi.mock("./useThreadServers", () => ({
  useThreadServers: () => ({
    servers: mocks.servers,
    sandboxStatus: mocks.sandboxStatus,
    isPending: mocks.isPending,
    error: null,
    refresh: vi.fn(),
  }),
}));

vi.mock("./ServerLogStream", () => ({
  ServerLogStream: (props: { name: string }) => {
    mocks.logStreamFor = props.name;
    return null;
  },
}));

vi.mock("~/components/preview/addBrowserSurface", () => ({
  addBrowserSurface: mocks.addBrowserSurface,
}));

vi.mock("~/state/preview", () => ({ previewEnvironment: { open: {} } }));
vi.mock("~/state/use-atom-command", () => ({ useAtomCommand: () => vi.fn() }));
vi.mock("~/components/ui/toast", () => ({ toastManager: { add: vi.fn() } }));

const { ServersPanel } = await import("./ServersPanel");

const threadRef = {
  environmentId: EnvironmentId.make("environment-1"),
  threadId: ThreadId.make("thread-1"),
} as const;

function server(overrides: Partial<ThreadServer> = {}): ThreadServer {
  return {
    name: "web",
    label: "Web",
    port: 5733,
    status: "started",
    url: "https://task--5733.example.com",
    error: null,
    detail: null,
    default: true,
    ...overrides,
  };
}

beforeEach(() => {
  mocks.servers = [];
  mocks.sandboxStatus = "ready";
  mocks.isPending = false;
  mocks.logStreamFor = null;
  mocks.addBrowserSurface.mockClear();
});

describe("ServersPanel", () => {
  it("renders a row per declared server", () => {
    mocks.servers = [
      server(),
      server({ name: "docs", label: "Docs", port: 4000, status: "starting", default: false }),
    ];

    const markup = renderToStaticMarkup(<ServersPanel threadRef={threadRef} />);

    expect(markup).toContain("Web");
    expect(markup).toContain("port 5733");
    expect(markup).toContain("started");
    expect(markup).toContain("Docs");
    expect(markup).toContain("port 4000");
    expect(markup).toContain("starting");
  });

  it("names the reason a failed server failed", () => {
    mocks.servers = [server({ status: "failed", error: "CrashLoopBackOff", url: null })];

    const markup = renderToStaticMarkup(<ServersPanel threadRef={threadRef} />);

    expect(markup).toContain("failed");
    expect(markup).toContain("CrashLoopBackOff");
  });

  it("says why a thread with no servers has none", () => {
    mocks.sandboxStatus = "not_created";

    const markup = renderToStaticMarkup(<ServersPanel threadRef={threadRef} />);

    expect(markup).toContain("This environment has not been created yet.");
  });

  /**
   * The list is config-first: a thread that was never provisioned still
   * declares its servers, and each of those rows carries the status resolution
   * falls back to. Without this the panel would show `starting` forever and
   * never say that there is no environment behind it.
   */
  it("says the environment is absent even while it lists the servers it declares", () => {
    mocks.sandboxStatus = "not_created";
    mocks.servers = [server({ status: "starting" })];

    const markup = renderToStaticMarkup(<ServersPanel threadRef={threadRef} />);

    expect(markup).toContain("This environment has not been created yet.");
    expect(markup).toContain("port 5733");
  });

  it("stays quiet about the environment when it is ready", () => {
    mocks.servers = [server()];

    const markup = renderToStaticMarkup(<ServersPanel threadRef={threadRef} />);

    expect(markup).not.toContain("This environment");
  });

  it("offers Open only for a server that has somewhere to point at", () => {
    mocks.servers = [
      server(),
      server({ name: "docs", label: "Docs", url: null, status: "stopped" }),
    ];

    const markup = renderToStaticMarkup(<ServersPanel threadRef={threadRef} />);
    const openButtons = markup.match(/>Open</g);

    expect(openButtons).toHaveLength(2);
    expect(markup.match(/disabled=""/g)).toHaveLength(1);
  });

  it("expands no log until a row is expanded", () => {
    mocks.servers = [server()];

    renderToStaticMarkup(<ServersPanel threadRef={threadRef} />);

    expect(mocks.logStreamFor).toBeNull();
  });
});
