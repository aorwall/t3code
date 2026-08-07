import {
  listAdapterConnections,
  listAdapters,
} from "@t3tools/moatless-api/generated/adapters/adapters";
import { getLoop, listLoops } from "@t3tools/moatless-api/generated/loops/loops";
import {
  listEffectivePlugins,
  listPluginActivations,
  listPlugins,
  listPluginSkills,
} from "@t3tools/moatless-api/generated/plugins/plugins";
import {
  adminGetGlobalGithubInstallation,
  adminListAdapterApps,
  adminListGithubApps,
} from "@t3tools/moatless-api/generated/provider-settings/provider-settings";
import { listRepositories } from "@t3tools/moatless-api/generated/repositories/repositories";
import { listSecrets } from "@t3tools/moatless-api/generated/secrets/secrets";
import { listUsersHandler } from "@t3tools/moatless-api/generated/users/users";
import {
  getWorkspace,
  listWorkspaces,
} from "@t3tools/moatless-api/generated/workspaces/workspaces";
import type {
  ActivationResponse,
  AdapterAppsResponse,
  AdapterConnectionResponse,
  EffectivePluginResponse,
  GitHubAppsResponse,
  GitHubInstallationBindingResponse,
  Loop,
  PluginResponse,
  PluginSkillResponse,
  RepositoryResponse,
  Scope,
  SecretMetadataResponse,
  UserListResponse,
  WorkspaceResponse,
} from "@t3tools/moatless-api/generated/model";

import { moatlessQuery } from "../../../moatless/query";

/**
 * Every administration read this build makes, and the keys writes invalidate.
 *
 * Together in one file because the keys are a namespace, not a per-component
 * detail: `invalidate("workspaces")` reaches the list and every detail under it,
 * and that only holds while the two are written next to each other.
 */

export const workspacesQuery = moatlessQuery<WorkspaceResponse[]>("workspaces", () =>
  listWorkspaces(),
);

/**
 * One workspace, keyed below the list so a write to either refreshes both.
 *
 * A function rather than a constant because the key carries the id. Safe to
 * call during render: the key decides the atom, so the same id always yields
 * the same cache entry.
 */
export function workspaceQuery(workspaceId: string) {
  return moatlessQuery<WorkspaceResponse>(`workspaces/${workspaceId}`, () =>
    getWorkspace(workspaceId),
  );
}

/**
 * The repository catalog.
 *
 * Not under `workspaces`, because a Repository outlives the workspaces that
 * place it — registering one and placing it are separate writes, and the first
 * can succeed while the second fails.
 */
export const repositoriesQuery = moatlessQuery<RepositoryResponse[]>("repositories", () =>
  listRepositories(),
);

/**
 * The secrets at one scope, keyed by scope so the two lists cache and
 * invalidate apart. `invalidate("secrets")` still reaches both, because a write
 * — a create, an enable, a delete — can move a row within a scope but the page
 * shows the two scopes side by side and refetching one alone would let them
 * disagree about a key that changed scope in the backend.
 *
 * A function rather than a constant because the key carries the scope; safe to
 * call during render, since the key decides the atom.
 */
export function secretsQuery(scope: Scope) {
  return moatlessQuery<SecretMetadataResponse[]>(`secrets/${scope}`, () => listSecrets({ scope }));
}

/**
 * Every Loop the deployment runs.
 *
 * Its own namespace: a Loop's lifecycle — activate, pause, resume, override,
 * delete — is its own set of writes, none of which touch a workspace or a
 * repository, so `invalidate("loops")` should reach only the Loops pages.
 */
export const loopsQuery = moatlessQuery<Loop[]>("loops", () => listLoops());

/**
 * One Loop, keyed below the list so a write to either refreshes both.
 *
 * A function rather than a constant because the key carries the id. Safe to
 * call during render: the key decides the atom, so the same id always yields the
 * same cache entry.
 */
export function loopQuery(loopId: string) {
  return moatlessQuery<Loop>(`loops/${loopId}`, () => getLoop(loopId));
}

