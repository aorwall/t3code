import { Link } from "@tanstack/react-router";
import {
  ArrowLeftIcon,
  EllipsisIcon,
  GitBranchIcon,
  LoaderIcon,
  PlusIcon,
  StarIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { useState } from "react";

import {
  deleteWorkspace,
  overrideWorkspace,
  removeWorkspaceRepo,
  resetGitWorkspace,
  setWorkspacePrimaryRepo,
  updateWorkspace,
} from "@t3tools/moatless-api/generated/workspaces/workspaces";
import type { WorkspaceResponse } from "@t3tools/moatless-api/generated/model";

import { useMoatlessCommand, useMoatlessQuery } from "../../../moatless/query";
import { useDirtyForm } from "../../../moatless/useDirtyForm";
import { Button } from "../../ui/button";
import {
  AlertDialog,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
} from "../../ui/alert-dialog";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "../../ui/menu";
import { Textarea } from "../../ui/textarea";
import { ITEM_ROW_CLASSNAME, ITEM_ROW_INNER_CLASSNAME } from "../itemRows";
import { SettingsPageContainer, SettingsSection } from "../settingsLayout";
import { AddRepositoryDialog } from "./AddRepositoryDialog";
import { SectionEmpty, SectionError, SectionPending } from "./MoatlessSectionState";
import { repositoriesQuery, workspaceQuery } from "./queries";
import {
  formatSetupCommands,
  parseSetupCommands,
  placementRows,
  workspaceProvenance,
} from "./workspaceDetail";
import { cn } from "~/lib/utils";

/**
 * One workspace: what it is called, what code it contains, and how it runs.
 *
 * The page is built from two independent reads — the workspace and the
 * repository catalog — and neither blocks the other. The catalog only supplies
 * names for the placements the workspace already lists, so a slow or forbidden
 * catalog costs a row its display name, not the person their page.
 */
export function WorkspaceDetailPanel({ workspaceId }: { readonly workspaceId: string }) {
  const query = workspaceQuery(workspaceId);
  const { data, error, isPending, refresh } = useMoatlessQuery(query);

  return (
    <SettingsPageContainer>
      <div>
        <Button
          size="xs"
          variant="ghost"
          className="-ml-1.5 text-muted-foreground"
          render={<Link to="/settings/workspaces" />}
        >
          <ArrowLeftIcon />
          Workspaces
        </Button>
      </div>

      {error ? (
        <SettingsSection id="workspace" title="Workspace">
          <SectionError error={error} label="this workspace" onRetry={refresh} />
        </SettingsSection>
      ) : data === null ? (
        <SettingsSection id="workspace" title="Workspace">
          {isPending ? <SectionPending label="this workspace" /> : null}
        </SettingsSection>
      ) : (
        // Keyed so that navigating between workspaces remounts the forms rather
        // than carrying one workspace's unsaved edits into another's fields.
        <WorkspaceDetail key={data.id} workspace={data} />
      )}
    </SettingsPageContainer>
  );
}

function WorkspaceDetail({ workspace }: { readonly workspace: WorkspaceResponse }) {
  const provenance = workspaceProvenance(workspace);

  return (
    <>
      {provenance.isLocked || provenance.isOverridden ? (
        <GitProvenanceNotice workspace={workspace} />
      ) : null}
      <GeneralSection workspace={workspace} isLocked={provenance.isLocked} />
      <RepositoriesSection workspace={workspace} isLocked={provenance.isLocked} />
      <RunConfigurationSection workspace={workspace} isLocked={provenance.isLocked} />
      <DangerSection workspace={workspace} />
    </>
  );
}

/**
 * Where a git-declared workspace says so, and how it stops being one.
 *
 * Overriding is offered as its own action rather than happening the first time
 * a field is saved. A workspace declared in `.moatless/workspaces.json` is
 * shared configuration: whoever edits it here is deciding that this deployment
 * stops tracking the repository's copy, and that is a decision worth one click
 * of its own rather than a consequence of typing.
 */
function GitProvenanceNotice({ workspace }: { readonly workspace: WorkspaceResponse }) {
  const provenance = workspaceProvenance(workspace);
  const override = useMoatlessCommand<void, WorkspaceResponse>(
    () => overrideWorkspace(workspace.id, {}),
    { invalidates: ["workspaces"] },
  );
  const restore = useMoatlessCommand<void, unknown>(() => resetGitWorkspace(workspace.id), {
    invalidates: ["workspaces"],
  });

  const action = provenance.isLocked ? override : restore;

  return (
    <div className="rounded-xl border border-input bg-muted/32 px-4 py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-2">
          <GitBranchIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">
              {provenance.isLocked ? "Declared in git" : "Overridden locally"}
            </p>
            <p className="text-[13px] leading-[1.45] text-muted-foreground/80">
              {provenance.isLocked
                ? `This workspace comes from ${provenance.configPath ?? "a repository"}. Editing it here stops git sync from updating it.`
                : `This workspace came from ${provenance.configPath ?? "a repository"} and was edited here. Restoring discards those edits and takes the configuration from git again.`}
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="shrink-0"
          disabled={action.isRunning}
          onClick={() => void action.run()}
        >
          {action.isRunning ? <LoaderIcon className="animate-spin" /> : null}
          {provenance.isLocked ? "Edit anyway" : "Restore from git"}
        </Button>
      </div>
      {action.error ? (
        <p className="mt-2 text-[13px] text-destructive-foreground">{action.error.message}</p>
      ) : null}
    </div>
  );
}

function GeneralSection({
  workspace,
  isLocked,
}: {
  readonly workspace: WorkspaceResponse;
  readonly isLocked: boolean;
}) {
  const form = useDirtyForm({
    name: workspace.name,
    description: workspace.description ?? "",
  });
  const save = useMoatlessCommand<{ name: string; description: string }, WorkspaceResponse>(
    (values) =>
      updateWorkspace(workspace.id, {
        name: values.name,
        description: values.description.length > 0 ? values.description : null,
      }),
    { invalidates: ["workspaces"] },
  );

  const trimmedName = form.values.name.trim();

  return (
    <SettingsSection id="workspace-general" title="General">
      <div className={cn(ITEM_ROW_CLASSNAME, "space-y-4")}>
        <div>
          <Label htmlFor="workspace-name">Name</Label>
          <Input
            id="workspace-name"
            value={form.values.name}
            disabled={isLocked}
            onChange={(event) => form.setField("name", event.currentTarget.value)}
            className="mt-1.5"
          />
        </div>
        <div>
          <Label htmlFor="workspace-description">Description</Label>
          <Textarea
            id="workspace-description"
            value={form.values.description}
            disabled={isLocked}
            placeholder="What this workspace is for."
            onChange={(event) => form.setField("description", event.currentTarget.value)}
            className="mt-1.5"
          />
        </div>
        {save.error ? (
          <p className="text-[13px] text-destructive-foreground">{save.error.message}</p>
        ) : null}
      </div>
      <SaveBar
        isDirty={form.isDirty && !isLocked}
        isSaving={save.isRunning}
        canSave={trimmedName.length > 0}
        onDiscard={form.reset}
        onSave={() => {
          void save.run({ name: trimmedName, description: form.values.description.trim() });
        }}
      />
    </SettingsSection>
  );
}

function RepositoriesSection({
  workspace,
  isLocked,
}: {
  readonly workspace: WorkspaceResponse;
  readonly isLocked: boolean;
}) {
  const catalog = useMoatlessQuery(repositoriesQuery);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const rows = placementRows(workspace, catalog.data ?? []);

  const setPrimary = useMoatlessCommand<string, WorkspaceResponse>(
    (placementId) => setWorkspacePrimaryRepo(workspace.id, placementId),
    { invalidates: ["workspaces"] },
  );
  const remove = useMoatlessCommand<string, WorkspaceResponse>(
    (placementId) => removeWorkspaceRepo(workspace.id, placementId),
    { invalidates: ["workspaces"] },
  );

  const pendingError = setPrimary.error ?? remove.error;

  return (
    <SettingsSection
      id="workspace-repositories"
      title="Repositories"
      headerAction={
        isLocked ? null : (
          <Button
            size="icon-xs"
            variant="ghost"
            aria-label="Add repository"
            onClick={() => setIsAddOpen(true)}
          >
            <PlusIcon />
          </Button>
        )
      }
    >
      {rows.length === 0 ? (
        catalog.isPending && catalog.data === null && workspace.repos.length > 0 ? (
          <SectionPending label="repositories" />
        ) : (
          <SectionEmpty>
            No repositories yet. A task in this workspace would start with an empty sandbox.
          </SectionEmpty>
        )
      ) : (
        rows.map((row) => (
          <div key={row.id} className={ITEM_ROW_CLASSNAME}>
            <div className={ITEM_ROW_INNER_CLASSNAME}>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-medium text-foreground">{row.name}</span>
                  {row.isPrimary ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-accent px-1.5 py-px text-[10.5px] font-medium text-muted-foreground">
                      <StarIcon className="size-2.5" aria-hidden />
                      primary
                    </span>
                  ) : null}
                  {row.isDangling ? (
                    <span className="inline-flex items-center gap-1 text-[10.5px] font-medium text-destructive-foreground">
                      <TriangleAlertIcon className="size-2.5" aria-hidden />
                      not registered
                    </span>
                  ) : null}
                </div>
                {row.detail ? (
                  <p className="mt-0.5 truncate text-[13px] leading-[1.45] text-muted-foreground/80">
                    {row.detail}
                  </p>
                ) : null}
              </div>
              {isLocked ? null : (
                <Menu>
                  <MenuTrigger
                    render={
                      <Button size="icon-xs" variant="ghost" aria-label={`Actions for ${row.name}`}>
                        <EllipsisIcon />
                      </Button>
                    }
                  />
                  <MenuPopup align="end">
                    {row.isPrimary ? null : (
                      <MenuItem onClick={() => void setPrimary.run(row.id)}>Make primary</MenuItem>
                    )}
                    <MenuItem variant="destructive" onClick={() => void remove.run(row.id)}>
                      Remove from workspace
                    </MenuItem>
                  </MenuPopup>
                </Menu>
              )}
            </div>
          </div>
        ))
      )}

      {pendingError ? (
        <p className={cn(ITEM_ROW_CLASSNAME, "py-0 text-[13px] text-destructive-foreground")}>
          {pendingError.message}
        </p>
      ) : null}

      <AddRepositoryDialog workspace={workspace} open={isAddOpen} onOpenChange={setIsAddOpen} />
    </SettingsSection>
  );
}

