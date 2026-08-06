import type { UserListItem } from "@t3tools/moatless-api/generated/model";

/**
 * What a user row says about itself, worked out away from the component.
 *
 * Pure so the fallbacks are testable: `name` is nullable on the wire, and a row
 * that renders an empty cell where a person's identity belongs — or a monogram
 * built from an empty string — is the failure this exists to prevent.
 */

/** The name to show, falling back to the login when there is no display name. */
export function userDisplayName(user: Pick<UserListItem, "name" | "login">): string {
  const trimmed = user.name?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : user.login;
}

/** A single-letter monogram, always from a non-empty source. */
export function userMonogram(user: Pick<UserListItem, "name" | "login">): string {
  return userDisplayName(user).charAt(0).toUpperCase();
}

/**
 * Sort order for the list: humans before bots, then by login.
 *
 * Bots sink because the list is how an administrator finds a person to change,
 * and a deployment's bot users are noise against that. `login` is compared
 * case-insensitively so `Alice` and `alice` do not split apart.
 */
export function compareUsers(a: UserListItem, b: UserListItem): number {
  if (a.isBot !== b.isBot) return a.isBot ? 1 : -1;
  return a.login.localeCompare(b.login, undefined, { sensitivity: "base" });
}
