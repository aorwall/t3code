/**
 * EnvironmentFeatures - Which product surfaces an environment's server can serve.
 *
 * A server that does not implement a method fails the call, and the client has
 * no typed error to match it against — the failure arrives as a defect and the
 * person sees "unexpected server error" where they should have seen nothing at
 * all. These flags let a server say up front what it cannot do, so the client
 * leaves those surfaces out instead of offering them and failing.
 *
 * This is a fork-only concern: the upstream server implements every method in
 * the contract, so it has nothing to declare. A hosted backend does not.
 *
 * # Absent means on
 *
 * The inverse of `threadSettlement` and `threadSnooze`, and the distinction is
 * load-bearing. Those flags shipped *with* the feature they name, so a server
 * that does not send them is an older server that cannot do it — absent means
 * off. These flags gate features that already exist on every server, so a
 * server that does not send them is one with nothing to withhold, and absent
 * has to mean on. Every field therefore decodes to `true` when missing, and a
 * server that wants a surface hidden must say `false`.
 *
 * # Grain
 *
 * One flag per surface a person can see, not one per method. A group exists
 * only where a server can genuinely not serve it *and* there is something on
 * screen to leave out. Where a server simply never produces the data — no
 * approvals raised, no checkpoints recorded — the surface is already empty and
 * a flag would gate nothing.
 *
 * @module EnvironmentFeatures
 */
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

const enabledByDefault = Schema.Boolean.pipe(Schema.withDecodingDefault(Effect.succeed(true)));

export const EnvironmentFeatures = Schema.Struct({
  /** `terminal.*`, and the terminal event and metadata subscriptions. */
  terminal: enabledByDefault,
  /** `vcs.*`, `git.*`, and the VCS status subscription. */
  versionControl: enabledByDefault,
  /** Turn and thread diffs, and diff preview. */
  diffs: enabledByDefault,
  /** Adding, removing and cloning projects, and browsing a host for one. */
  projectManagement: enabledByDefault,
  /** Writing and searching workspace files, and opening one in an editor. */
  workspaceWrites: enabledByDefault,
  /** Changing server settings, keybindings, providers, and the server itself. */
  serverAdministration: enabledByDefault,
  /** Trace, process and resource-telemetry diagnostics. */
  diagnostics: enabledByDefault,
  /** Deleting, archiving and unarchiving threads. */
  threadArchival: enabledByDefault,
});
export type EnvironmentFeatures = typeof EnvironmentFeatures.Type;

/** What a server that declares nothing is taken to mean. */
export const ALL_ENVIRONMENT_FEATURES: EnvironmentFeatures = {
  terminal: true,
  versionControl: true,
  diffs: true,
  projectManagement: true,
  workspaceWrites: true,
  serverAdministration: true,
  diagnostics: true,
  threadArchival: true,
};

export type EnvironmentFeatureName = keyof EnvironmentFeatures;

/**
 * What a descriptor's `features` mean, whole.
 *
 * The wire field is optional, so a server may say nothing; the fields inside it
 * are not, because the schema fills each missing one in with `true` on decode.
 * Both cases end here rather than at each call site, so nothing downstream has
 * to remember which way absence points.
 */
export function resolveEnvironmentFeatures(
  features: EnvironmentFeatures | undefined,
): EnvironmentFeatures {
  return features ?? ALL_ENVIRONMENT_FEATURES;
}
