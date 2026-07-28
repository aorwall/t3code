import tailwindcss from "@tailwindcss/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import { defineProject, type TestProjectInlineConfiguration } from "vite-plus/test/config";
import "vite-plus/test/config";
import { defineConfig } from "vite-plus";
import pkg from "./package.json" with { type: "json" };

import { loadRepoEnv } from "../../scripts/lib/public-config";

const repoEnv = loadRepoEnv();
Object.assign(process.env, repoEnv);

// `loadRepoEnv` lets the ambient environment win over the repo's env files,
// which is right for every value it resolves. The proxy target is the one
// exception a fork needs: hosted sandboxes inject T3CODE_PROXY_TARGET pointing
// at their own bundled server, and a checkout has to be able to say "no, use
// mine" without editing the deployment. This name is file-only and, being
// explicitly an override, outranks the ambient value.
const repoFileEnv = loadRepoEnv({ baseEnv: {} });

const port = Number(process.env.PORT ?? 5733);
const host = process.env.HOST?.trim() || "localhost";

// Left unset, Vite's HMR client derives its socket URL from the page's own
// origin. That is what a hosted sandbox needs: it serves the dev server through
// an HTTPS preview hostname on port 443, where a pinned `ws://<bind address>:<port>`
// is both unreachable and blocked as mixed content. Pin the endpoint only when
// HOST names an address a browser can actually dial — the Electron case the
// explicit config below was written for, whose window loads http://localhost:<port>.
const configuredWsUrl = process.env.VITE_WS_URL?.trim();
const configuredRelayUrl = repoEnv.VITE_T3CODE_RELAY_URL?.trim() || "";
const configuredClerkPublishableKey = repoEnv.VITE_CLERK_PUBLISHABLE_KEY?.trim() || "";
const configuredClerkJwtTemplate = repoEnv.VITE_CLERK_JWT_TEMPLATE?.trim() || "";
const configuredClerkCliOAuthClientId = repoEnv.VITE_CLERK_CLI_OAUTH_CLIENT_ID?.trim() || "";
const configuredRelayTracingUrl = repoEnv.VITE_RELAY_OTLP_TRACES_URL?.trim() || "";
const configuredRelayTracingDataset = repoEnv.VITE_RELAY_OTLP_TRACES_DATASET?.trim() || "";
const configuredRelayTracingToken = repoEnv.VITE_RELAY_OTLP_TRACES_TOKEN?.trim() || "";
const configuredHostedAppChannel = process.env.VITE_HOSTED_APP_CHANNEL?.trim() || "";
const configuredAppVersion = process.env.APP_VERSION?.trim() || pkg.version;
const configuredHostedAppUrl = (() => {
  const explicitHostedAppUrl = process.env.VITE_HOSTED_APP_URL?.trim();
  if (explicitHostedAppUrl) {
    return explicitHostedAppUrl;
  }
  if (process.env.VERCEL_ENV === "production" && process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return undefined;
})();
const sourcemapEnv = process.env.T3CODE_WEB_SOURCEMAP?.trim().toLowerCase();

// Vite 8.1's experimental bundled dev mode: serves rolldown-bundled chunks in
// dev for much faster startup/reload on large module graphs, with HMR served
// as hot patches. Opt-in while experimental: T3CODE_BUNDLED_DEV=1 pnpm dev:web
const bundledDevEnv = process.env.T3CODE_BUNDLED_DEV?.trim().toLowerCase();
const bundledDev = bundledDevEnv === "1" || bundledDevEnv === "true";

const buildSourcemap: boolean | "hidden" =
  sourcemapEnv === "0" || sourcemapEnv === "false"
    ? false
    : sourcemapEnv === "hidden"
      ? "hidden"
      : true;

const unitTestProject = {
  extends: true,
  test: {
    name: "unit",
    include: ["src/**/*.test.{ts,tsx}"],
    // The web runtime suite exercises auth bootstrap, saved environments,
    // and websocket subscription lifecycles. Under the full monorepo test
    // run, those async tests can exceed Vitest's default 5s budget.
    hookTimeout: 15_000,
    testTimeout: 15_000,
  },
} satisfies TestProjectInlineConfiguration;

function resolveDevProxyTarget(wsUrl: string | undefined): string | undefined {
  if (!wsUrl) {
    return undefined;
  }

  try {
    const url = new URL(wsUrl);
    if (url.protocol === "ws:") {
      url.protocol = "http:";
    } else if (url.protocol === "wss:") {
      url.protocol = "https:";
    }
    url.pathname = "";
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return undefined;
  }
}

// Everything the browser needs from the T3 server — the HTTP API, attachments,
// OAuth metadata and the `/ws` socket — is proxied through this dev server so
// the app runs on a single origin. That matters wherever the app is not reached
// on localhost (a sandboxed preview domain, a tunnel, another device on the
// LAN): with no VITE_WS_URL configured the client falls back to the window
// origin for both HTTP and WebSocket (see environments/primary/target.ts), and
// only the proxy can get those requests to the server. dev-runner.ts sets
// VITE_WS_URL for local `pnpm dev`; T3CODE_PORT or T3CODE_DEV_PROXY_TARGET
// override the fallback, which otherwise assumes the dev-runner base port.
const DEFAULT_DEV_SERVER_PORT = 13773;
const proxyTargetOverride =
  process.env.T3CODE_DEV_PROXY_TARGET?.trim() ||
  repoFileEnv.T3CODE_PROXY_TARGET_OVERRIDE?.trim() ||
  process.env.T3CODE_PROXY_TARGET?.trim() ||
  process.env.MOATLESS_BASE_URL?.trim();
const devProxyTarget =
  proxyTargetOverride ||
  resolveDevProxyTarget(configuredWsUrl) ||
  `http://localhost:${process.env.T3CODE_PORT?.trim() || String(DEFAULT_DEV_SERVER_PORT)}`;

const devProxyPaths = ["/.well-known", "/api", "/attachments", "/ws"] as const;
const devProxy = Object.fromEntries(
  devProxyPaths.map((path) => [
    path,
    {
      target: devProxyTarget,
      changeOrigin: true,
      // `/ws` is the server's socket endpoint. Vite's own HMR socket lives on
      // "/" with the `vite-hmr` subprotocol, so the two do not collide.
      ws: path === "/ws",
    },
  ]),
);

// Electron loads the renderer from a custom protocol origin (t3code-dev://app),
// so Vite's HMR client cannot derive the websocket URL from the page location
// and must be pointed at the loopback dev server explicitly. dev-runner.ts sets
// T3CODE_HMR_HOST for `dev:desktop`. Everyone else — plain browsers on
// localhost and preview domains served over HTTPS through a reverse proxy —
// gets Vite's default inference, which derives protocol/host/port from the
// /@vite/client script URL (so wss on 443 behind the proxy). Hard-coding
// protocol "ws" there would make the browser refuse the insecure socket.
const hmrHost = process.env.T3CODE_HMR_HOST?.trim() || "";
const hmr = hmrHost
  ? {
      // Vite 8 uses console.debug for connection logs — enable "Verbose" in
      // DevTools to see them.
      protocol: "ws" as const,
      host: hmrHost,
      clientPort: port,
    }
  : undefined;

// Hosts the dev server answers to besides localhost. Vite's host check rejects
// anything else, which breaks whenever the dev server is reached through
// another hostname: a preview or sandbox domain, a tunnel, a LAN address.
// Those hostnames are deployment-specific, so they are configured rather than
// checked in — set a comma-separated T3CODE_ALLOWED_HOSTS in the environment or
// in the repo's gitignored .env (loadRepoEnv above merges it into process.env).
// A leading dot allows a domain and every subdomain under it, which is what
// generated per-sandbox hostnames need:
//
//   T3CODE_ALLOWED_HOSTS=.preview.example.com,dev.example.com
//
// `true` disables the check entirely — convenient behind a trusted proxy, but
// it drops the DNS-rebinding protection, so prefer listing the domains.
const allowedHostsEnv = process.env.T3CODE_ALLOWED_HOSTS?.trim() ?? "";
const allowedHosts: string[] | true =
  allowedHostsEnv.toLowerCase() === "true"
    ? true
    : allowedHostsEnv
        .split(",")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0);

