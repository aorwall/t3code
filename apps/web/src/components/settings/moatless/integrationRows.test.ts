import { describe, expect, it } from "vite-plus/test";

import type {
  AdapterAppSummary,
  AdapterConnectionResponse,
} from "@t3tools/moatless-api/generated/model";

import {
  adapterKindLabel,
  compareAdapterApps,
  compareConnections,
  defaultConnectionKind,
  secretFingerprints,
} from "./integrationRows";

function connection(overrides: Partial<AdapterConnectionResponse> = {}): AdapterConnectionResponse {
  return {
    adapterKind: "slack",
    connectionKind: "bot_api",
    createdAt: "2026-01-01T00:00:00Z",
    createdBy: "user_1",
    externalAccountId: "acct",
    id: "conn_1",
    scope: "global",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function app(overrides: Partial<AdapterAppSummary> = {}): AdapterAppSummary {
  return {
    adapterKind: "slack",
    appKey: "default",
    config: {},
    displayName: "Slack",
    revision: 1,
    secretFingerprints: {},
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("adapterKindLabel", () => {
  it("labels known adapters and passes through unknown ones", () => {
    expect(adapterKindLabel("github_pr")).toBe("GitHub PR");
    expect(adapterKindLabel("mystery")).toBe("mystery");
  });
});

describe("defaultConnectionKind", () => {
  it("chooses the kind by adapter", () => {
    expect(defaultConnectionKind("webhook")).toBe("webhook");
    expect(defaultConnectionKind("github")).toBe("org_webhook");
    expect(defaultConnectionKind("slack")).toBe("bot_api");
  });
});

describe("compareConnections", () => {
  it("orders by external account id, case-insensitively", () => {
    const rows = [
      connection({ externalAccountId: "Zeta" }),
      connection({ externalAccountId: "alpha" }),
    ];
    expect([...rows].sort(compareConnections).map((r) => r.externalAccountId)).toEqual([
      "alpha",
      "Zeta",
    ]);
  });
});

describe("compareAdapterApps", () => {
  it("orders by adapter label, then app key", () => {
    const rows = [
      app({ adapterKind: "slack", appKey: "b" }),
      app({ adapterKind: "slack", appKey: "a" }),
      app({ adapterKind: "linear", appKey: "z" }),
    ];
    const keys = [...rows].sort(compareAdapterApps).map((r) => `${r.adapterKind}:${r.appKey}`);
    expect(keys).toEqual(["linear:z", "slack:a", "slack:b"]);
  });
});

describe("secretFingerprints", () => {
  it("returns configured secrets sorted by name", () => {
    const result = secretFingerprints(
      app({ secretFingerprints: { signing_secret: "sha:2", bot_token: "sha:1" } }),
    );
    expect(result).toEqual([
      { name: "bot_token", fingerprint: "sha:1" },
      { name: "signing_secret", fingerprint: "sha:2" },
    ]);
  });

  it("treats an app with no configured secrets as empty", () => {
    expect(secretFingerprints(app())).toEqual([]);
  });
});
