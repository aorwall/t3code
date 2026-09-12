import {
  EllipsisIcon,
  GitBranchIcon,
  LoaderIcon,
  PlusIcon,
  StarIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { lazy, Suspense, useState } from "react";

import {
  deleteWorkspace,
  overrideWorkspace,
  removeWorkspaceRepo,
  resetGitWorkspace,
  setWorkspacePrimaryRepo,
  updateWorkspace,
} from "@t3tools/moatless-api/generated/workspaces/workspaces";
import type {
  UpdateWorkspaceRequest,
  WorkspaceResponse,
} from "@t3tools/moatless-api/generated/model";

import { useMoatlessCommand, useMoatlessQuery } from "../../../moatless/query";
import { useMoatlessSession } from "../../../moatless/session";
import { useDirtyForm } from "../../../moatless/useDirtyForm";
import { ProjectFavicon, type ProjectFaviconProject } from "../../ProjectFavicon";
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
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "../../ui/menu";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "../../ui/select";
import { Textarea } from "../../ui/textarea";
import { ITEM_ROW_CLASSNAME, ITEM_ROW_INNER_CLASSNAME } from "../itemRows";
import { SettingResetButton, SettingsRow, SettingsSection } from "../settingsLayout";
import { AddRepositoryDialog } from "./AddRepositoryDialog";
import { SectionEmpty, SectionError, SectionPending } from "./MoatlessSectionState";
import { RepositoryProviderIcon } from "./RepositoryProviderIcon";
import { agentsQuery, repositoriesQuery, usersQuery, workspaceQuery } from "./queries";
import {
  formatSetupCommands,
  parseSetupCommands,
  placementRows,
  workspaceIconOverride,
  workspaceProvenance,
} from "./workspaceDetail";
import { effortLabel, workspaceModelOptions } from "./workspaceTaskDefaults";
import { cn } from "~/lib/utils";

const ProjectIconPickerDialog = lazy(() =>
  import("../ProjectIconPickerDialog").then((module) => ({
    default: module.ProjectIconPickerDialog,
  })),
);

/**
 * The Moatless Workspace behind a project, edited on the project's own settings
 * page.
 *
 * A T3 project here is a projection of a Workspace, so what the project page
 * would otherwise offer — its name, its icon, its default model — is a Workspace
 * column, and `project.meta.update` refuses every one of them by name. These
 * sections are the other side of that refusal: each writes over the Workspace
 * REST API and invalidates `workspaces`, so the page shows the new value without
 * waiting for the projection to push the project again.
 */
export function ProjectWorkspaceSettings({
  workspaceId,
  project,
}: {
  readonly workspaceId: string;
  /** The project record, which draws the icon a workspace with no icon of its own falls back to. */
  readonly project: ProjectFaviconProject;
}) {
  const { data, error, isPending, refresh } = useMoatlessQuery(workspaceQuery(workspaceId));

  if (error) {
    return (
      <SettingsSection id="workspace" title="Workspace">
        <SectionError error={error} label="this workspace" onRetry={refresh} />
      </SettingsSection>
    );
  }
  if (data === null) {
    return (
      <SettingsSection id="workspace" title="Workspace">
        {isPending ? <SectionPending label="this workspace" /> : null}
      </SettingsSection>
    );
  }
  // Keyed so that moving between projects remounts the forms rather than
  // carrying one workspace's unsaved edits into another's fields.
  return <WorkspaceSections key={data.id} workspace={data} project={project} />;
}

/**
 * Removing the project, which is the same act as deleting the workspace.
 *
 * Its own export so that the page can keep it where a danger section belongs —
 * last, below the project's own sections — while the sections above it stay
 * together at the top. Both read one cache entry, so this costs no second
 * request.
 */
export function ProjectWorkspaceDangerSection({
  workspaceId,
  onDeleted,
}: {
  readonly workspaceId: string;
  readonly onDeleted: () => void;
}) {
  const { data } = useMoatlessQuery(workspaceQuery(workspaceId));
  if (data === null) return null;
  return <DangerSection workspace={data} onDeleted={onDeleted} />;
}

function WorkspaceSections({
  workspace,
  project,
}: {
  readonly workspace: WorkspaceResponse;
  readonly project: ProjectFaviconProject;
}) {
  const provenance = workspaceProvenance(workspace);
  const { isAdmin } = useMoatlessSession();

  return (
    <>
      {provenance.isLocked || provenance.isOverridden ? (
        <GitProvenanceNotice workspace={workspace} />
      ) : null}
      <GeneralSection workspace={workspace} project={project} isLocked={provenance.isLocked} />
      <RepositoriesSection workspace={workspace} isLocked={provenance.isLocked} />
      <RunConfigurationSection workspace={workspace} isLocked={provenance.isLocked} />
      <TaskDefaultsSection workspace={workspace} isLocked={provenance.isLocked} />
      {isAdmin ? <IdentitySection workspace={workspace} isLocked={provenance.isLocked} /> : null}
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
  project,
  isLocked,
}: {
  readonly workspace: WorkspaceResponse;
  readonly project: ProjectFaviconProject;
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
      <IconRow workspace={workspace} project={project} isLocked={isLocked} />
      <SettingsRow
        title="Name"
        description="What this project is called in the sidebar and in task lists."
        control={
          <Input
            id="workspace-name"
            size="sm"
            className="w-full sm:w-64"
            aria-label="Workspace name"
            value={form.values.name}
            disabled={isLocked}
            onChange={(event) => form.setField("name", event.currentTarget.value)}
          />
        }
      />
      <SettingsRow
        title="Description"
        description="What this project is for."
        control={
          <Textarea
            id="workspace-description"
            className="w-full sm:w-96"
            aria-label="Workspace description"
            value={form.values.description}
            disabled={isLocked}
            placeholder="What this workspace is for."
            onChange={(event) => form.setField("description", event.currentTarget.value)}
          />
        }
      />
      {save.error ? (
        <p className={cn(ITEM_ROW_CLASSNAME, "py-0 text-[13px] text-destructive-foreground")}>
          {save.error.message}
        </p>
      ) : null}
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

/**
 * The glyph every surface draws beside this project.
 *
 * Saved on selection rather than through the section's save bar: a picker dialog
 * already asks for a decision, and holding the chosen glyph unsaved behind a
 * second click reads as the pick not having registered.
 */
function IconRow({
  workspace,
  project,
  isLocked,
}: {
  readonly workspace: WorkspaceResponse;
  readonly project: ProjectFaviconProject;
  readonly isLocked: boolean;
}) {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const save = useMoatlessCommand<UpdateWorkspaceRequest, WorkspaceResponse>(
    (input) => updateWorkspace(workspace.id, input),
    { invalidates: ["workspaces"] },
  );

  const icon = workspaceIconOverride(workspace.icon);

  return (
    <SettingsRow
      title="Icon"
      description={
        icon?.kind === "lucide"
          ? `${icon.name} · ${icon.color}`
          : icon?.kind === "emoji"
            ? icon.emoji
            : "Automatic"
      }
      status={
        save.error ? (
          <span className="text-destructive-foreground">{save.error.message}</span>
        ) : null
      }
      resetAction={
        icon !== null && !isLocked ? (
          <SettingResetButton
            label="workspace icon"
            tooltip="Reset to the automatic icon"
            disabled={save.isRunning}
            onClick={() => void save.run({ icon: null })}
          />
        ) : null
      }
      control={
        <div className="flex items-center gap-2">
          <ProjectFavicon
            project={{ ...project, faviconPath: null, projectIcon: icon }}
            className="size-6"
          />
          <Button
            size="sm"
            variant="outline"
            disabled={isLocked || save.isRunning}
            onClick={() => setIsPickerOpen(true)}
          >
            Choose icon
          </Button>
          {isPickerOpen ? (
            <Suspense fallback={null}>
              <ProjectIconPickerDialog
                current={icon}
                open
                onOpenChange={setIsPickerOpen}
                onSelect={(selected) => void save.run({ icon: selected })}
              />
            </Suspense>
          ) : null}
        </div>
      }
    />
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
            No repositories yet. A task in this project would start with an empty sandbox.
          </SectionEmpty>
        )
      ) : (
        rows.map((row) => (
          <div key={row.id} className={ITEM_ROW_CLASSNAME}>
            <div className={ITEM_ROW_INNER_CLASSNAME}>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <RepositoryProviderIcon
                    icon={row.icon}
                    className="size-3.5 shrink-0 text-muted-foreground"
                  />
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
      <SettingsRow
        title="Image"
        description="The container image a task in this project starts from."
        control={
          <Input
            id="workspace-docker-image"
            size="sm"
            className="w-full sm:w-64"
            aria-label="Image"
            value={form.values.dockerImage}
            disabled={isLocked}
            placeholder="The deployment default"
            onChange={(event) => form.setField("dockerImage", event.currentTarget.value)}
          />
        }
      />
      <SettingsRow
        title="Setup commands"
        description="One per line, run in the primary repository after the sandbox starts."
        control={
          <Textarea
            id="workspace-setup-commands"
            className="w-full font-mono text-[13px] sm:w-96"
            aria-label="Setup commands"
            value={form.values.setupCommands}
            disabled={isLocked}
            placeholder={"pnpm install\npnpm build"}
            onChange={(event) => form.setField("setupCommands", event.currentTarget.value)}
          />
        }
      />
      {save.error ? (
        <p className={cn(ITEM_ROW_CLASSNAME, "py-0 text-[13px] text-destructive-foreground")}>
          {save.error.message}
        </p>
      ) : null}
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

/**
 * What a new task in this project starts on.
 *
 * Saved on change, like the selects elsewhere on this page. Effort is stored
 * beside the model because it is read in the model's own vocabulary — the words
 * a Claude model takes are not the words a Codex model takes — so choosing a
 * model whose vocabulary excludes the stored effort clears it in the same write.
 */
function TaskDefaultsSection({
  workspace,
  isLocked,
}: {
  readonly workspace: WorkspaceResponse;
  readonly isLocked: boolean;
}) {
  const agents = useMoatlessQuery(agentsQuery);
  const save = useMoatlessCommand<UpdateWorkspaceRequest, WorkspaceResponse>(
    (input) => updateWorkspace(workspace.id, input),
    { invalidates: ["workspaces"] },
  );

  const options = workspaceModelOptions(agents.data?.agents ?? []);
  const model = workspace.defaultModel ?? "";
  const effort = workspace.defaultEffort ?? "";
  const selected = options.find((option) => option.id === model);
  const efforts = selected?.efforts ?? [];
  const error = save.error ?? agents.error;

  const chooseModel = (nextModel: string) => {
    if (nextModel === model) return;
    const nextEfforts = options.find((option) => option.id === nextModel)?.efforts ?? [];
    void save.run({
      defaultModel: nextModel.length > 0 ? nextModel : null,
      ...(nextEfforts.includes(effort) ? {} : { defaultEffort: null }),
    });
  };

  return (
    <SettingsSection id="workspace-task-defaults" title="Task defaults">
      <SettingsRow
        title="Model"
        description={
          model.length > 0
            ? "Every new task in this project starts on this model."
            : "New tasks start on the model their agent picks."
        }
        status={error ? <span className="text-destructive-foreground">{error.message}</span> : null}
        resetAction={
          model.length > 0 && !isLocked ? (
            <SettingResetButton
              label="workspace default model"
              tooltip="Reset to the agent's own model"
              disabled={save.isRunning}
              onClick={() => void save.run({ defaultModel: null, defaultEffort: null })}
            />
          ) : null
        }
        control={
          <Select
            value={model}
            disabled={isLocked || save.isRunning}
            onValueChange={(value) => chooseModel(value ?? "")}
          >
            <SelectTrigger size="sm" aria-label="Default model">
              <SelectValue>
                {selected ? selected.label : model.length > 0 ? model : "The agent's default"}
              </SelectValue>
            </SelectTrigger>
            <SelectPopup align="end" alignItemWithTrigger={false}>
              <SelectItem value="">The agent's default</SelectItem>
              {options.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectPopup>
          </Select>
        }
      />
      <SettingsRow
        title="Effort"
        description={
          efforts.length === 0
            ? "Choose a model to set how hard it thinks."
            : "How hard the model thinks on the first turn of a new task."
        }
        resetAction={
          effort.length > 0 && !isLocked ? (
            <SettingResetButton
              label="workspace default effort"
              tooltip="Reset to the model's own effort"
              disabled={save.isRunning}
              onClick={() => void save.run({ defaultEffort: null })}
            />
          ) : null
        }
        control={
          <Select
            value={effort}
            disabled={isLocked || save.isRunning || efforts.length === 0}
            onValueChange={(value) => {
              const next = value ?? "";
              if (next !== effort) void save.run({ defaultEffort: next.length > 0 ? next : null });
            }}
          >
            <SelectTrigger size="sm" aria-label="Default effort">
              <SelectValue>
                {effort.length > 0 ? effortLabel(effort) : "The model's default"}
              </SelectValue>
            </SelectTrigger>
            <SelectPopup align="end" alignItemWithTrigger={false}>
              <SelectItem value="">The model's default</SelectItem>
              {efforts.map((level) => (
                <SelectItem key={level} value={level}>
                  {effortLabel(level)}
                </SelectItem>
              ))}
            </SelectPopup>
          </Select>
        }
      />
    </SettingsSection>
  );
}

/**
 * The identity every task in this project acts as.
 *
 * This is what makes a GitHub app the credential a sandbox holds: naming an
 * app's bot user here means every task in the workspace mints an installation
 * token through that app instead of using whoever started the task. Commits, pull
 * requests and comments are attributed to the bot for the same reason.
 *
 * Its own section with its own save, deliberately. The backend rejects the field
 * outright for a non-admin — naming an identity decides whose git credential
 * every task reaches a host with — so folding it into the run configuration
 * above would make that section's save fail for everyone who is not an admin,
 * whether or not they touched this field. The section is drawn for admins only
 * for the same reason.
 */
function IdentitySection({
  workspace,
  isLocked,
}: {
  readonly workspace: WorkspaceResponse;
  readonly isLocked: boolean;
}) {
  const users = useMoatlessQuery(usersQuery);
  const form = useDirtyForm({ runAsUserId: workspace.runAsUserId ?? "" });
  const save = useMoatlessCommand<{ runAsUserId: string }, WorkspaceResponse>(
    (values) =>
      // An empty string is what clears the field; omitting it would leave the
      // current identity in place, so "run as whoever started the task" has to
      // be sent rather than left out.
      updateWorkspace(workspace.id, { runAsUserId: values.runAsUserId }),
    { invalidates: ["workspaces"] },
  );

  const rows = users.data?.users ?? [];
  const selected = rows.find((user) => user.id === form.values.runAsUserId);

  return (
    <SettingsSection id="workspace-identity" title="Identity">
      <SettingsRow
        title="Run as"
        description="A GitHub app's bot user makes every task here authenticate as that app's installation."
        status={
          users.error ? (
            <span className="text-destructive-foreground">
              Could not load users: {users.error.message}
            </span>
          ) : save.error ? (
            <span className="text-destructive-foreground">{save.error.message}</span>
          ) : null
        }
        control={
          <Select
            value={form.values.runAsUserId}
            disabled={isLocked}
            onValueChange={(value) => form.setField("runAsUserId", value ?? "")}
          >
            <SelectTrigger size="sm" aria-label="Run as">
              <SelectValue placeholder="The person who started the task">
                {selected ? selected.login : undefined}
              </SelectValue>
            </SelectTrigger>
            <SelectPopup align="end" alignItemWithTrigger={false}>
              <SelectItem value="">The person who started the task</SelectItem>
              {rows.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.login}
                  {user.isBot ? " (bot)" : ""}
                </SelectItem>
              ))}
            </SelectPopup>
          </Select>
        }
      />
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

/**
 * Removing the project removes the workspace, because they are one thing.
 *
 * The project entry this page was opened from is a projection: deleting only it
 * would leave the workspace behind and the entry would come back on the next
 * listing.
 */
function DangerSection({
  workspace,
  onDeleted,
}: {
  readonly workspace: WorkspaceResponse;
  readonly onDeleted: () => void;
}) {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const remove = useMoatlessCommand<void, unknown>(() => deleteWorkspace(workspace.id), {
    invalidates: ["workspaces"],
  });

  return (
    <SettingsSection id="workspace-danger" title="Danger">
      <SettingsRow
        title="Remove project"
        description="Deletes the workspace this project is. Tasks that already ran in it are kept, and the repositories it contains stay registered."
        status={
          remove.error ? (
            <span className="text-destructive-foreground">{remove.error.message}</span>
          ) : null
        }
        control={
          <Button size="sm" variant="destructive-outline" onClick={() => setIsConfirmOpen(true)}>
            Remove project
          </Button>
        }
      />

      <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <AlertDialogPopup>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {workspace.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              New tasks can no longer be started in this project. Loops that target it will stop
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
                  if (result === null) return;
                  setIsConfirmOpen(false);
                  onDeleted();
                });
              }}
            >
              {remove.isRunning ? <LoaderIcon className="animate-spin" /> : null}
              Remove project
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
