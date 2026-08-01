import tailwindcss from "@tailwindcss/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import { defineProject, type TestProjectInlineConfiguration } from "vite-plus/test/config";
import "vite-plus/test/config";
import { defineConfig } from "vite-plus";
import pkg from "./package.json" with { type: "json" };

import { DEV_PROXIED_PATH_PREFIXES } from "@t3tools/shared/devProxy";

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

// Where this dev server proxies the backend, when it is not the bundled T3
// server the runner starts. Pointing it at a Moatless environment is what makes
// the fork's UI work against that backend; see docs/user/moatless-backend.md.
const proxyTargetOverride =
  process.env.T3CODE_DEV_PROXY_TARGET?.trim() ||
  repoFileEnv.T3CODE_PROXY_TARGET_OVERRIDE?.trim() ||
  process.env.T3CODE_PROXY_TARGET?.trim() ||
  process.env.MOATLESS_BASE_URL?.trim() ||
  undefined;

// Single-origin dev is signalled positively, because it cannot be inferred
// from the absence of VITE_HTTP_URL/VITE_WS_URL: the runner deletes those keys
// but `loadRepoEnv` merges `.env`/`.env.local` *underneath* the process env, so
// a developer with either URL in their `.env` gets it back here. Baking it then
// pins the client to localhost and breaks every non-localhost origin — the
// exact failure single-origin mode exists to prevent, and an invisible one
// since the page still loads.
// A configured proxy target implies it too: the whole point of naming one is
// that the browser talks to this origin and lets the proxy forward everything,
// so a baked-in VITE_HTTP_URL/VITE_WS_URL would route straight past it.
const isSingleOriginDev =
  process.env.T3CODE_SINGLE_ORIGIN_DEV === "1" || proxyTargetOverride !== undefined;

const port = Number(process.env.PORT ?? 5733);
const explicitHost = process.env.HOST?.trim();
const host = explicitHost || "localhost";
// A wildcard bind address says "listen on every interface"; it is not an
// address a browser can dial. A container or sandbox sets HOST=0.0.0.0 so the
// dev server is reachable from outside it, and pinning the HMR socket to that
// value sends the page to ws://0.0.0.0 — which is refused, and is insecure
// content besides when the page itself is served over HTTPS. Deriving the host
// from the page origin is right in exactly those deployments.
const WILDCARD_BIND_HOSTS = new Set(["0.0.0.0", "::", "[::]", "::0", "0000::0"]);
const hmrHost =
  explicitHost && !WILDCARD_BIND_HOSTS.has(explicitHost.toLowerCase()) ? explicitHost : undefined;
const configuredWsUrl = isSingleOriginDev ? undefined : process.env.VITE_WS_URL?.trim();
const configuredHttpUrl = isSingleOriginDev ? undefined : process.env.VITE_HTTP_URL?.trim();
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

