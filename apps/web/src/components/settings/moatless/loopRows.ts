import type { AdapterKind } from "@t3tools/moatless-api/generated/model";
import type {
  Loop,
  LoopExecutionState,
  LoopKind,
  LoopSource,
  RoutingMode,
  Schedule,
  Subscription,
} from "@t3tools/moatless-api/generated/model";

/**
 * Everything a Loops row or detail header shows, derived from a `Loop` alone.
 *
 * Kept out of the components and beside a test because the precedence here — a
 * source is a schedule, a subscription, or neither, and each reads differently —
 * is the part worth pinning down, and the part a screenshot cannot prove.
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

const KIND_LABELS: Record<LoopKind, string> = {
  adapter_event: "Subscription",
  schedule: "Schedule",
  manual: "Manual",
};

export function loopKindLabel(kind: LoopKind): string {
  return KIND_LABELS[kind] ?? kind;
}

const STATE_LABELS: Record<LoopExecutionState, string> = {
  awaiting_approval: "Awaiting approval",
  active: "Active",
  paused: "Paused",
};

export function loopStateLabel(state: LoopExecutionState): string {
  return STATE_LABELS[state] ?? state;
}

const ROUTING_MODE_LABELS: Record<RoutingMode, string> = {
  by_subject: "By subject",
  ongoing: "Ongoing",
};

export function routingModeLabel(mode: RoutingMode): string {
  return ROUTING_MODE_LABELS[mode] ?? mode;
}

/**
 * A source is a subscription when it names an adapter, a schedule when it names
 * a cron expression, and manual otherwise. The two guards mirror the union in
 * `LoopSource`, so a component never has to reach into an untagged member.
 */
export function isSubscriptionSource(source: LoopSource): source is Subscription {
  return "adapterKind" in source;
}

export function isScheduleSource(source: LoopSource): source is Schedule {
  return "cronExpression" in source;
}

/**
 * Where a Loop listens, as one line: the provider it fires on and the subject it
 * watches there, or its schedule. The name says what the Loop is for, so the
 * summary never repeats it.
 */
export function loopSourceSummary(loop: Loop): string {
  const source = loop.source;
  if (isSubscriptionSource(source)) {
    return `${adapterKindLabel(source.adapterKind)} · ${source.sourceName || source.sourceMatcher}`;
  }
  if (isScheduleSource(source)) {
    return `Schedule · ${source.cronExpression}`;
  }
  return "Manual";
}

/**
 * Where a git-declared Loop came from, and whether it is still tracking git.
 *
 * Mirrors `workspaceProvenance`: provenance survives an override deliberately,
 * so "was declared in git and is not tracking it now" is the exact state a
 * restore is offered from.
 */
export interface LoopProvenance {
  readonly isLocked: boolean;
  readonly isOverridden: boolean;
  readonly configPath: string | null;
}

export function loopProvenance(loop: Loop): LoopProvenance {
  const fromGit = loop.syncedFromGit === true || loop.configSource === "git";
  const hasGitOrigin =
    typeof loop.sourceRepositoryId === "string" || typeof loop.sourceConfigPath === "string";

  return {
    isLocked: fromGit,
    isOverridden: !fromGit && hasGitOrigin,
    configPath: loop.sourceConfigPath ?? null,
  };
}

/**
 * Live Loops before deleted ones, then by name. A deleted Loop is kept in the
 * list so its history stays reachable, but it belongs at the bottom.
 */
export function compareLoops(a: Loop, b: Loop): number {
  if (a.deleted !== b.deleted) {
    return a.deleted ? 1 : -1;
  }
  return a.name.localeCompare(b.name, undefined, { sensitivity: "accent" });
}
