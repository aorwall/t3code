import { CheckIcon, LoaderIcon, SearchIcon } from "lucide-react";
import { useMemo, useState } from "react";

import { createRepository } from "@t3tools/moatless-api/generated/repositories/repositories";
import { addWorkspaceRepo } from "@t3tools/moatless-api/generated/workspaces/workspaces";
import type { RepositoryResponse, WorkspaceResponse } from "@t3tools/moatless-api/generated/model";

import { useMoatlessCommand, useMoatlessQuery } from "../../../moatless/query";
import { Button } from "../../ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "../../ui/dialog";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { ToggleGroup, ToggleGroupItem } from "../../ui/toggle-group";
import { repositoriesQuery } from "./queries";
import {
  availableRepositories,
  filterRepositories,
  repositoryNameFromRemote,
  shortenRemote,
} from "./workspaceDetail";
import { cn } from "~/lib/utils";

/**
 * Adding a repository to a workspace, in one dialog and up to two writes.
 *
 * The two paths are one dialog rather than two entry points because the person
 * opening it has one intent — "this workspace should also contain that code" —
 * and does not necessarily know whether the deployment has heard of it yet. The
 * Moatless SPA splits this across an admin Repositories page and a workspace
 * page, and that split is the thing this move is trying to remove.
 */
export function AddRepositoryDialog({
  workspace,
  open,
  onOpenChange,
}: {
  readonly workspace: WorkspaceResponse;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add repository</DialogTitle>
          <DialogDescription>
            Repositories in a workspace are checked out side by side for every task that runs in it.
          </DialogDescription>
        </DialogHeader>
        {/* Remounted per opening, so a cancelled attempt leaves no state behind. */}
        {open ? (
          <AddRepositoryForm workspace={workspace} onDone={() => onOpenChange(false)} />
        ) : null}
      </DialogPopup>
    </Dialog>
  );
}

type Mode = "existing" | "register";

function AddRepositoryForm({
  workspace,
  onDone,
}: {
  readonly workspace: WorkspaceResponse;
  readonly onDone: () => void;
}) {
  const catalog = useMoatlessQuery(repositoriesQuery);
  const [mode, setMode] = useState<Mode>("existing");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [remoteUrl, setRemoteUrl] = useState("");
  const [name, setName] = useState("");
  const [isNameEdited, setIsNameEdited] = useState(false);
  /**
   * Set when `POST /repositories` has succeeded and the placement has not.
   *
   * The registration is not rolled back — a Repository is a record in its own
   * right, and deleting one because a second call failed would be destroying
   * something the person asked for. It is named instead, so the retry is
   * understood as a second attempt at one step rather than at both.
   */
  const [registeredId, setRegisteredId] = useState<string | null>(null);

  const register = useMoatlessCommand<
    { readonly name: string; readonly remoteUrl: string; readonly defaultBranch: string | null },
    RepositoryResponse
  >(
    (input) =>
      createRepository({
        kind: "git",
        name: input.name,
        remoteUrl: input.remoteUrl,
        defaultBranch: input.defaultBranch,
      }),
    { invalidates: ["repositories"] },
  );

  const place = useMoatlessCommand<string, WorkspaceResponse>(
    (repositoryId) => addWorkspaceRepo(workspace.id, { repositoryId }),
    { invalidates: ["workspaces"] },
  );

  const available = useMemo(
    () => availableRepositories(workspace, catalog.data ?? []),
    [workspace, catalog.data],
  );
  const matches = useMemo(() => filterRepositories(available, search), [available, search]);

  const trimmedRemote = remoteUrl.trim();
  const trimmedName = name.trim();
  const isRunning = register.isRunning || place.isRunning;
  const canSubmit =
    mode === "existing" ? selectedId !== null : trimmedRemote.length > 0 && trimmedName.length > 0;

  async function submit() {
    if (!canSubmit || isRunning) return;

    let repositoryId = mode === "existing" ? selectedId : registeredId;
    if (repositoryId === null) {
      const created = await register.run({
        name: trimmedName,
        remoteUrl: trimmedRemote,
        defaultBranch: null,
      });
      if (created === null) return;
      repositoryId = created.id;
      setRegisteredId(created.id);
    }

    const placed = await place.run(repositoryId);
    if (placed !== null) onDone();
  }

  return (
    <>
      <DialogPanel className="space-y-4 px-6 pb-5">
        <ToggleGroup
          variant="outline"
          size="sm"
          value={[mode]}
          onValueChange={(next) => {
            const picked = next[0];
            if (picked === "existing" || picked === "register") setMode(picked);
          }}
          className="w-full"
        >
          <ToggleGroupItem value="existing" className="flex-1">
            Registered
          </ToggleGroupItem>
          <ToggleGroupItem value="register" className="flex-1">
            New remote
          </ToggleGroupItem>
        </ToggleGroup>

        {mode === "existing" ? (
          <ExistingRepositoryPicker
            matches={matches}
            search={search}
            onSearchChange={setSearch}
            selectedId={selectedId}
            onSelect={setSelectedId}
            isPending={catalog.isPending && catalog.data === null}
            hasCatalogError={catalog.error !== null}
            isCatalogEmpty={available.length === 0}
          />
        ) : (
          <div className="space-y-3">
            <div>
              <Label htmlFor="add-repository-remote">Remote URL</Label>
              <Input
                id="add-repository-remote"
                value={remoteUrl}
                autoFocus
                placeholder="https://github.com/acme/api"
                onChange={(event) => {
                  const next = event.currentTarget.value;
                  setRemoteUrl(next);
                  // Follows the URL until it is edited by hand, then stops.
                  if (!isNameEdited) setName(repositoryNameFromRemote(next));
                }}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="add-repository-name">Name</Label>
              <Input
                id="add-repository-name"
                value={name}
                placeholder="api"
                onChange={(event) => {
                  setIsNameEdited(true);
                  setName(event.currentTarget.value);
                }}
                className="mt-1.5"
              />
              <p className="mt-1.5 text-[13px] leading-[1.45] text-muted-foreground/80">
                Registering a repository also picks up any workspaces it declares in{" "}
                <code className="rounded bg-accent px-1 py-px text-[12px]">
                  .moatless/workspaces.json
                </code>
                .
              </p>
            </div>
          </div>
        )}

        <SubmitError
          registerError={register.error}
          placeError={place.error}
          registeredId={registeredId}
        />
      </DialogPanel>
      <DialogFooter>
        <Button variant="outline" onClick={onDone} disabled={isRunning}>
          Cancel
        </Button>
        <Button disabled={!canSubmit || isRunning} onClick={() => void submit()}>
          {isRunning ? <LoaderIcon className="animate-spin" /> : null}
          {registeredId === null ? "Add" : "Retry adding"}
        </Button>
      </DialogFooter>
    </>
  );
}

