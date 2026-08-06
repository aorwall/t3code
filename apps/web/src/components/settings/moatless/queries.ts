import { listRepositories } from "@t3tools/moatless-api/generated/repositories/repositories";
import {
  getWorkspace,
  listWorkspaces,
} from "@t3tools/moatless-api/generated/workspaces/workspaces";
import type { RepositoryResponse, WorkspaceResponse } from "@t3tools/moatless-api/generated/model";

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
