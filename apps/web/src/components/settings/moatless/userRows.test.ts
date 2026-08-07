import { describe, expect, it } from "vite-plus/test";

import type { UserListItem } from "@t3tools/moatless-api/generated/model";

import { compareUsers, filterUsers, userDisplayName, userMonogram } from "./userRows";

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

describe("filterUsers", () => {
  const rows = [
    user({ id: "u1", login: "ada", name: "Ada Lovelace", email: "ada@example.com" }),
    user({ id: "u2", login: "grace", name: null, email: null }),
    user({ id: "u3", login: "release-bot", name: "Release Bot", isBot: true }),
  ];

  it("returns every user for a blank query", () => {
    expect(filterUsers(rows, "")).toHaveLength(3);
  });

  it("matches a display name", () => {
    expect(filterUsers(rows, "lovelace").map((row) => row.id)).toEqual(["u1"]);
  });

  it("matches a login even when a display name hides it on the row", () => {
    expect(filterUsers(rows, "ada").map((row) => row.id)).toEqual(["u1"]);
  });

  it("matches an email", () => {
    expect(filterUsers(rows, "@example.com").map((row) => row.id)).toEqual(["u1"]);
  });

  it("still finds a user with no name and no email", () => {
    expect(filterUsers(rows, "grace").map((row) => row.id)).toEqual(["u2"]);
  });

  it("matches bots like anyone else — they sink in the sort, they are not hidden", () => {
    expect(filterUsers(rows, "release").map((row) => row.id)).toEqual(["u3"]);
  });
});
