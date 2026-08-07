import type {
  ActivationReach,
  ActivationResponse,
  EffectivePluginResponse,
  PluginResponse,
  PluginSkillResponse,
  UserListItem,
} from "@t3tools/moatless-api/generated/model";

import { compareUsers, userDisplayName } from "./userRows";

/**
 * The precedence a skill plugin's controls read from, kept pure and beside a
 * test because it is the part that is easy to get subtly wrong and impossible
 * to prove with a screenshot.
 *
 * Two things this deliberately does NOT do:
 *   - It never recomputes whether a skill is delivered. Off-for-everyone plus
 *     on-for-you does not resolve here; the server resolves it and reports the
 *     result in `/plugins/effective`, and `isSkillDelivered` only reads that.
 *   - It never conflates "no record" with "off". A cleared control inherits the
 *     default; an off record pins it off. Those are `unset` and `off`, and the
 *     difference is the whole point of the two-column design.
 */

/** What one control can say. `unset` means "no record" — inherit the default. */
export const SETTINGS = ["on", "off", "unset"] as const;
export type Setting = (typeof SETTINGS)[number];

const SETTING_LABELS: Record<Setting, string> = {
  on: "On",
  off: "Off",
  unset: "Not set",
};

export function settingLabel(setting: Setting): string {
  return SETTING_LABELS[setting];
}

/**
 * The record in force for one reach and one skill, as a setting. A whole-plugin
 * record omits `skillName` on the wire; an explicit null means the same thing,
 * so both are tolerated. No record at all is `unset` — not `off`.
 */
export function activationSetting(
  records: ActivationResponse[],
  reach: ActivationReach,
  skillName: string | undefined,
): Setting {
  const record = records.find(
    (candidate) => candidate.reach === reach && (candidate.skillName ?? undefined) === skillName,
  );
  if (record === undefined) {
    return "unset";
  }
  return record.enabled ? "on" : "off";
}

/**
 * Whether the viewer actually gets this — the whole plugin, or one skill —
 * taken straight from the effective response the server computed. The plugin as
 * a whole is delivered when it appears in the effective set at all; a skill when
 * the effective set lists its name.
 */
export function isSkillDelivered(
  effective: EffectivePluginResponse | undefined,
  skillName: string | undefined,
): boolean {
  if (effective === undefined) {
    return false;
  }
  if (skillName === undefined) {
    return true;
  }
  return effective.skillNames.includes(skillName);
}

/** One row of the activation table: the whole plugin, or one skill within it. */
export interface SkillRow {
  /** `undefined` is the whole plugin. */
  readonly skillName: string | undefined;
  readonly label: string;
  readonly description: string | undefined;
}

/**
 * The rows for a plugin: the plugin itself first, then each skill it provides.
 */
export function pluginActivationRows(
  pluginName: string,
  skills: PluginSkillResponse[],
): SkillRow[] {
  return [
    { skillName: undefined, label: pluginName, description: "The whole plugin" },
    ...skills.map((skill) => ({
      skillName: skill.name,
      label: skill.name,
      description: skill.description,
    })),
  ];
}

/** Plugins ordered by name, case-insensitively. */
export function comparePlugins(a: PluginResponse, b: PluginResponse): number {
  return a.name.localeCompare(b.name, undefined, { sensitivity: "accent" });
}

/**
 * Whose personal records the override column reads and writes.
 *
 * `userId` is `undefined` for the viewer, and the wire omits the field for
 * them — so the ordinary case needs no id and does not wait on a session read.
 */
export interface ActivationIdentity {
  readonly userId: string | undefined;
  readonly label: string;
}

/** The select's value for the viewer, who has no user id here. */
export const VIEWER_IDENTITY = "viewer";

const VIEWER: ActivationIdentity = { userId: undefined, label: "You" };

/**
 * The identities whose overrides this page can set: the viewer, then every bot
 * user.
 *
 * Bots and nobody else, because a bot is the one identity that cannot set its
 * own. It never signs in, and its tasks — the ones an adapter or a Loop starts
 * on its behalf — resolve their skills against its records, so those records
 * can only be written for it. A human sets their own from their own account.
 */
export function activationIdentities(
  users: ReadonlyArray<UserListItem>,
): ReadonlyArray<ActivationIdentity> {
  return [
    VIEWER,
    ...users
      .filter((user) => user.isBot)
      .sort(compareUsers)
      .map((user) => ({ userId: user.id, label: userDisplayName(user) })),
  ];
}

/** What one identity is called in the select. */
export function identityValue(identity: ActivationIdentity): string {
  return identity.userId ?? VIEWER_IDENTITY;
}

/**
 * The identity a select value names, falling back to the viewer.
 *
 * Total rather than optional: a bot deleted while its page is open leaves a
 * selection naming nobody, and the page then reads the viewer's own records —
 * which is the one answer that is always safe to show.
 */
export function selectedIdentity(
  identities: ReadonlyArray<ActivationIdentity>,
  value: string,
): ActivationIdentity {
  return identities.find((identity) => identityValue(identity) === value) ?? VIEWER;
}
