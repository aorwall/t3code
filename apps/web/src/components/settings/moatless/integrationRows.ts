import type { AdapterKind } from "@t3tools/moatless-api/generated/model";
import type {
  AdapterAppSummary,
  AdapterConnectionResponse,
} from "@t3tools/moatless-api/generated/model";

/**
 * Naming and ordering for the three integration lists — connections, adapter
 * apps and their configured secrets — derived from the API shapes alone.
 *
 * Beside a test because a fingerprint list is data someone reads to answer "is
 * the signing secret set?", and a mislabelled or mis-sorted one answers it
 * wrong without ever looking broken.
 */

const ADAPTER_LABELS: Partial<Record<AdapterKind, string>> = {
  slack: "Slack",
  telegram: "Telegram",
  github: "GitHub",
  github_pr: "GitHub PR",
  linear: "Linear",
  webhook: "Webhook",
};

export function adapterKindLabel(adapter: string): string {
  return ADAPTER_LABELS[adapter as AdapterKind] ?? adapter;
}

/**
 * The connection kind a new connection defaults to for an adapter. Mirrors the
 * SPA: a webhook connection is a webhook, a GitHub one an org webhook, and
 * everything else a bot API connection.
 */
export function defaultConnectionKind(adapter: string): string {
  if (adapter === "webhook") return "webhook";
  if (adapter === "github") return "org_webhook";
  return "bot_api";
}

/** Connections ordered by the account they point at, case-insensitively. */
export function compareConnections(
  a: AdapterConnectionResponse,
  b: AdapterConnectionResponse,
): number {
  return a.externalAccountId.localeCompare(b.externalAccountId, undefined, {
    sensitivity: "accent",
  });
}

/** Adapter apps ordered by adapter, then by app key. */
export function compareAdapterApps(a: AdapterAppSummary, b: AdapterAppSummary): number {
  const byKind = adapterKindLabel(a.adapterKind).localeCompare(adapterKindLabel(b.adapterKind));
  return byKind !== 0 ? byKind : a.appKey.localeCompare(b.appKey);
}

export interface SecretFingerprint {
  readonly name: string;
  readonly fingerprint: string;
}

/**
 * The configured secrets of an app, as a stable list. The fingerprints are a
 * record keyed by secret name; a list sorted by name is what a row iterates,
 * and sorting keeps the display from reordering on an unrelated save.
 */
export function secretFingerprints(app: AdapterAppSummary): SecretFingerprint[] {
  return Object.entries(app.secretFingerprints ?? {})
    .map(([name, fingerprint]) => ({ name, fingerprint }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
