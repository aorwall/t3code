import { getCodexConfig } from "@t3tools/moatless-api/generated/agent-harness-access/agent-harness-access";
import { getFeatureFlags } from "@t3tools/moatless-api/generated/feature-flags/feature-flags";
import {
  getGithubConfig,
  listForgejoConnections,
} from "@t3tools/moatless-api/generated/git-host-access/git-host-access";
import { listSecrets } from "@t3tools/moatless-api/generated/secrets/secrets";
import { listTags } from "@t3tools/moatless-api/generated/tags/tags";
import { listUsersHandler } from "@t3tools/moatless-api/generated/users/users";
import type {
  CodexAgentHarnessCredentialStatusResponse,
  FeatureFlagsResponse,
  ForgejoConnectionsResponse,
  GitHubProviderTokenStatusResponse,
  Scope,
  SecretMetadataResponse,
  TagResponse,
  UserListResponse,
} from "@t3tools/moatless-api/generated/model";

import { moatlessQuery } from "../../../moatless/query";

/**
 * Every Moatless REST read this build makes, and the keys writes invalidate.
 *
 * Together in one file because the keys are a namespace, not a per-component
 * detail: `invalidate("account")` reaches every entry under it, and that only
 * holds while they are written next to each other.
 */

/**
 * The secrets at one scope, keyed by scope so the scopes cache and invalidate
 * apart. A function rather than a constant because the key carries the scope;
 * safe to call during render, since the key decides the atom.
 */
export function secretsQuery(scope: Scope) {
  return moatlessQuery<SecretMetadataResponse[]>(`secrets/${scope}`, () => listSecrets({ scope }));
}

/**
 * The viewer's own credentials, both under `account` so the page refreshes as
 * one. The Claude Code token is absent here because it is stored as a
 * user-scoped secret, so it reads and invalidates through `secretsQuery("user")`.
 */
export const githubAccessQuery = moatlessQuery<GitHubProviderTokenStatusResponse>(
  "account/github",
  () => getGithubConfig(),
);

export const codexAccessQuery = moatlessQuery<CodexAgentHarnessCredentialStatusResponse>(
  "account/codex",
  () => getCodexConfig(),
);

/**
 * Every Forgejo instance this deployment registered, each carrying the viewer's
 * own credential for it. One read covers every host, because the backend
 * resolves them from one credential store: a write against any instance
 * refreshes all of them at once.
 */
export const forgejoConnectionsQuery = moatlessQuery<ForgejoConnectionsResponse>(
  "account/forgejo",
  () => listForgejoConnections(),
);

/**
 * What this deployment offers, which decides whether a surface is drawn at all.
 *
 * Its own namespace and never invalidated by a write: the flags come from the
 * backend's own environment, and nothing this client does changes them.
 */
export const featureFlagsQuery = moatlessQuery<FeatureFlagsResponse>("feature-flags", () =>
  getFeatureFlags(),
);

/** Every user in the deployment, for the sidebar's owner filter. */
export const usersQuery = moatlessQuery<UserListResponse>("users", () => listUsersHandler());

/** Every tag in the deployment, for the sidebar's tag filter. */
export const tagsQuery = moatlessQuery<TagResponse[]>("tags", () => listTags());