// When the dev server is explicitly configured as the proxy, the browser must
// talk to its own origin and let the proxy forward both HTTP and WebSocket
// traffic. Otherwise the stock local flow keeps the configured WebSocket URL.
const clientWsUrl = proxyTargetOverride ? "" : (configuredWsUrl ?? "");

const clientDefine: Record<string, string> = {
  "import.meta.env.VITE_WS_URL": JSON.stringify(clientWsUrl),
  "import.meta.env.VITE_T3CODE_RELAY_URL": JSON.stringify(configuredRelayUrl),
  "import.meta.env.VITE_CLERK_PUBLISHABLE_KEY": JSON.stringify(configuredClerkPublishableKey),
  "import.meta.env.VITE_CLERK_JWT_TEMPLATE": JSON.stringify(configuredClerkJwtTemplate),
  "import.meta.env.VITE_CLERK_CLI_OAUTH_CLIENT_ID": JSON.stringify(configuredClerkCliOAuthClientId),
  "import.meta.env.VITE_RELAY_OTLP_TRACES_URL": JSON.stringify(configuredRelayTracingUrl),
  "import.meta.env.VITE_RELAY_OTLP_TRACES_DATASET": JSON.stringify(configuredRelayTracingDataset),
  "import.meta.env.VITE_RELAY_OTLP_TRACES_TOKEN": JSON.stringify(configuredRelayTracingToken),
  "import.meta.env.VITE_HOSTED_APP_URL": JSON.stringify(configuredHostedAppUrl ?? ""),
  "import.meta.env.VITE_HOSTED_APP_CHANNEL": JSON.stringify(configuredHostedAppChannel),
  "import.meta.env.APP_VERSION": JSON.stringify(configuredAppVersion),
  "import.meta.env.VITE_MOATLESS_PROXY_AUTH": JSON.stringify(proxyTargetOverride ? "true" : ""),
  ...(proxyTargetOverride ? { "import.meta.env.VITE_HTTP_URL": JSON.stringify("") } : {}),
};

