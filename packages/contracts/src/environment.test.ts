import * as Schema from "effect/Schema";
import { describe, expect, it } from "vite-plus/test";

import { ExecutionEnvironmentDescriptor } from "./environment.ts";

const decodeDescriptor = Schema.decodeUnknownSync(ExecutionEnvironmentDescriptor);

const descriptor = {
  environmentId: "environment-1",
  label: "Local",
  platform: { os: "darwin", arch: "arm64" },
  serverVersion: "0.0.32",
  capabilities: { repositoryIdentity: true },
} as const;

describe("ExecutionEnvironmentDescriptor", () => {
  it("decodes old, recognized and future manual installation descriptors", () => {
    expect(decodeDescriptor(descriptor).capabilities.serverInstallation).toBeUndefined();
    for (const installation of [{ kind: "npx" }, { kind: "npm-global", prefix: "/opt/node" }]) {
      expect(
        decodeDescriptor({
          ...descriptor,
          capabilities: { ...descriptor.capabilities, serverInstallation: installation },
        }).capabilities.serverInstallation,
      ).toEqual(installation);
    }
    for (const installation of [{ kind: "future-manager" }, { kind: "npm-global" }]) {
      expect(
        decodeDescriptor({
          ...descriptor,
          capabilities: { ...descriptor.capabilities, serverInstallation: installation },
        }).capabilities.serverInstallation,
      ).toBeUndefined();
    }
  });

  it("treats a missing scripts capability as unsupported under version skew", () => {
    expect(decodeDescriptor(descriptor).capabilities.workspaceScripts).toBeUndefined();
  });

  it("preserves an advertised scripts capability", () => {
    expect(
      decodeDescriptor({
        ...descriptor,
        capabilities: { ...descriptor.capabilities, workspaceScripts: true },
      }).capabilities.workspaceScripts,
    ).toBe(true);
  });

  /**
   * Fork: absent, the client keeps polling `sandbox.status`. Reading a missing key as
   * "supported" would subscribe to a method the server answers with
   * `UnsupportedMethodError`, and the indicator would show that error instead of
   * a status.
   */
  it("treats a missing sandbox-status-push capability as unsupported under version skew", () => {
    expect(decodeDescriptor(descriptor).capabilities.sandboxStatusPush).toBeUndefined();
  });

  it("preserves an advertised sandbox-status-push capability", () => {
    expect(
      decodeDescriptor({
        ...descriptor,
        capabilities: { ...descriptor.capabilities, sandboxStatusPush: true },
      }).capabilities.sandboxStatusPush,
    ).toBe(true);
  });
});
