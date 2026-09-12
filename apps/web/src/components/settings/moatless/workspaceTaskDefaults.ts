import type { AgentDescriptor } from "@t3tools/moatless-api/generated/model";

/**
 * What a workspace's default model and effort may be set to.
 *
 * The model ids come off the agent catalog, because which agents a deployment
 * installs is its own configuration. The effort words do not: `effort` is an
 * open string passed through to the agent in its own vocabulary, and nothing on
 * the wire says which words one of them takes.
 */

/**
 * The effort words each agent family accepts, mirroring `CreateTaskRequest`'s
 * `effort` in `crates/api-schemas/src/task.rs`.
 */
const CLAUDE_EFFORT_LEVELS = ["low", "medium", "high", "xhigh", "max"] as const;
const CODEX_EFFORT_LEVELS = ["minimal", "low", "medium", "high"] as const;

/** One selectable model, with the effort levels the agent offering it accepts. */
export interface WorkspaceModelOption {
  readonly id: string;
  readonly label: string;
  readonly efforts: readonly string[];
}

/**
 * Every model a task in a workspace can start with, once per id.
 *
 * `defaultModel` names a model id alone and every Claude agent offers the same
 * ids, so the first agent offering an id decides its label and its effort
 * vocabulary. `default` is dropped: it means "whatever the agent picks", which is
 * what an absent `defaultModel` already says.
 *
 * `installed` is not filtered on. It reports whether the person reading holds a
 * credential for that agent, and a workspace's default outlives whoever opened
 * its settings page.
 */
export function workspaceModelOptions(
  agents: readonly AgentDescriptor[],
): readonly WorkspaceModelOption[] {
  const byId = new Map<string, WorkspaceModelOption>();
  for (const agent of agents) {
    const efforts = agent.id.includes("codex") ? CODEX_EFFORT_LEVELS : CLAUDE_EFFORT_LEVELS;
    for (const model of agent.models) {
      if (model.id === "default" || byId.has(model.id)) continue;
      byId.set(model.id, { id: model.id, label: model.label, efforts });
    }
  }
  return [...byId.values()];
}

/** Effort as the product writes it elsewhere: `xhigh` reads as "Extra high". */
export function effortLabel(effort: string): string {
  switch (effort) {
    case "xhigh":
      return "Extra high";
    default:
      return effort.charAt(0).toUpperCase() + effort.slice(1);
  }
}
