import { describe, expect, it } from "vite-plus/test";

import type { AgentDescriptor } from "@t3tools/moatless-api/generated/model";

import { effortLabel, workspaceModelOptions } from "./workspaceTaskDefaults";

function agent(overrides: Partial<AgentDescriptor> = {}): AgentDescriptor {
  return {
    id: "claude-code",
    label: "Claude Code",
    installed: true,
    defaultModel: "default",
    models: [],
    ...overrides,
  };
}

describe("workspaceModelOptions", () => {
  it("lists a model id once across the agents that offer it", () => {
    const options = workspaceModelOptions([
      agent({
        id: "claude-code",
        models: [
          { id: "default", label: "Default" },
          { id: "opus", label: "Claude Opus 5" },
        ],
      }),
      agent({ id: "claude-code-tui", models: [{ id: "opus", label: "Opus" }] }),
    ]);

    expect(options).toEqual([
      { id: "opus", label: "Claude Opus 5", efforts: ["low", "medium", "high", "xhigh", "max"] },
    ]);
  });

  it("gives a codex model the codex effort vocabulary", () => {
    const options = workspaceModelOptions([
      agent({ id: "codex", models: [{ id: "gpt-6-astra", label: "GPT-6 Astra" }] }),
    ]);

    expect(options[0]?.efforts).toEqual(["minimal", "low", "medium", "high"]);
  });

  it("drops the per-agent default, which is what no stored default already means", () => {
    expect(
      workspaceModelOptions([agent({ models: [{ id: "default", label: "Default" }] })]),
    ).toEqual([]);
  });
});

describe("effortLabel", () => {
  it("spells out the one level whose id is not a word", () => {
    expect(effortLabel("xhigh")).toBe("Extra high");
    expect(effortLabel("medium")).toBe("Medium");
  });
});
