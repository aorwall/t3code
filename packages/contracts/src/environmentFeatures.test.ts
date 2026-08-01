/**
 * The direction absence points, which is the whole of this schema's risk.
 *
 * Getting it backwards is silent and total: default a field the wrong way and
 * every upstream server — which will never send these flags — loses its entire
 * UI, with nothing on screen to say why. So each shape a descriptor can arrive
 * in is decoded here rather than reasoned about.
 */
import * as Schema from "effect/Schema";
import { describe, expect, it } from "vite-plus/test";

import environmentDescriptor from "../fixtures/moatless/environment-descriptor.json" with { type: "json" };
import { ExecutionEnvironmentDescriptor } from "./environment.ts";
import { ALL_ENVIRONMENT_FEATURES, resolveEnvironmentFeatures } from "./environmentFeatures.ts";

const decode = Schema.decodeUnknownSync(ExecutionEnvironmentDescriptor);

const baseDescriptor = {
  environmentId: "env-1",
  label: "Somewhere",
  platform: { os: "linux", arch: "x64" },
  serverVersion: "0.0.31",
};

describe("ExecutionEnvironmentCapabilities.features", () => {
  it("is every feature on when a server declares none", () => {
    const descriptor = decode({
      ...baseDescriptor,
      capabilities: { repositoryIdentity: true, connectionProbe: true },
    });

    expect(descriptor.capabilities.features).toBeUndefined();
    expect(resolveEnvironmentFeatures(descriptor.capabilities.features)).toEqual(
      ALL_ENVIRONMENT_FEATURES,
    );
  });

  it("fills in the rest when a server declares only what it withholds", () => {
    const descriptor = decode({
      ...baseDescriptor,
      capabilities: { repositoryIdentity: true, features: { terminal: false } },
    });

    const features = resolveEnvironmentFeatures(descriptor.capabilities.features);
    expect(features.terminal).toBe(false);
    expect(features.versionControl).toBe(true);
    expect(features.diffs).toBe(true);
    expect(features.threadArchival).toBe(true);
  });

  it("leaves the other capability flags pointing the other way", () => {
    // `threadSettlement` shipped with its feature, so absent means unsupported.
    // `features` gates surfaces that predate it, so absent means supported. The
    // two live on the same struct and must not be read the same way.
    const descriptor = decode({ ...baseDescriptor, capabilities: {} });

    expect(descriptor.capabilities.threadSettlement).toBeUndefined();
    expect(resolveEnvironmentFeatures(descriptor.capabilities.features).terminal).toBe(true);
  });
});

describe("the Moatless descriptor", () => {
  it("withholds every feature it declares", () => {
    const descriptor = decode(environmentDescriptor);

    expect(resolveEnvironmentFeatures(descriptor.capabilities.features)).toEqual({
      terminal: false,
      versionControl: false,
      diffs: false,
      projectManagement: false,
      workspaceWrites: false,
      serverAdministration: false,
      diagnostics: false,
      threadArchival: false,
    });
  });
});
