import type { EnvironmentId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { resolveMoatlessTaskLink } from "./moatlessTaskLink";

const ENVIRONMENT_ID = "moatless-65e765221f33baf0" as EnvironmentId;

describe("resolveMoatlessTaskLink", () => {
  it("sends a task to the primary environment's thread route", () => {
    expect(
      resolveMoatlessTaskLink({
        taskId: "829c8ad3-0efe-4510-a840-493474c6ae22",
        primaryEnvironmentId: ENVIRONMENT_ID,
        catalogReady: true,
      }),
    ).toEqual({
      kind: "resolved",
      environmentId: ENVIRONMENT_ID,
      threadId: "829c8ad3-0efe-4510-a840-493474c6ae22",
    });
  });

  it("waits while the connection catalog is still loading", () => {
    expect(
      resolveMoatlessTaskLink({
        taskId: "829c8ad3-0efe-4510-a840-493474c6ae22",
        primaryEnvironmentId: null,
        catalogReady: false,
      }),
    ).toEqual({ kind: "pending" });
  });

  it("gives up once a ready catalog has no primary environment", () => {
    expect(
      resolveMoatlessTaskLink({
        taskId: "829c8ad3-0efe-4510-a840-493474c6ae22",
        primaryEnvironmentId: null,
        catalogReady: true,
      }),
    ).toEqual({ kind: "unresolvable" });
  });

  it("resolves before the catalog is ready when the environment is already registered", () => {
    expect(
      resolveMoatlessTaskLink({
        taskId: "829c8ad3-0efe-4510-a840-493474c6ae22",
        primaryEnvironmentId: ENVIRONMENT_ID,
        catalogReady: false,
      }),
    ).toMatchObject({ kind: "resolved" });
  });
});
