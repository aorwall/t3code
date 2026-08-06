import { Link } from "@tanstack/react-router";
import { ArrowLeftIcon, GitBranchIcon, LoaderIcon } from "lucide-react";
import { useState } from "react";

import {
  activateLoop,
  deleteLoop,
  overrideLoop,
  pauseLoop,
  resetGitLoop,
  resumeLoop,
  updateLoop,
} from "@t3tools/moatless-api/generated/loops/loops";
import type { Loop, RoutingMode } from "@t3tools/moatless-api/generated/model";

import { useMoatlessCommand, useMoatlessQuery } from "../../../moatless/query";
import { useDirtyForm } from "../../../moatless/useDirtyForm";
import {
  AlertDialog,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
} from "../../ui/alert-dialog";
import { Badge } from "../../ui/badge";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select";
import { Textarea } from "../../ui/textarea";
import { ITEM_ROW_CLASSNAME, ITEM_ROW_INNER_CLASSNAME } from "../itemRows";
import { SettingsPageContainer, SettingsSection } from "../settingsLayout";
import { SectionError, SectionPending } from "./MoatlessSectionState";
import {
  isScheduleSource,
  isSubscriptionSource,
  loopProvenance,
  loopSourceSummary,
  loopStateLabel,
  routingModeLabel,
} from "./loopRows";
import { loopQuery, repositoriesQuery, usersQuery } from "./queries";
import { cn } from "~/lib/utils";

const ROUTING_MODES: readonly RoutingMode[] = ["by_subject", "ongoing"];

/**
 * One Loop: what it is called, what it runs, where it listens, and whether it
 * is running. Read from a single query; the repository catalog and user
 * directory are read alongside only where a field needs a name for an id, and
 * neither blocks the page.
 */
export function LoopDetailPanel({ loopId }: { readonly loopId: string }) {
  const query = loopQuery(loopId);
  const { data, error, isPending, refresh } = useMoatlessQuery(query);

  return (
    <SettingsPageContainer>
      <div>
        <Button
          size="xs"
          variant="ghost"
          className="-ml-1.5 text-muted-foreground"
          render={<Link to="/settings/loops" />}
        >
          <ArrowLeftIcon />
          Loops
        </Button>
      </div>

      {error ? (
        <SettingsSection id="loop" title="Loop">
          <SectionError error={error} label="this loop" onRetry={refresh} />
        </SettingsSection>
      ) : data === null ? (
        <SettingsSection id="loop" title="Loop">
          {isPending ? <SectionPending label="this loop" /> : null}
        </SettingsSection>
      ) : (
        // Keyed so navigating between loops remounts the forms rather than
        // carrying one loop's unsaved edits into another's fields.
        <LoopDetail key={data.id} loop={data} />
      )}
    </SettingsPageContainer>
  );
}

function LoopDetail({ loop }: { readonly loop: Loop }) {
  const provenance = loopProvenance(loop);

  return (
    <>
      {provenance.isLocked || provenance.isOverridden ? <GitProvenanceNotice loop={loop} /> : null}
      <LifecycleSection loop={loop} isLocked={provenance.isLocked} />
      <GeneralSection loop={loop} isLocked={provenance.isLocked} />
      <ConfigurationSection loop={loop} isLocked={provenance.isLocked} />
      <SourceSection loop={loop} isLocked={provenance.isLocked} />
      <DangerSection loop={loop} />
    </>
  );
}

/**
 * Where a git-declared Loop says so, and how it stops being one. Overriding is
 * its own action, not a side effect of the first save: a Loop declared in
 * `.moatless/loops/…` is shared configuration, and detaching this deployment's
 * copy from git is a decision worth one deliberate click.
 */