function RunConfigurationSection({
  workspace,
  isLocked,
}: {
  readonly workspace: WorkspaceResponse;
  readonly isLocked: boolean;
}) {
  const form = useDirtyForm({
    dockerImage: workspace.dockerImage ?? "",
    setupCommands: formatSetupCommands(workspace.setupCommands),
  });
  const save = useMoatlessCommand<
    { dockerImage: string; setupCommands: string },
    WorkspaceResponse
  >(
    (values) =>
      updateWorkspace(workspace.id, {
        dockerImage: values.dockerImage.length > 0 ? values.dockerImage : null,
        setupCommands: parseSetupCommands(values.setupCommands),
      }),
    { invalidates: ["workspaces"] },
  );

  return (
    <SettingsSection id="workspace-run-configuration" title="Run configuration">
      <div className={cn(ITEM_ROW_CLASSNAME, "space-y-4")}>
        <div>
          <Label htmlFor="workspace-docker-image">Image</Label>
          <Input
            id="workspace-docker-image"
            value={form.values.dockerImage}
            disabled={isLocked}
            placeholder="The deployment default"
            onChange={(event) => form.setField("dockerImage", event.currentTarget.value)}
            className="mt-1.5"
          />
        </div>
        <div>
          <Label htmlFor="workspace-setup-commands">Setup commands</Label>
          <Textarea
            id="workspace-setup-commands"
            value={form.values.setupCommands}
            disabled={isLocked}
            placeholder={"pnpm install\npnpm build"}
            onChange={(event) => form.setField("setupCommands", event.currentTarget.value)}
            className="mt-1.5 font-mono text-[13px]"
          />
          <p className="mt-1.5 text-[13px] leading-[1.45] text-muted-foreground/80">
            One per line, run in the primary repository after the sandbox starts.
          </p>
        </div>
        {save.error ? (
          <p className="text-[13px] text-destructive-foreground">{save.error.message}</p>
        ) : null}
      </div>
      <SaveBar
        isDirty={form.isDirty && !isLocked}
        isSaving={save.isRunning}
        canSave
        onDiscard={form.reset}
        onSave={() => void save.run(form.values)}
      />
    </SettingsSection>
  );
}

