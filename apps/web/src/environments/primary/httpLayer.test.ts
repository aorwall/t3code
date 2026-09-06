import type { DesktopBridge } from "@t3tools/contracts";
import { afterEach, describe, expect, it, vi } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { HttpBody, HttpClient } from "effect/unstable/http";

import { __resetDesktopPrimaryAuthForTests } from "./desktopAuth";
import { makePrimaryEnvironmentHttpLayer } from "./httpLayer";

describe.sequential("primary environment HTTP layer", () => {
  afterEach(() => {
    __resetDesktopPrimaryAuthForTests();
    Reflect.deleteProperty(globalThis, "window");
    // Fork: the CSRF test below is the only one that needs a document.
    Reflect.deleteProperty(globalThis, "document");
    vi.unstubAllGlobals();
  });

  it.effect("uses cookie credentials for browser primary environments", () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        location: {
          href: "http://127.0.0.1:3773/settings",
          origin: "http://127.0.0.1:3773",
        },
      },
    });

    return Effect.gen(function* () {
      yield* HttpClient.get("http://127.0.0.1:3773/api/auth/session");

      const request = new Request(fetchMock.mock.calls[0]?.[0], fetchMock.mock.calls[0]?.[1]);
      expect(request.credentials).toBe("include");
      expect(request.headers.get("authorization")).toBeNull();
    }).pipe(Effect.provide(makePrimaryEnvironmentHttpLayer()));
  });

  // Fork: without this header Moatless 403s every unsafe cookie-authenticated
  // request, which is what silently dropped the client's OTLP trace export.
  it.effect("echoes the Moatless CSRF cookie for browser primary environments", () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: { cookie: "other=1; moatless_csrf=csrf-token-value; moatless_session=opaque" },
    });
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        location: {
          href: "https://moatless-t3.staging.soaplabstest.com/",
          origin: "https://moatless-t3.staging.soaplabstest.com",
        },
      },
    });

    return Effect.gen(function* () {
      yield* HttpClient.post("https://moatless-t3.staging.soaplabstest.com/api/x", {
        body: yield* HttpBody.json({}),
      });

      const request = new Request(fetchMock.mock.calls[0]?.[0], fetchMock.mock.calls[0]?.[1]);
      expect(request.headers.get("x-csrf-token")).toBe("csrf-token-value");
    }).pipe(Effect.provide(makePrimaryEnvironmentHttpLayer()));
  });

  it.effect("uses bearer auth without cookies for desktop-managed primaries", () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        location: { origin: "t3code://app" },
        desktopBridge: {
          getLocalEnvironmentBootstrap: () => ({
            label: "Local environment",
            httpBaseUrl: "http://127.0.0.1:3773",
            wsBaseUrl: "ws://127.0.0.1:3773",
            bootstrapToken: "desktop-bootstrap-token",
          }),
          getLocalEnvironmentBearerToken: vi.fn().mockResolvedValue("desktop-bearer-token"),
        } as unknown as DesktopBridge,
      },
    });

    return Effect.gen(function* () {
      yield* HttpClient.get("http://127.0.0.1:3773/api/connect/link-state");

      const request = new Request(fetchMock.mock.calls[0]?.[0], fetchMock.mock.calls[0]?.[1]);
      expect(request.credentials).not.toBe("include");
      expect(request.headers.get("authorization")).toBe("Bearer desktop-bearer-token");
    }).pipe(Effect.provide(makePrimaryEnvironmentHttpLayer()));
  });
});