function GitProvenanceNotice({ loop }: { readonly loop: Loop }) {
  const provenance = loopProvenance(loop);
  const override = useMoatlessCommand<void, Loop>(() => overrideLoop(loop.id), {
    invalidates: ["loops"],
  });
  const restore = useMoatlessCommand<void, unknown>(() => resetGitLoop(loop.id), {
    invalidates: ["loops"],
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
                ? `This loop comes from ${provenance.configPath ?? "a repository"}. Editing it here stops git sync from updating it.`
                : `This loop came from ${provenance.configPath ?? "a repository"} and was edited here. Restoring discards those edits and takes the configuration from git again.`}
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

/**
 * The Loop's execution state and the one transition available from it: pause a
 * running Loop, resume a paused one, or approve one awaiting approval by naming
 * whose identity it runs as.
 */
function LifecycleSection({ loop, isLocked }: { readonly loop: Loop; readonly isLocked: boolean }) {
  const pause = useMoatlessCommand<void, Loop>(() => pauseLoop(loop.id), {
    invalidates: ["loops"],
  });
  const resume = useMoatlessCommand<void, Loop>(() => resumeLoop(loop.id), {
    invalidates: ["loops"],
  });
  const [isActivateOpen, setIsActivateOpen] = useState(false);

  const stateBadge =
    loop.executionState === "active"
      ? "success"
      : loop.executionState === "awaiting_approval"
        ? "warning"
        : "outline";

  return (
    <SettingsSection id="loop-lifecycle" title="Status">
      <div className={ITEM_ROW_CLASSNAME}>
        <div className={ITEM_ROW_INNER_CLASSNAME}>
          <div className="flex min-w-0 items-center gap-2">
            <Badge variant={stateBadge} size="sm">
              {loop.deleted ? "deleted" : loopStateLabel(loop.executionState)}
            </Badge>
            <span className="truncate text-[13px] text-muted-foreground/80">
              {loopSourceSummary(loop)}
            </span>
          </div>
          {loop.deleted ? null : loop.executionState === "awaiting_approval" ? (
            <Button size="sm" className="shrink-0" onClick={() => setIsActivateOpen(true)}>
              Approve & activate
            </Button>
          ) : loop.executionState === "active" ? (
            <Button
              size="sm"
              variant="outline"
              className="shrink-0"
              disabled={pause.isRunning}
              onClick={() => void pause.run()}
            >
              {pause.isRunning ? <LoaderIcon className="animate-spin" /> : null}
              Pause
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="shrink-0"
              disabled={resume.isRunning || isLocked}
              onClick={() => void resume.run()}
            >
              {resume.isRunning ? <LoaderIcon className="animate-spin" /> : null}
              Resume
            </Button>
          )}
        </div>
        {(pause.error ?? resume.error) ? (
          <p className="mt-2 text-[13px] text-destructive-foreground">
            {(pause.error ?? resume.error)?.message}
          </p>
        ) : null}
      </div>

      <ActivateLoopDialog loop={loop} open={isActivateOpen} onOpenChange={setIsActivateOpen} />
    </SettingsSection>
  );
}

/**
 * Approving a git-declared Loop asks whose identity its tasks run as, because a
 * Loop acts on someone's behalf and an approved one is about to start doing so.
 */
function ActivateLoopDialog({
  loop,
  open,
  onOpenChange,
}: {
  readonly loop: Loop;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}) {
  const users = useMoatlessQuery(usersQuery);
  const [runAsUserId, setRunAsUserId] = useState(loop.config.runAsUserId ?? "");
  const activate = useMoatlessCommand<string, Loop>(
    (userId) => activateLoop(loop.id, { runAsUserId: userId }),
    { invalidates: ["loops"] },
  );

  const humans = (users.data?.users ?? []).filter((user) => !user.isBot);

  async function submit() {
    if (runAsUserId.length === 0) return;
    const result = await activate.run(runAsUserId);
    if (result !== null) onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) activate.reset();
        onOpenChange(next);
      }}
    >
      <DialogPopup className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Activate {loop.name}</DialogTitle>
          <DialogDescription>
            It will start firing on its source and run tasks as the user you pick.
          </DialogDescription>
        </DialogHeader>
        <DialogPanel className="px-6 pb-5">
          <Label>Run as</Label>
          <Select value={runAsUserId} onValueChange={(value) => setRunAsUserId(value ?? "")}>
            <SelectTrigger className="mt-1.5">
              <SelectValue placeholder="Select a user" />
            </SelectTrigger>
            <SelectContent>
              {humans.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.name?.trim() || user.login}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {activate.error ? (
            <p className="mt-2 text-[13px] text-destructive-foreground">{activate.error.message}</p>
          ) : null}
        </DialogPanel>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={runAsUserId.length === 0 || activate.isRunning}
            onClick={() => void submit()}
          >
            {activate.isRunning ? <LoaderIcon className="animate-spin" /> : null}
            Activate
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}

