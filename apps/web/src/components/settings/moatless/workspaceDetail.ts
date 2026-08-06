import type {
  RepositoryResponse,
  WorkspaceRepoResponse,
  WorkspaceResponse,
} from "@t3tools/moatless-api/generated/model";

/**
 * The reasoning behind the Workspace detail page, kept out of the component.
 *
 * The page's hard parts are all decisions about text and ordering made from
 * nullable response fields — which repository a placement names, whether the
 * workspace may be edited at all, what a pasted remote is called. Each is a
 * sentence a person reads and acts on, so each is worth a test that does not
 * need a browser.
 */

/**
 * Whether a workspace may be edited, and why not when it may not.
 *
 * A git-synced workspace is not read-only because writing is unsupported — the
 * API accepts a `PATCH` — but because the next sync would discard the write.
 * Overriding is the write that makes the workspace stop being git's, and the
 * page asks for it explicitly rather than performing it as a side effect of
 * someone typing in a field.
 */
export interface WorkspaceProvenance {
  /** Git declares this workspace; fields are read-only until it is overridden. */
  readonly isLocked: boolean;
  /** Git declared it once and someone overrode it; it can be restored. */
  readonly isOverridden: boolean;
  /** `.moatless/workspaces.json`, when the API reported one. */
  readonly configPath: string | null;
  /** The repository whose tree declared it, when the API reported one. */
  readonly sourceRepositoryId: string | null;
}

export function workspaceProvenance(workspace: WorkspaceResponse): WorkspaceProvenance {
  const fromGit = workspace.syncedFromGit === true || workspace.source === "git";
  // Provenance survives an override deliberately, so "was declared in git and
  // is not now" is exactly the state a restore is offered from.
  const hasGitOrigin =
    typeof workspace.sourceRepositoryId === "string" ||
    typeof workspace.sourceConfigPath === "string";

  return {
    isLocked: fromGit,
    isOverridden: !fromGit && hasGitOrigin,
    configPath: workspace.sourceConfigPath ?? null,
    sourceRepositoryId: workspace.sourceRepositoryId ?? null,
  };
}

/** One repository placement, with everything the row needs already resolved. */
export interface PlacementRow {
  readonly id: string;
  readonly repositoryId: string;
  /** The repository's name, or the id when the catalog does not know it. */
  readonly name: string;
  /** Remote, branch and mount, joined; empty when none of them is known. */
  readonly detail: string;
  readonly isPrimary: boolean;
  /**
   * The catalog has no record of `repositoryId`.
   *
   * Reachable: a repository can be deleted while a workspace still places it,
   * and the placement is what a person needs to see in order to remove it.
   */
  readonly isDangling: boolean;
}

/**
 * Placements in the order they are mounted, primary first.
 *
 * Primary first because it is the repository a task's commands run in, and
 * position after it because that is the order the sandbox mounts them — the
 * page should not invent a third order.
 */
export function placementRows(
  workspace: WorkspaceResponse,
  repositories: ReadonlyArray<RepositoryResponse>,
): ReadonlyArray<PlacementRow> {
  const byId = new Map(repositories.map((repository) => [repository.id, repository]));

  return workspace.repos
    .map((placement) => ({
      position: placement.position,
      row: placementRow(placement, byId.get(placement.repositoryId)),
    }))
    .sort((a, b) => {
      if (a.row.isPrimary !== b.row.isPrimary) return a.row.isPrimary ? -1 : 1;
      return a.position - b.position;
    })
    .map((entry) => entry.row);
}

function placementRow(
  placement: WorkspaceRepoResponse,
  repository: RepositoryResponse | undefined,
): PlacementRow {
  const parts: string[] = [];

  const remote = repository?.remoteUrl;
  if (remote) parts.push(shortenRemote(remote));

  // Only an explicit override is worth the space. A placement with no branch
  // uses the repository's default, which is already the reader's assumption.
  if (placement.branch) parts.push(placement.branch);
  if (placement.mountName) parts.push(`mounted at ${placement.mountName}`);

  return {
    id: placement.id,
    repositoryId: placement.repositoryId,
    name: repository?.name ?? placement.repositoryId,
    detail: parts.join(" · "),
    isPrimary: placement.isPrimary,
    isDangling: repository === undefined,
  };
}

/** `https://github.com/acme/api.git` reads as `github.com/acme/api`. */
export function shortenRemote(remoteUrl: string): string {
  const withoutSuffix = remoteUrl.trim().replace(/\.git$/, "");
  const scp = /^[^/]+@([^:]+):(.+)$/.exec(withoutSuffix);
  if (scp) return `${scp[1]}/${scp[2]}`;
  return withoutSuffix.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "").replace(/\/+$/, "");
}

/**
 * The name to register a pasted remote under.
 *
 * `POST /repositories` requires a name and the person pasting a URL has not
 * been asked for one, so the last path segment is offered as a starting point.
 * It is put in an editable field rather than sent silently — two repositories
 * called `api` on different hosts is a real thing to want to fix before saving.
 */
export function repositoryNameFromRemote(remoteUrl: string): string {
  const path = shortenRemote(remoteUrl);
  const segments = path.split("/").filter((segment) => segment.length > 0);
  return segments[segments.length - 1] ?? "";
}

/**
 * Repositories that are not already placed in this workspace.
 *
 * Filtered rather than shown as disabled rows: the same repository can be
 * placed twice in principle (under different mount names), but the page does
 * not offer that, and a row that cannot be picked is a question with no answer.
 */
export function availableRepositories(
  workspace: WorkspaceResponse,
  repositories: ReadonlyArray<RepositoryResponse>,
): ReadonlyArray<RepositoryResponse> {
  const placed = new Set(workspace.repos.map((placement) => placement.repositoryId));
  return repositories
    .filter((repository) => !placed.has(repository.id))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Match on name and remote, so pasting part of a URL finds the repository. */
export function filterRepositories(
  repositories: ReadonlyArray<RepositoryResponse>,
  query: string,
): ReadonlyArray<RepositoryResponse> {
  const needle = query.trim().toLocaleLowerCase();
  if (needle.length === 0) return repositories;
  return repositories.filter(
    (repository) =>
      repository.name.toLocaleLowerCase().includes(needle) ||
      (repository.remoteUrl ?? "").toLocaleLowerCase().includes(needle),
  );
}

/**
 * Setup commands are one per line in the field and an array on the wire.
 *
 * Blank lines are dropped on the way out, so that trailing newlines while
 * typing do not become empty commands the sandbox tries to run.
 */
export function parseSetupCommands(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export function formatSetupCommands(commands: ReadonlyArray<string> | null | undefined): string {
  return (commands ?? []).join("\n");
}
