import { Link } from "@tanstack/react-router";
import { ChevronRightIcon, LoaderIcon, PlusIcon } from "lucide-react";
import { useMemo, useState } from "react";

import { createWorkspace } from "@t3tools/moatless-api/generated/workspaces/workspaces";
import type { WorkspaceResponse } from "@t3tools/moatless-api/generated/model";

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
import { ITEM_ROW_CLASSNAME, ITEM_ROW_INNER_CLASSNAME } from "../itemRows";
import { SettingsPageContainer, SettingsSection } from "../settingsLayout";
import { searchableSetting } from "../settingsSearch";
import { SectionEmpty, SectionError, SectionPending } from "./MoatlessSectionState";
import { SectionCount, SectionSearch } from "./SectionSearch";
import { repositoriesQuery, workspacesQuery } from "./queries";
import { RepositoryProviderIcon } from "./RepositoryProviderIcon";
import {
  compareWorkspaces,
  filterWorkspaces,
  summarizeWorkspace,
  type WorkspaceSummary,
} from "./workspaceSummary";
import { cn } from "~/lib/utils";

export function WorkspacesPanel() {
  const { data, error, refresh } = useMoatlessQuery(workspacesQuery);
  const repositories = useMoatlessQuery(repositoriesQuery);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [query, setQuery] = useState("");

  // Both reads, because a placement carries only a repository id: without the
  // catalog every row would name its repositories by id. A catalog that failed
  // is not worth blocking the page for, though — the ids still identify them,
  // and the workspaces themselves are what someone came here for.
  const isPending = data === null || (repositories.data === null && repositories.error === null);

  const all = useMemo(
    () =>
      (data ?? [])
        .map((workspace) => summarizeWorkspace(workspace, repositories.data ?? []))
        .sort(compareWorkspaces),
    [data, repositories.data],
  );
  const rows = useMemo(() => filterWorkspaces(all, query), [all, query]);

  return (
    <SettingsPageContainer>
      <SettingsSection
        {...searchableSetting("workspaces")}
        headerAction={
          <div className="flex items-center gap-1.5">
            <SectionSearch
              query={query}
              onChange={setQuery}
              label="workspaces"
              count={<SectionCount count={all.length} singular="workspace" plural="workspaces" />}
            />
            <Button
              size="icon-xs"
              variant="ghost"
              aria-label="Add workspace"
              onClick={() => setIsCreateOpen(true)}
            >
              <PlusIcon />
            </Button>
          </div>
        }
      >
        {error ? (
          <SectionError error={error} label="workspaces" onRetry={refresh} />
        ) : isPending ? (
          <SectionPending label="workspaces" />
        ) : rows.length === 0 ? (
          <SectionEmpty>
            {all.length === 0 ? (
              <>
                No workspaces yet. A workspace composes one or more repositories with the
                configuration a task runs against.
              </>
            ) : (
              <>No workspace matches “{query}”, by name or by a repository it composes.</>
            )}
          </SectionEmpty>
        ) : (
          rows.map((row) => (
            <Link
              key={row.id}
              to="/settings/workspaces/$workspaceId"
              params={{ workspaceId: row.id }}
              className={cn(
                ITEM_ROW_CLASSNAME,
                "block hover:bg-accent",
                row.isDeleted && "opacity-64",
              )}
            >
              <div className={ITEM_ROW_INNER_CLASSNAME}>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-medium text-foreground">{row.name}</span>
                    {row.isGitSourced ? <RowTag>git</RowTag> : null}
                    {row.isDeleted ? <RowTag>deleted</RowTag> : null}
                  </div>
                  <RepositoryList row={row} />
                </div>
                <ChevronRightIcon
                  className="size-4 shrink-0 self-center text-muted-foreground/60"
                  aria-hidden
                />
              </div>
            </Link>
          ))
        )}
      </SettingsSection>

      <CreateWorkspaceDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />
    </SettingsPageContainer>
  );
}

/**
 * The repositories a workspace composes, named, under its own name.
 *
 * Wrapping rather than truncating to one line: a workspace with four
 * repositories is exactly the one whose composition someone needs to read, and
 * it is the one a single line would hide. Each name truncates on its own so one
 * long name cannot push the others out.
 */
function RepositoryList({ row }: { readonly row: WorkspaceSummary }) {
  if (row.emptyDetail !== null) {
    return (
      <p className="mt-0.5 text-[13px] leading-[1.45] text-muted-foreground/80">
        {row.emptyDetail}
      </p>
    );
  }

  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
      {row.repositories.map((repository) => (
        <span
          key={repository.repositoryId}
          className="flex min-w-0 items-center gap-1.5 text-[13px] leading-[1.45] text-muted-foreground/80"
        >
          <RepositoryProviderIcon icon={repository.icon} className="size-3.5 shrink-0" />
          <span className="truncate">{repository.name}</span>
        </span>
      ))}
    </div>
  );
}

function RowTag({ children }: { readonly children: string }) {
  return (
    <span className="rounded-full bg-accent px-1.5 py-px text-[10.5px] font-medium text-muted-foreground">
      {children}
    </span>
  );
}

/**
 * Creating a Workspace asks for a name and nothing else.
 *
 * Everything a workspace needs to run — repositories, image, setup, servers —
 * is edited on its own page, where there is room for it. Asking for all of it
 * up front would put a page's worth of fields in a dialog, and every one of
 * them can be changed afterwards.
 */
function CreateWorkspaceDialog({
  open,
  onOpenChange,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}) {
  const [name, setName] = useState("");
  const create = useMoatlessCommand<string, WorkspaceResponse>(
    (workspaceName) => createWorkspace({ name: workspaceName }),
    { invalidates: ["workspaces"] },
  );

  const trimmed = name.trim();

  async function submit() {
    if (trimmed.length === 0) return;
    const created = await create.run(trimmed);
    if (created !== null) {
      setName("");
      onOpenChange(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          create.reset();
          setName("");
        }
        onOpenChange(next);
      }}
    >
      <DialogPopup className="max-w-sm">
        <DialogHeader>
          <DialogTitle>New workspace</DialogTitle>
          <DialogDescription>
            Add repositories and run configuration once it exists.
          </DialogDescription>
        </DialogHeader>
        <DialogPanel className="px-6 pb-5">
          <Label htmlFor="new-workspace-name">Name</Label>
          <Input
            id="new-workspace-name"
            value={name}
            autoFocus
            placeholder="my-service"
            onChange={(event) => setName(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void submit();
              }
            }}
            className="mt-1.5"
          />
          {create.error ? (
            <p className="mt-2 text-[13px] text-destructive-foreground">{create.error.message}</p>
          ) : null}
        </DialogPanel>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={trimmed.length === 0 || create.isRunning} onClick={() => void submit()}>
            {create.isRunning ? <LoaderIcon className="animate-spin" /> : null}
            Create
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