function resolveDevProxyTarget(
  backendPort: string | undefined,
  wsUrl: string | undefined,
): string | undefined {
  // Browser dev is single-origin: the backend port is proxied through this
  // server so the app works from any origin (localhost, tailnet, LAN, phone).
  // T3CODE_PORT is set by scripts/dev-runner.ts for every non-desktop mode.
  const port = Number(backendPort?.trim());
  if (Number.isInteger(port) && port > 0) {
    return `http://localhost:${port}/`;
  }

  // dev:desktop still points the renderer straight at the backend, so fall
  // back to deriving the target from the explicit websocket URL.
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

// The override wins over T3CODE_PORT: the runner sets that unconditionally for
// browser dev, so a hosted sandbox that wants its own backend proxied has no
// other way to say so.
const devProxyTarget =
  proxyTargetOverride ?? resolveDevProxyTarget(process.env.T3CODE_PORT, configuredWsUrl);

// Vite rejects requests whose Host header isn't localhost, which blocks sharing
// a dev server over Tailscale/LAN. Tailnet names are safe to allow wholesale:
// the DNS is controlled by tailscale, so they can't be rebound by an attacker.
// Anything else (ngrok, a LAN IP alias, a hosted sandbox's preview domain) goes
// through the env vars. T3CODE_ALLOWED_HOSTS is the fork's alias, kept because
// deployments inject it by that name; a leading dot allows a domain and every
// subdomain under it, which is what generated per-sandbox hostnames need:
//
//   T3CODE_ALLOWED_HOSTS=.preview.example.com,dev.example.com
//
// Either var set to `true` disables the check entirely — convenient behind a
// trusted proxy, but it drops the DNS-rebinding protection, so prefer a list.
const allowedHostsEnv = [
  process.env.T3CODE_DEV_ALLOWED_HOSTS ?? "",
  process.env.T3CODE_ALLOWED_HOSTS ?? "",
];
const configuredAllowedHosts = allowedHostsEnv
  .flatMap((value) => value.split(","))
  .map((entry) => entry.trim())
  .filter((entry) => entry.length > 0);
const allowedHosts: string[] | true = configuredAllowedHosts.some(
  (entry) => entry.toLowerCase() === "true",
)
  ? true
  : [".ts.net", ...configuredAllowedHosts];

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
    assetsInclude: ["**/*.wasm"],
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
    define: {
      // In dev mode, tell the web app where the WebSocket server lives
      "import.meta.env.VITE_WS_URL": JSON.stringify(configuredWsUrl ?? ""),
      // Pinned explicitly rather than left to Vite's automatic VITE_ exposure:
      // under single-origin dev this must stay empty even when a `.env`
      // supplies it, so the client falls back to window.location.origin.
      "import.meta.env.VITE_HTTP_URL": JSON.stringify(configuredHttpUrl ?? ""),
      "import.meta.env.VITE_T3CODE_RELAY_URL": JSON.stringify(configuredRelayUrl),
      "import.meta.env.VITE_CLERK_PUBLISHABLE_KEY": JSON.stringify(configuredClerkPublishableKey),
      "import.meta.env.VITE_CLERK_JWT_TEMPLATE": JSON.stringify(configuredClerkJwtTemplate),
      "import.meta.env.VITE_CLERK_CLI_OAUTH_CLIENT_ID": JSON.stringify(
        configuredClerkCliOAuthClientId,
      ),
      "import.meta.env.VITE_RELAY_OTLP_TRACES_URL": JSON.stringify(configuredRelayTracingUrl),
      "import.meta.env.VITE_RELAY_OTLP_TRACES_DATASET": JSON.stringify(
        configuredRelayTracingDataset,
      ),
      "import.meta.env.VITE_RELAY_OTLP_TRACES_TOKEN": JSON.stringify(configuredRelayTracingToken),
      "import.meta.env.VITE_HOSTED_APP_URL": JSON.stringify(configuredHostedAppUrl ?? ""),
      "import.meta.env.VITE_HOSTED_APP_CHANNEL": JSON.stringify(configuredHostedAppChannel),
      "import.meta.env.APP_VERSION": JSON.stringify(configuredAppVersion),
      // Proxying to a configured target means the backend is Moatless, whose
      // session cookie is host-scoped and already sent same-origin. The client
      // reads this to skip the token exchange — see environments/primary/auth.ts.
      "import.meta.env.VITE_MOATLESS_PROXY_AUTH": JSON.stringify(proxyTargetOverride ? "true" : ""),
    },
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
      ...(devProxyTarget
        ? {
            // One entry per shared prefix; the server's dev catch-all 404s the
            // same list, so the two sides cannot drift. `/ws` is the app's own
            // socket — Vite's HMR socket is matched separately and exactly
            // (path "/" plus a vite-hmr subprotocol), so the two upgrade
            // handlers don't collide.
            proxy: Object.fromEntries(
              DEV_PROXIED_PATH_PREFIXES.map((prefix) => [
                prefix,
                {
                  target: devProxyTarget,
                  changeOrigin: true,
                  ...(prefix === "/ws" ? { ws: true } : {}),
                },
              ]),
            ),
          }
        : {}),
      // Electron's BrowserWindow needs the HMR socket pinned to an explicit
      // host to connect reliably; dev:desktop sets HOST for that. Everywhere
      // else, leaving this unset lets the client derive it from the page
      // origin, which is what makes HMR work over Tailscale/LAN instead of
      // failing an attempt against the wrong machine's localhost first.
      // (Vite 8 logs connection state via console.debug — enable "Verbose".)
      ...(hmrHost
        ? {
            hmr: {
              protocol: "ws",
              host: hmrHost,
              clientPort: port,
            },
          }
        : {}),
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
