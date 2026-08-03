import { describe, expect, it } from "vite-plus/test";

import { resolveMessageOriginChip } from "./messageOrigin";

describe("message origin chip", () => {
  it("names a known adapter and orders source, label, then author", () => {
    const model = resolveMessageOriginChip({
      kind: "slack",
      label: "#eng",
      url: "https://acme.slack.com/archives/C1",
      user: "ada",
    });

    expect(model.iconKey).toBe("slack");
    expect(model.segments).toEqual(["Slack", "#eng", "ada"]);
    expect(model.url).toBe("https://acme.slack.com/archives/C1");
    expect(model.ariaLabel).toBe("Sent from Slack, #eng, by ada");
  });

  it("maps each known kind to its own icon", () => {
    expect(
      resolveMessageOriginChip({ kind: "github_pr", label: null, url: null, user: null }).iconKey,
    ).toBe("github");
    expect(
      resolveMessageOriginChip({ kind: "linear", label: null, url: null, user: null }).iconKey,
    ).toBe("linear");
    expect(
      resolveMessageOriginChip({ kind: "telegram", label: null, url: null, user: null }).iconKey,
    ).toBe("telegram");
    expect(
      resolveMessageOriginChip({ kind: "task", label: null, url: null, user: null }).iconKey,
    ).toBe("task");
  });

  it("labels another task with its name", () => {
    const model = resolveMessageOriginChip({
      kind: "task",
      label: "Upstream planning",
      url: "https://moatless.example/tasks/task-xyz",
      user: null,
    });

    expect(model.iconKey).toBe("task");
    expect(model.segments).toEqual(["Another task", "Upstream planning"]);
    expect(model.url).toBe("https://moatless.example/tasks/task-xyz");
  });

  it("drops empty label and author rather than showing blank segments", () => {
    const model = resolveMessageOriginChip({
      kind: "github_pr",
      label: "   ",
      url: null,
      user: "",
    });

    expect(model.segments).toEqual(["GitHub"]);
    expect(model.url).toBeNull();
    expect(model.ariaLabel).toBe("Sent from GitHub");
  });

  it("humanizes an unrecognized adapter under the generic icon", () => {
    const model = resolveMessageOriginChip({
      kind: "custom_adapter",
      label: "a room",
      url: null,
      user: null,
    });

    expect(model.iconKey).toBe("generic");
    expect(model.segments).toEqual(["Custom adapter", "a room"]);
  });
});
