import { describe, expect, it } from "vite-plus/test";

import type {
  ActivationResponse,
  EffectivePluginResponse,
  UserListItem,
} from "@t3tools/moatless-api/generated/model";

import {
  activationIdentities,
  activationSetting,
  comparePlugins,
  identityValue,
  isSkillDelivered,
  pluginActivationRows,
  selectedIdentity,
  settingLabel,
  VIEWER_IDENTITY,
} from "./skillRows";

function record(overrides: Partial<ActivationResponse>): ActivationResponse {
  return {
    enabled: true,
    pluginId: "plug_1",
    reach: "everyone",
    ...overrides,
  };
}

function user(overrides: Partial<UserListItem>): UserListItem {
  return {
    id: "u_1",
    login: "someone",
    role: "user",
    provider: "github",
    isBot: false,
    createdAt: "2026-01-01T00:00:00Z",
    lastLoginAt: "2026-01-01T00:00:00Z",
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

describe("activationIdentities", () => {
  const users = [
    user({ id: "u_human", login: "ada", isBot: false }),
    user({ id: "u_bot_z", login: "zeta-bot", name: "Zeta Bot", isBot: true }),
    user({ id: "u_bot_a", login: "alpha-bot", isBot: true }),
  ];

  it("offers the viewer first, then bots, and no other person", () => {
    expect(activationIdentities(users)).toEqual([
      { userId: undefined, label: "You" },
      { userId: "u_bot_a", label: "alpha-bot" },
      { userId: "u_bot_z", label: "Zeta Bot" },
    ]);
  });

  it("gives the viewer no user id, so their record is written as their own", () => {
    const [viewer] = activationIdentities([]);
    expect(viewer?.userId).toBeUndefined();
    expect(identityValue({ userId: undefined, label: "You" })).toBe(VIEWER_IDENTITY);
    expect(identityValue({ userId: "u_bot_a", label: "alpha-bot" })).toBe("u_bot_a");
  });

  it("leaves the caller's list alone", () => {
    const original = [...users];
    activationIdentities(users);
    expect(users).toEqual(original);
  });
});

describe("selectedIdentity", () => {
  const identities = activationIdentities([user({ id: "u_bot", login: "bot", isBot: true })]);

  it("finds the identity a value names", () => {
    expect(selectedIdentity(identities, "u_bot")?.label).toBe("bot");
  });

  it("falls back to the viewer when the selection names nobody", () => {
    // A bot deleted while this page is open leaves a selection pointing at it;
    // reading the viewer's own records is the answer that is always safe.
    expect(selectedIdentity(identities, "u_gone")).toEqual({ userId: undefined, label: "You" });
    expect(selectedIdentity(identities, VIEWER_IDENTITY).userId).toBeUndefined();
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
