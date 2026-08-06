import type { WorkspaceResponse } from "@t3tools/moatless-api/generated/model";

/**
 * What a Workspace row says about itself, worked out away from the component.
 *
 * Pure so the wording can be tested against the response shapes the API
 * actually returns — most of `WorkspaceResponse` is nullable, and a row that
 * reads "0 repositories · null" is the failure this exists to prevent.
 */

export interface WorkspaceSummary {
  readonly id: string;
  readonly name: string;
  /** "2 repositories · node:22 · 3 servers", already joined. */
  readonly detail: string;
  /** Declared in a repository, so editing needs an explicit override first. */
  readonly isGitSourced: boolean;
  /** Soft-deleted, kept visible so it can be restored from git. */
  readonly isDeleted: boolean;
}

export function summarizeWorkspace(workspace: WorkspaceResponse): WorkspaceSummary {
  const parts: string[] = [repositoryCount(workspace.repos?.length ?? 0)];

  if (workspace.dockerImage) {
    parts.push(workspace.dockerImage);
  }

  const servers = workspace.servers?.length ?? 0;
  if (servers > 0) {
    parts.push(servers === 1 ? "1 server" : `${servers} servers`);
  }

  return {
    id: workspace.id,
    name: workspace.name,
    detail: parts.join(" · "),
    isGitSourced: workspace.syncedFromGit === true || workspace.source === "git",
    isDeleted: workspace.deleted === true,
  };
}

function repositoryCount(count: number): string {
  if (count === 0) return "No repositories";
  if (count === 1) return "1 repository";
  return `${count} repositories`;
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
