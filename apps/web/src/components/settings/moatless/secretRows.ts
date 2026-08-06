import type { SecretKind, SecretMetadataResponse } from "@t3tools/moatless-api/generated/model";

/**
 * What a Secret row says about itself, worked out away from the component.
 *
 * Pure so the wording is testable without a browser: a secret's `kind` is an
 * open enum on the wire (`internal` exists and is not offered in the editor),
 * and a row that renders a raw enum token where a label belongs is the failure
 * this exists to prevent.
 */

/**
 * Human labels for the kinds an administrator picks between. `internal` is a
 * real wire value but is never authored here, so it has no label and falls back
 * to its token — a row still names it rather than blanking.
 */
export const SECRET_KIND_LABELS: Partial<Record<SecretKind, string>> = {
  env: "Environment variable",
  provider_token: "Provider token",
  runtime_file: "Runtime file",
  deployment: "Deployment",
  ssh_key: "SSH key",
};

/** The label for a kind, or the raw token when the kind has none. */
export function secretKindLabel(kind: SecretKind): string {
  return SECRET_KIND_LABELS[kind] ?? kind;
}

/**
 * Sort order for a scope's list: active secrets first, then by key.
 *
 * Disabled secrets stay in the list — they are dimmed, not hidden, because the
 * one thing someone does with a disabled secret is find it and re-enable it.
 * Sinking them keeps that reachable without letting them sit above the keys in
 * use. `key` is compared case-insensitively so `AWS_` and `aws_` do not split.
 */
export function compareSecrets(a: SecretMetadataResponse, b: SecretMetadataResponse): number {
  if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
  return a.key.localeCompare(b.key, undefined, { sensitivity: "base" });
}
