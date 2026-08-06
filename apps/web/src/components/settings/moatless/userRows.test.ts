import { describe, expect, it } from "vite-plus/test";

import type { UserListItem } from "@t3tools/moatless-api/generated/model";

import { compareUsers, userDisplayName, userMonogram } from "./userRows";

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

describe("userDisplayName", () => {
  it("prefers the display name", () => {
    expect(userDisplayName({ name: "Ada Lovelace", login: "ada" })).toBe("Ada Lovelace");
  });

  it("falls back to the login when the name is missing or blank", () => {
    expect(userDisplayName({ name: null, login: "ada" })).toBe("ada");
    expect(userDisplayName({ name: "   ", login: "ada" })).toBe("ada");
  });
});

describe("userMonogram", () => {
  it("is always a letter from a non-empty source", () => {
    expect(userMonogram({ name: "Ada", login: "ada" })).toBe("A");
    // No name — the login carries the monogram rather than an empty string.
    expect(userMonogram({ name: null, login: "bob" })).toBe("B");
  });
});

describe("compareUsers", () => {
  it("sinks bots below humans", () => {
    const human = user({ login: "zoe", isBot: false });
    const bot = user({ login: "aaa-bot", isBot: true });
    expect(compareUsers(human, bot)).toBeLessThan(0);
    expect(compareUsers(bot, human)).toBeGreaterThan(0);
  });

  it("orders same-kind users by login, case-insensitively", () => {
    expect(compareUsers(user({ login: "Alice" }), user({ login: "bob" }))).toBeLessThan(0);
  });
});
