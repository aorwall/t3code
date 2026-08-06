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
import { workspacesQuery } from "./queries";
import { compareWorkspaces, summarizeWorkspace } from "./workspaceSummary";
import { cn } from "~/lib/utils";

export function WorkspacesPanel() {
  const { data, error, isPending, refresh } = useMoatlessQuery(workspacesQuery);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const rows = useMemo(() => (data ?? []).map(summarizeWorkspace).sort(compareWorkspaces), [data]);

  return (
    <SettingsPageContainer>
      <SettingsSection
        {...searchableSetting("workspaces")}
        headerAction={
          <Button
            size="icon-xs"
            variant="ghost"
            aria-label="Add workspace"
            onClick={() => setIsCreateOpen(true)}
          >
            <PlusIcon />
          </Button>
        }
      >
        {error ? (
          <SectionError error={error} label="workspaces" onRetry={refresh} />
        ) : isPending && data === null ? (
          <SectionPending label="workspaces" />
        ) : rows.length === 0 ? (
          <SectionEmpty>
            No workspaces yet. A workspace composes one or more repositories with the configuration
            a task runs against.
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
                  <p className="mt-0.5 truncate text-[13px] leading-[1.45] text-muted-foreground/80">
                    {row.detail}
                  </p>
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
