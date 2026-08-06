import { describe, expect, it } from "vite-plus/test";

import type { SecretMetadataResponse } from "@t3tools/moatless-api/generated/model";

import { compareSecrets, secretKindLabel } from "./secretRows";

function secret(overrides: Partial<SecretMetadataResponse>): SecretMetadataResponse {
  return {
    id: "sec_1",
    key: "KEY",
    kind: "env",
    scope: "global",
    source: "inline_encrypted",
    enabled: true,
    version: 1,
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("secretKindLabel", () => {
  it("labels the kinds an administrator authors", () => {
    expect(secretKindLabel("env")).toBe("Environment variable");
    expect(secretKindLabel("ssh_key")).toBe("SSH key");
  });

  it("falls back to the raw token for a kind with no label", () => {
    // `internal` is on the wire but never offered in the editor, so a row must
    // still name it rather than render an empty cell.
    expect(secretKindLabel("internal")).toBe("internal");
  });
});

describe("compareSecrets", () => {
  it("sinks disabled secrets below active ones", () => {
    const active = secret({ key: "ZZZ", enabled: true });
    const disabled = secret({ key: "AAA", enabled: false });
    expect(compareSecrets(active, disabled)).toBeLessThan(0);
    expect(compareSecrets(disabled, active)).toBeGreaterThan(0);
  });

  it("orders same-state secrets by key, case-insensitively", () => {
    const lower = secret({ key: "aws_token" });
    const upper = secret({ key: "AWS_SECRET" });
    // SECRET < token, and case does not split the two AWS_ keys apart.
    expect(compareSecrets(upper, lower)).toBeLessThan(0);
  });
});
