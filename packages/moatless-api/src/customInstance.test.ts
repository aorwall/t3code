import { describe, expect, it } from "vite-plus/test";

import {
  MoatlessRequestError,
  MoatlessTransportError,
  configureMoatlessApi,
  customInstance,
  errorMessage,
  ok,
} from "./customInstance.ts";

describe("errorMessage", () => {
  it("prefers a flat error string", () => {
    expect(errorMessage(400, "Bad Request", { error: "name is required" })).toBe(
      "name is required",
    );
  });

  it("reads a message nested under error", () => {
    expect(errorMessage(400, "Bad Request", { error: { message: "no such repo" } })).toBe(
      "no such repo",
    );
  });

  it("reads message and detail", () => {
    expect(errorMessage(409, "Conflict", { message: "already placed" })).toBe("already placed");
    expect(errorMessage(422, "", { detail: "branch not found" })).toBe("branch not found");
  });

  it("falls back to a status sentence when HTTP/2 dropped the reason phrase", () => {
    // The failure this guards: statusText is "" on HTTP/2, so an error built
    // from it alone reaches the UI as a blank message.
    expect(errorMessage(500, "", null)).toBe("Request failed with status 500");
  });

  it("ignores an empty server message rather than showing nothing", () => {
    expect(errorMessage(500, "Internal Server Error", { error: "" })).toBe("Internal Server Error");
  });
});

describe("ok", () => {
  it("returns the body of any 2xx", () => {
    expect(
      ok<{ id: string }>({ data: { id: "ws_1" }, status: 200, headers: new Headers() }),
    ).toEqual({ id: "ws_1" });
    expect(ok({ data: null, status: 204, headers: new Headers() })).toBe(null);
  });

  it("raises a request error carrying the status and the body", () => {
    let raised: unknown;
    try {
      ok({ data: { error: "not an admin" }, status: 403, headers: new Headers() });
    } catch (cause) {
      raised = cause;
    }

    expect(raised).toBeInstanceOf(MoatlessRequestError);
    const error = raised as MoatlessRequestError;
    expect(error.message).toBe("not an admin");
    expect(error.isForbidden).toBe(true);
    expect(error.isUnauthenticated).toBe(false);
    expect(error.data).toEqual({ error: "not an admin" });
  });

  it("tells the two recoverable rejections apart", () => {
    const unauthenticated = new MoatlessRequestError("gone", 401, null);
    expect(unauthenticated.isUnauthenticated).toBe(true);
    expect(unauthenticated.isForbidden).toBe(false);
  });
});

describe("customInstance", () => {
  async function withFetch<T>(
    impl: (url: string, init?: RequestInit) => Promise<Response>,
    run: () => Promise<T>,
  ): Promise<T> {
    const original = globalThis.fetch;
    globalThis.fetch = impl as typeof globalThis.fetch;
    try {
      return await run();
    } finally {
      globalThis.fetch = original;
      configureMoatlessApi({});
    }
  }

  it("returns the envelope for a rejected status instead of throwing", async () => {
    // The contract orval's fetch client is generated against: a declared 403 is
    // a branch of the return union, so throwing here makes it unreachable.
    const result = await withFetch(
      async () => new Response(JSON.stringify({ error: "not an admin" }), { status: 403 }),
      () => customInstance<{ data: unknown; status: number }>("/api/v1/workspaces"),
    );

    expect(result.status).toBe(403);
    expect(result.data).toEqual({ error: "not an admin" });
  });

  it("carries no body for a 204", async () => {
    const result = await withFetch(
      async () => new Response(null, { status: 204 }),
      () => customInstance<{ data: unknown; status: number }>("/api/v1/workspaces/ws_1"),
    );

    expect(result).toMatchObject({ data: null, status: 204 });
  });

  it("survives a success whose body is not JSON", async () => {
    const result = await withFetch(
      async () => new Response("not json", { status: 200 }),
      () => customInstance<{ data: unknown }>("/api/v1/workspaces"),
    );

    expect(result.data).toBe(null);
  });

  it("appends query parameters and drops the absent ones", async () => {
    let seen = "";
    await withFetch(
      async (url) => {
        seen = url;
        return new Response("[]", { status: 200 });
      },
      () =>
        customInstance("/api/v1/workspaces", {
          params: { includeDeleted: true, scope: undefined, owner: null },
        }),
    );

    expect(seen).toContain("includeDeleted=true");
    expect(seen).not.toContain("scope");
    expect(seen).not.toContain("owner");
  });

  it("sends the session cookie", async () => {
    let credentials: RequestCredentials | undefined;
    await withFetch(
      async (_url, init) => {
        credentials = init?.credentials;
        return new Response("[]", { status: 200 });
      },
      () => customInstance("/api/v1/workspaces"),
    );

    expect(credentials).toBe("include");
  });

  it("prefixes a configured base URL", async () => {
    let seen = "";
    configureMoatlessApi({ baseUrl: "https://moatless.example.com" });
    await withFetch(
      async (url) => {
        seen = url;
        return new Response("[]", { status: 200 });
      },
      () => customInstance("/api/v1/workspaces"),
    );

    expect(seen).toBe("https://moatless.example.com/api/v1/workspaces");
  });

  it("throws when there is no response to narrow on", async () => {
    // No status and no body, so there is nothing to return an envelope from.
    await expect(
      withFetch(
        () => Promise.reject(new TypeError("Failed to fetch")),
        () => customInstance("/api/v1/workspaces"),
      ),
    ).rejects.toBeInstanceOf(MoatlessTransportError);
  });
});