function DangerSection({ workspace }: { readonly workspace: WorkspaceResponse }) {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const remove = useMoatlessCommand<void, unknown>(() => deleteWorkspace(workspace.id), {
    invalidates: ["workspaces"],
  });

  return (
    <SettingsSection id="workspace-danger" title="Danger zone">
      <div className={ITEM_ROW_CLASSNAME}>
        <div className={ITEM_ROW_INNER_CLASSNAME}>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">Delete this workspace</p>
            <p className="mt-0.5 text-[13px] leading-[1.45] text-muted-foreground/80">
              Tasks that already ran in it are kept. The repositories it contains stay registered.
            </p>
          </div>
          <Button
            size="sm"
            variant="destructive-outline"
            className="shrink-0"
            onClick={() => setIsConfirmOpen(true)}
          >
            Delete
          </Button>
        </div>
        {remove.error ? (
          <p className="mt-2 text-[13px] text-destructive-foreground">{remove.error.message}</p>
        ) : null}
      </div>

      <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <AlertDialogPopup>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {workspace.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              New tasks can no longer be started in this workspace. Loops that target it will stop
              finding it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setIsConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={remove.isRunning}
              onClick={() => {
                void remove.run().then((result) => {
                  if (result !== null) setIsConfirmOpen(false);
                });
              }}
            >
              {remove.isRunning ? <LoaderIcon className="animate-spin" /> : null}
              Delete workspace
            </Button>
          </AlertDialogFooter>
        </AlertDialogPopup>
      </AlertDialog>
    </SettingsSection>
  );
}

/**
 * Save and discard, shown only once there is something to save.
 *
 * Settings elsewhere in this app commit on change, which is right for a
 * checkbox and wrong for a name: a workspace whose name is written to the
 * server on every keystroke is renamed a dozen times on the way to being
 * renamed once, and every one of those is visible to everyone else.
 */
function SaveBar({
  isDirty,
  isSaving,
  canSave,
  onDiscard,
  onSave,
}: {
  readonly isDirty: boolean;
  readonly isSaving: boolean;
  readonly canSave: boolean;
  readonly onDiscard: () => void;
  readonly onSave: () => void;
}) {
  if (!isDirty) return null;

  return (
    <div className={cn(ITEM_ROW_CLASSNAME, "flex justify-end gap-2 pt-0")}>
      <Button size="sm" variant="ghost" onClick={onDiscard} disabled={isSaving}>
        Discard
      </Button>
      <Button size="sm" onClick={onSave} disabled={isSaving || !canSave}>
        {isSaving ? <LoaderIcon className="animate-spin" /> : null}
        Save
      </Button>
    </div>
  );
}