function GeneralSection({ loop, isLocked }: { readonly loop: Loop; readonly isLocked: boolean }) {
  const form = useDirtyForm({ name: loop.name });
  const save = useMoatlessCommand<{ name: string }, Loop>(
    (values) => updateLoop(loop.id, { name: values.name }),
    { invalidates: ["loops"] },
  );

  const trimmedName = form.values.name.trim();

  return (
    <SettingsSection id="loop-general" title="General">
      <div className={cn(ITEM_ROW_CLASSNAME, "space-y-4")}>
        <div>
          <Label htmlFor="loop-name">Name</Label>
          <Input
            id="loop-name"
            value={form.values.name}
            disabled={isLocked}
            onChange={(event) => form.setField("name", event.currentTarget.value)}
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
        onSave={() => void save.run({ name: trimmedName })}
      />
    </SettingsSection>
  );
}

function ConfigurationSection({
  loop,
  isLocked,
}: {
  readonly loop: Loop;
  readonly isLocked: boolean;
}) {
  const catalog = useMoatlessQuery(repositoriesQuery);
  const form = useDirtyForm({
    repositoryId: loop.config.repositoryId,
    routingMode: loop.config.routingMode,
    taskName: loop.config.taskName ?? "",
    agentType: loop.config.agentType,
    prompt: loop.config.prompt ?? "",
  });
  const save = useMoatlessCommand<typeof form.values, Loop>(
    (values) =>
      updateLoop(loop.id, {
        config: {
          repositoryId: values.repositoryId,
          routingMode: values.routingMode,
          taskName: values.taskName.trim() || null,
          agentType: values.agentType.trim() || "claude-code",
          prompt: values.prompt.trim() || null,
        },
      }),
    { invalidates: ["loops"] },
  );

  const repositories = catalog.data ?? [];

  return (
    <SettingsSection id="loop-configuration" title="Configuration">
      <div className={cn(ITEM_ROW_CLASSNAME, "space-y-4")}>
        <div>
          <Label>Repository</Label>
          <Select
            value={form.values.repositoryId}
            onValueChange={(value) => form.setField("repositoryId", value ?? "")}
            disabled={isLocked}
          >
            <SelectTrigger className="mt-1.5">
              <SelectValue placeholder="Select repository">
                {form.values.repositoryId
                  ? (repositories.find((repository) => repository.id === form.values.repositoryId)
                      ?.name ?? form.values.repositoryId)
                  : undefined}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {repositories.map((repository) => (
                <SelectItem key={repository.id} value={repository.id ?? ""}>
                  {repository.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Routing mode</Label>
          <Select
            value={form.values.routingMode}
            onValueChange={(value) =>
              form.setField("routingMode", (value ?? "by_subject") as RoutingMode)
            }
            disabled={isLocked}
          >
            <SelectTrigger className="mt-1.5">
              <SelectValue>{routingModeLabel(form.values.routingMode)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {ROUTING_MODES.map((mode) => (
                <SelectItem key={mode} value={mode}>
                  {routingModeLabel(mode)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="loop-task-name">Task name</Label>
          <Input
            id="loop-task-name"
            value={form.values.taskName}
            disabled={isLocked}
            placeholder="Optional task title"
            onChange={(event) => form.setField("taskName", event.currentTarget.value)}
            className="mt-1.5"
          />
        </div>
        <div>
          <Label htmlFor="loop-agent-type">Agent type</Label>
          <Input
            id="loop-agent-type"
            value={form.values.agentType}
            disabled={isLocked}
            onChange={(event) => form.setField("agentType", event.currentTarget.value)}
            className="mt-1.5"
          />
        </div>
        <div>
          <Label htmlFor="loop-prompt">Prompt</Label>
          <Textarea
            id="loop-prompt"
            value={form.values.prompt}
            disabled={isLocked}
            placeholder="What each task this loop starts should do."
            onChange={(event) => form.setField("prompt", event.currentTarget.value)}
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
        canSave={form.values.repositoryId.length > 0}
        onDiscard={form.reset}
        onSave={() => void save.run(form.values)}
      />
    </SettingsSection>
  );
}

/**
 * The source, editable where it is a schedule and read-only where it is not. A
 * subscription binds to a live integration connection whose editing belongs on
 * the Integrations surface; here it is shown so the page is complete.
 */
function SourceSection({ loop, isLocked }: { readonly loop: Loop; readonly isLocked: boolean }) {
  const source = loop.source;

  if (isScheduleSource(source)) {
    return <ScheduleSection loop={loop} isLocked={isLocked} />;
  }

  return (
    <SettingsSection id="loop-source" title="Source">
      <div className={cn(ITEM_ROW_CLASSNAME, "space-y-2")}>
        {isSubscriptionSource(source) ? (
          <>
            <ReadOnlyRow label="Adapter" value={loopSourceSummary(loop)} />
            <ReadOnlyRow label="Matcher" value={source.sourceMatcher} />
            <ReadOnlyRow label="Direct send" value={source.allowDirectSend ? "On" : "Off"} />
            <ReadOnlyRow label="Notify on success" value={source.notifyOnSuccess ? "On" : "Off"} />
            <p className="pt-1 text-[13px] leading-[1.45] text-muted-foreground/80">
              Subscriptions are bound to an integration connection and edited from Integrations.
            </p>
          </>
        ) : (
          <p className="text-[13px] leading-[1.45] text-muted-foreground/80">
            This loop has no source. It only runs when started by hand.
          </p>
        )}
      </div>
    </SettingsSection>
  );
}

function ScheduleSection({ loop, isLocked }: { readonly loop: Loop; readonly isLocked: boolean }) {
  const source = loop.source;
  const schedule = isScheduleSource(source) ? source : null;
  const form = useDirtyForm({
    cronExpression: schedule?.cronExpression ?? "",
    timezone: schedule?.timezone ?? "UTC",
    messageTemplate: schedule?.messageTemplate ?? "",
  });
  const save = useMoatlessCommand<typeof form.values, Loop>(
    (values) =>
      updateLoop(loop.id, {
        source: {
          cronExpression: values.cronExpression.trim(),
          timezone: values.timezone.trim() || "UTC",
          messageTemplate: values.messageTemplate,
        },
      }),
    { invalidates: ["loops"] },
  );

  const ready =
    form.values.cronExpression.trim().length > 0 && form.values.messageTemplate.trim().length > 0;

  return (
    <SettingsSection id="loop-source" title="Schedule">
      <div className={cn(ITEM_ROW_CLASSNAME, "space-y-4")}>
        <div>
          <Label htmlFor="loop-cron">Cron expression</Label>
          <Input
            id="loop-cron"
            value={form.values.cronExpression}
            disabled={isLocked}
            onChange={(event) => form.setField("cronExpression", event.currentTarget.value)}
            className="mt-1.5 font-mono text-[13px]"
          />
        </div>
        <div>
          <Label htmlFor="loop-timezone">Timezone</Label>
          <Input
            id="loop-timezone"
            value={form.values.timezone}
            disabled={isLocked}
            onChange={(event) => form.setField("timezone", event.currentTarget.value)}
            className="mt-1.5"
          />
        </div>
        <div>
          <Label htmlFor="loop-template">Message template</Label>
          <Textarea
            id="loop-template"
            value={form.values.messageTemplate}
            disabled={isLocked}
            onChange={(event) => form.setField("messageTemplate", event.currentTarget.value)}
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
        canSave={ready}
        onDiscard={form.reset}
        onSave={() => void save.run(form.values)}
      />
    </SettingsSection>
  );
}

function ReadOnlyRow({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[13px] text-muted-foreground/80">{label}</span>
      <span className="min-w-0 truncate text-[13px] font-medium text-foreground">{value}</span>
    </div>
  );
}

function DangerSection({ loop }: { readonly loop: Loop }) {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const remove = useMoatlessCommand<void, unknown>(() => deleteLoop(loop.id), {
    invalidates: ["loops"],
  });

  if (loop.deleted) return null;

  return (
    <SettingsSection id="loop-danger" title="Danger zone">
      <div className={ITEM_ROW_CLASSNAME}>
        <div className={ITEM_ROW_INNER_CLASSNAME}>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">Delete this loop</p>
            <p className="mt-0.5 text-[13px] leading-[1.45] text-muted-foreground/80">
              It stops firing. Tasks it already started are kept.
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
            <AlertDialogTitle>Delete {loop.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This loop will stop firing on its source. Tasks it already started stay.
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
              Delete loop
            </Button>
          </AlertDialogFooter>
        </AlertDialogPopup>
      </AlertDialog>
    </SettingsSection>
  );
}

/**
 * Save and discard, shown only once there is something to save. Matches the
 * workspace forms: settings that name a real, shared thing commit on save, not
 * on every keystroke.
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