export default defineConfig(({ command, isPreview }) => {
  // Some hosts (containers, CI images, sandboxed preview environments) export
  // NODE_ENV=production process-wide. Vite derives `isProduction` from it even
  // when serving, which makes @vitejs/plugin-react skip the React Refresh
  // preamble while the transform still emits `$RefreshReg$` calls — the app
  // then dies on load with "$RefreshReg$ is not defined". A dev server is
  // development by definition, so pin it back.
  if (command === "serve" && !isPreview && process.env.NODE_ENV === "production") {
    process.env.NODE_ENV = "development";
  }

  return {
    plugins: [
      tanstackRouter(),
      react(),
      babel({
        // We need to be explicit about the parser options after moving to @vitejs/plugin-react v6.0.0
        // This is because the babel plugin only automatically parses typescript and jsx based on relative paths (e.g. "**/*.ts")
        // whereas the previous version of the plugin parsed all files with a .ts extension.
        // This is causing our packages/ directory to fail to parse, as they are not relative to the CWD.
        parserOpts: { plugins: ["typescript", "jsx"] },
        presets: [reactCompilerPreset()],
      }),
      tailwindcss(),
    ],
    optimizeDeps: {
      include: [
        "@clerk/clerk-js",
        "@clerk/react/internal",
        "@pierre/diffs",
        "@pierre/diffs/editor",
        "@pierre/diffs/react",
        "@pierre/diffs/worker/worker.js",
        "effect/Array",
        "effect/Order",
        "react-dom/client",
      ],
    },
    define: clientDefine,
    resolve: {
      tsconfigPaths: true,
      dedupe: ["react", "react-dom"],
    },
    experimental: {
      bundledDev,
    },
    server: {
      host,
      port,
      strictPort: true,
      allowedHosts,
      proxy: devProxy,
      ...(hmr ? { hmr } : {}),
    },
    build: {
      outDir: "dist",
      emptyOutDir: true,
      sourcemap: buildSourcemap,
    },
    test: {
      projects: [defineProject(unitTestProject)],
    },
  };
});
