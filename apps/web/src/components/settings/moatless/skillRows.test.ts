import { describe, expect, it } from "vite-plus/test";

import type {
  ActivationResponse,
  EffectivePluginResponse,
} from "@t3tools/moatless-api/generated/model";

import {
  activationSetting,
  comparePlugins,
  isSkillDelivered,
  pluginActivationRows,
  settingLabel,
} from "./skillRows";

function record(overrides: Partial<ActivationResponse>): ActivationResponse {
  return {
    enabled: true,
    pluginId: "plug_1",
    reach: "everyone",
    ...overrides,
  };
}

describe("activationSetting", () => {
  it("reads no record as unset — inherit the default, not off", () => {
    expect(activationSetting([], "everyone", undefined)).toBe("unset");
  });

  it("distinguishes an explicit off from an absent record", () => {
    const records = [record({ reach: "everyone", enabled: false })];
    // Off is a real record...
    expect(activationSetting(records, "everyone", undefined)).toBe("off");
    // ...and personal, with no record, still inherits rather than borrowing it.
    expect(activationSetting(records, "personal", undefined)).toBe("unset");
  });

  it("matches a whole-plugin record whether skillName is omitted or null", () => {
    expect(activationSetting([record({ skillName: null })], "everyone", undefined)).toBe("on");
    expect(activationSetting([record({})], "everyone", undefined)).toBe("on");
  });

  it("reads a per-skill record independently of the plugin record", () => {
    const records = [
      record({ reach: "everyone", skillName: null, enabled: false }),
      record({ reach: "personal", skillName: "triage", enabled: true }),
    ];
    // The plugin is off for everyone...
    expect(activationSetting(records, "everyone", undefined)).toBe("off");
    // ...while one skill is on for you: source-off, skill-on.
    expect(activationSetting(records, "personal", "triage")).toBe("on");
  });
});

describe("isSkillDelivered", () => {
  const effective: EffectivePluginResponse = {
    pluginId: "plug_1",
    pluginName: "triage",
    skillNames: ["triage"],
  };

  it("never recomputes precedence — a skill is delivered iff the effective set lists it", () => {
    // Even though everyone=off above, the server put "triage" in effect, so it
    // is delivered; a skill the server left out is not.
    expect(isSkillDelivered(effective, "triage")).toBe(true);
    expect(isSkillDelivered(effective, "other")).toBe(false);
  });

  it("delivers the whole plugin when it appears in the effective set at all", () => {
    expect(isSkillDelivered(effective, undefined)).toBe(true);
  });

  it("delivers nothing when the plugin is absent from the effective set", () => {
    expect(isSkillDelivered(undefined, undefined)).toBe(false);
    expect(isSkillDelivered(undefined, "triage")).toBe(false);
  });
});

describe("pluginActivationRows", () => {
  it("puts the whole plugin first, then each skill", () => {
    const rows = pluginActivationRows("triage", [
      { name: "a", description: "does a" },
      { name: "b", description: "does b" },
    ]);
    expect(rows.map((row) => row.skillName)).toEqual([undefined, "a", "b"]);
    const [first] = rows;
    expect(first?.label).toBe("triage");
  });
});

describe("labels and ordering", () => {
  it("labels unset as Not set", () => {
    expect(settingLabel("unset")).toBe("Not set");
  });

  it("orders plugins by name", () => {
    const plugins = [
      { id: "1", name: "Zebra", gitUrl: "z" },
      { id: "2", name: "apple", gitUrl: "a" },
    ];
    expect([...plugins].sort(comparePlugins).map((p) => p.name)).toEqual(["apple", "Zebra"]);
  });
});