function ExistingRepositoryPicker({
  matches,
  search,
  onSearchChange,
  selectedId,
  onSelect,
  isPending,
  hasCatalogError,
  isCatalogEmpty,
}: {
  readonly matches: ReadonlyArray<RepositoryResponse>;
  readonly search: string;
  readonly onSearchChange: (value: string) => void;
  readonly selectedId: string | null;
  readonly onSelect: (id: string) => void;
  readonly isPending: boolean;
  readonly hasCatalogError: boolean;
  readonly isCatalogEmpty: boolean;
}) {
  if (hasCatalogError) {
    return (
      <p className="py-6 text-center text-[13px] text-muted-foreground">
        Could not load the repository catalog. A new remote can still be registered.
      </p>
    );
  }

  if (isPending) {
    return (
      <p className="flex items-center justify-center gap-2 py-6 text-[13px] text-muted-foreground">
        <LoaderIcon className="size-3.5 animate-spin" aria-hidden />
        Loading repositories…
      </p>
    );
  }

  if (isCatalogEmpty) {
    return (
      <p className="py-6 text-center text-[13px] text-muted-foreground">
        Every registered repository is already in this workspace. Add a new remote instead.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <SearchIcon
          className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          value={search}
          placeholder="Search repositories"
          aria-label="Search repositories"
          onChange={(event) => onSearchChange(event.currentTarget.value)}
          className="pl-7.5"
        />
      </div>
      <div className="max-h-64 overflow-y-auto rounded-lg border border-input">
        {matches.length === 0 ? (
          <p className="px-3 py-6 text-center text-[13px] text-muted-foreground">
            Nothing matches “{search}”.
          </p>
        ) : (
          matches.map((repository) => (
            <button
              key={repository.id}
              type="button"
              onClick={() => onSelect(repository.id)}
              className={cn(
                "flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-accent",
                selectedId === repository.id && "bg-accent",
              )}
            >
              <span className="min-w-0">
                <span className="block truncate text-sm text-foreground">{repository.name}</span>
                {repository.remoteUrl ? (
                  <span className="block truncate text-[13px] text-muted-foreground/80">
                    {shortenRemote(repository.remoteUrl)}
                  </span>
                ) : null}
              </span>
              {selectedId === repository.id ? (
                <CheckIcon className="size-4 shrink-0 text-foreground" aria-hidden />
              ) : null}
            </button>
          ))
        )}
      </div>
    </div>
  );
}

/**
 * What went wrong, said in terms of which of the two writes it was.
 *
 * "Could not add repository" after the registration succeeded is the failure
 * this exists to prevent: the repository now exists, and someone who reads that
 * message as "nothing happened" will register it a second time.
 */
function SubmitError({
  registerError,
  placeError,
  registeredId,
}: {
  readonly registerError: Error | null;
  readonly placeError: Error | null;
  readonly registeredId: string | null;
}) {
  if (registerError) {
    return (
      <p className="text-[13px] text-destructive-foreground">
        Could not register the repository. {registerError.message}
      </p>
    );
  }

  if (!placeError) return null;

  return (
    <p className="text-[13px] text-destructive-foreground">
      {registeredId === null
        ? `Could not add the repository to this workspace. ${placeError.message}`
        : `The repository was registered, but adding it to this workspace failed. ${placeError.message} It is registered either way — retry, or pick it under Registered.`}
    </p>
  );
}