/**
 * Every user in the deployment.
 *
 * There is no single-user read on the wire, so the Users detail page reads this
 * same list and finds its login in it — the two share a key, and a role change
 * refetches both the list and any open detail at once. The Loops page reads it
 * too, so activating a git-declared Loop can name whose identity it runs as.
 *
 * Its own namespace either way: a user write never changes a Loop, so the two
 * invalidations stay separate.
 */
export const usersQuery = moatlessQuery<UserListResponse>("users", () => listUsersHandler());

/**
 * The integration surface's reads, all under `integrations` so any write to a
 * connection, an adapter app or a GitHub app refreshes the page at once.
 *
 * The adapter catalog is the set of kinds a connection can be created for; it is
 * separate configuration from the connections themselves, so it keys on its own
 * name rather than under `integrations`.
 */
export const adaptersQuery = moatlessQuery<string[]>("adapters", () => listAdapters());

export const connectionsQuery = moatlessQuery<AdapterConnectionResponse[]>(
  "integrations/connections",
  () => listAdapterConnections(),
);

export const adapterAppsQuery = moatlessQuery<AdapterAppsResponse>("integrations/apps", () =>
  adminListAdapterApps(),
);

export const githubAppsQuery = moatlessQuery<GitHubAppsResponse>("integrations/github-apps", () =>
  adminListGithubApps(),
);

export const globalGithubInstallationQuery = moatlessQuery<GitHubInstallationBindingResponse>(
  "integrations/github-installation",
  () => adminGetGlobalGithubInstallation(),
);

/**
 * Every plugin registered on this deployment, and every skill each one sources.
 *
 * The plugin list and a plugin's skills are separate reads because a skill is
 * synced from a plugin's git source on demand — `listPluginSkills` is what does
 * the sync — while the plugin list is a cheap catalog. Keying the skills under
 * the plugin means a re-sync of one plugin refreshes only its skills.
 */
export const pluginsQuery = moatlessQuery<PluginResponse[]>("plugins", () => listPlugins());

/**
 * What one person actually gets, once global defaults and their own records are
 * resolved against each other. The viewer, or a bot user whose overrides an
 * administrator is setting. Kept beside the plugin list rather than under it:
 * a single activation write can change what is delivered from more than one
 * plugin, and a caller that has to enumerate which is a caller that misses one.
 *
 * Not under `plugins`, so that re-syncing one plugin's skills does not discard
 * the resolved delivery for all of them. Keyed per person below the same name,
 * so `invalidate("plugins-effective")` still refreshes every one of them.
 */
export function effectivePluginsQuery(userId?: string) {
  return moatlessQuery<EffectivePluginResponse[]>(
    userId === undefined ? "plugins-effective" : `plugins-effective/${userId}`,
    () => listEffectivePlugins(userId === undefined ? undefined : { userId }),
  );
}

/**
 * One plugin's skills, keyed below the plugin list so registering or removing a
 * plugin refreshes both. Reading this also syncs the skills from the plugin's
 * source, which is why it is its own read rather than a field on the list.
 */
export function pluginSkillsQuery(pluginId: string) {
  return moatlessQuery<PluginSkillResponse[]>(`plugins/${pluginId}/skills`, () =>
    listPluginSkills(pluginId),
  );
}

/**
 * The activation records that bear on one person for one plugin: every global
 * record plus theirs. This is the read that lets a control tell "off by
 * default" apart from "I turned my copy off" — the difference between an absent
 * record and an explicit one.
 *
 * `userId` names a bot user whose overrides an administrator is setting; the
 * viewer's own when it is omitted. Each person keys below the plugin's
 * activations, so a write invalidating `plugins/{id}/activations` refreshes the
 * viewer's and every bot's at once — one write can be the last record either
 * side of the pair is reading.
 */
export function pluginActivationsQuery(pluginId: string, userId?: string) {
  const key =
    userId === undefined
      ? `plugins/${pluginId}/activations`
      : `plugins/${pluginId}/activations/${userId}`;
  return moatlessQuery<ActivationResponse[]>(key, () =>
    listPluginActivations(pluginId, userId === undefined ? undefined : { userId }),
  );
}
