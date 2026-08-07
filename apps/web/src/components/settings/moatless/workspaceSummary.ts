import type { RepositoryResponse, WorkspaceResponse } from "@t3tools/moatless-api/generated/model";

import { filterByText } from "./listSearch";
import { repositoryProviderIcon, type RepositoryProviderIcon } from "./repositoryProvider";

/**
 * What a Workspace row says about itself, worked out away from the component.
 *
 * Pure so the wording can be tested against the response shapes the API
 * actually returns — most of `WorkspaceResponse` is nullable, and a row that
 * reads "0 repositories · null" is the failure this exists to prevent.
 */

/** One repository placed in a workspace, as its row names it. */
export interface WorkspaceRepositorySummary {
  readonly repositoryId: string;
  /** The repository's name, or the id when the catalog does not know it. */
  readonly name: string;
  readonly icon: RepositoryProviderIcon;
  readonly isPrimary: boolean;
}

export interface WorkspaceSummary {
  readonly id: string;
  readonly name: string;
  /**
   * The repositories this workspace composes, primary first.
   *
   * Named rather than counted. "2 repositories" is true of most rows on the
   * page and so distinguishes none of them; which two it is, is the whole
   * reason someone is looking at the list.
   */
  readonly repositories: ReadonlyArray<WorkspaceRepositorySummary>;
  /** Said only when there are none, since the names say it otherwise. */
  readonly emptyDetail: string | null;
  /** Declared in a repository, so editing needs an explicit override first. */
  readonly isGitSourced: boolean;
  /** Soft-deleted, kept visible so it can be restored from git. */
  readonly isDeleted: boolean;
}

/**
 * `repositories` is the whole catalog, not this workspace's slice.
 *
 * A placement carries a `repositoryId` and nothing else — no name, no remote,
 * no host — so every readable thing about it comes from this join. A workspace
 * naming a repository the catalog does not have keeps the row and shows the id,
 * because a repository can be deleted while a workspace still places it and the
 * row is where someone would go to fix that.
 */
export function summarizeWorkspace(
  workspace: WorkspaceResponse,
  repositories: ReadonlyArray<RepositoryResponse>,
): WorkspaceSummary {
  const byId = new Map(repositories.map((repository) => [repository.id, repository]));

  const placed = workspace.repos
    .map((placement) => {
      const repository = byId.get(placement.repositoryId);
      return {
        position: placement.position,
        summary: {
          repositoryId: placement.repositoryId,
          name: repository?.name ?? placement.repositoryId,
          icon: repository === undefined ? ("git" as const) : repositoryProviderIcon(repository),
          isPrimary: placement.isPrimary,
        },
      };
    })
    // Primary first, then mount order — the same order the detail page lists
    // them in, so the two pages do not disagree about which one is first.
    .sort((a, b) => {
      if (a.summary.isPrimary !== b.summary.isPrimary) return a.summary.isPrimary ? -1 : 1;
      return a.position - b.position;
    })
    .map((entry) => entry.summary);

  return {
    id: workspace.id,
    name: workspace.name,
    repositories: placed,
    emptyDetail: placed.length === 0 ? "No repositories" : null,
    isGitSourced: workspace.syncedFromGit === true || workspace.source === "git",
    isDeleted: workspace.deleted === true,
  };
}

/**
 * Sort order for the list: live workspaces first, then by name.
 *
 * Soft-deleted rows stay in the list rather than being filtered out — the API
 * returns them deliberately, so that a git-origin tombstone can be restored
 * instead of being silently recreated by the next sync. Sinking them keeps that
 * possible without letting them crowd the top of the page.
 */
export function compareWorkspaces(a: WorkspaceSummary, b: WorkspaceSummary): number {
  if (a.isDeleted !== b.isDeleted) return a.isDeleted ? 1 : -1;
  return a.name.localeCompare(b.name);
}

/**
 * Workspaces matching a search, by name or by a repository they compose.
 *
 * The repository names are searchable because they are on the row and because
 * they are the question this list is usually asked: someone knows which
 * repository they need to change and not which workspace was named for it. The
 * `git` and `deleted` tags are not searchable — they are status, and filtering
 * a list by status is a different control from finding a row by what it is.
 */
export function filterWorkspaces(
  rows: ReadonlyArray<WorkspaceSummary>,
  query: string,
): ReadonlyArray<WorkspaceSummary> {
  return filterByText(rows, query, (row) => [
    row.name,
    ...row.repositories.map((repository) => repository.name),
  ]);
}
