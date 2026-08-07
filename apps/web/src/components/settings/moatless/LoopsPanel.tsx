import { Link } from "@tanstack/react-router";
import { ChevronRightIcon, LoaderIcon, PlusIcon } from "lucide-react";
import { useMemo, useState } from "react";

import { createLoop } from "@t3tools/moatless-api/generated/loops/loops";
import type {
  CreateLoopRequest,
  CreateLoopSource,
  Loop,
  LoopKind,
  RepositoryResponse,
} from "@t3tools/moatless-api/generated/model";

import { useMoatlessCommand, useMoatlessQuery } from "../../../moatless/query";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select";
import { Textarea } from "../../ui/textarea";
import { ITEM_ROW_CLASSNAME, ITEM_ROW_INNER_CLASSNAME } from "../itemRows";
import { SettingsPageContainer, SettingsSection } from "../settingsLayout";
import { searchableSetting } from "../settingsSearch";
import { compareLoops, filterLoops, loopSourceSummary, loopStateLabel } from "./loopRows";
import { SectionEmpty, SectionError, SectionPending } from "./MoatlessSectionState";
import { loopsQuery, repositoriesQuery } from "./queries";
import { SectionCount, SectionSearch } from "./SectionSearch";
import { cn } from "~/lib/utils";

export function LoopsPanel() {
  const { data, error, isPending, refresh } = useMoatlessQuery(loopsQuery);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [query, setQuery] = useState("");

  const all = useMemo(() => [...(data ?? [])].sort(compareLoops), [data]);
  const rows = useMemo(() => filterLoops(all, query), [all, query]);

  return (
    <SettingsPageContainer>
      <SettingsSection
        {...searchableSetting("loops")}
        headerAction={
          <div className="flex items-center gap-1.5">
            <SectionSearch
              query={query}
              onChange={setQuery}
              label="loops"
              count={<SectionCount count={all.length} singular="loop" plural="loops" />}
            />
            <Button
              size="icon-xs"
              variant="ghost"
              aria-label="Add loop"
              onClick={() => setIsCreateOpen(true)}
            >
              <PlusIcon />
            </Button>
          </div>
        }
      >
        {error ? (
          <SectionError error={error} label="loops" onRetry={refresh} />
        ) : data === null ? (
          isPending ? (
            <SectionPending label="loops" />
          ) : null
        ) : rows.length === 0 ? (
          <SectionEmpty>
            {all.length === 0 ? (
              <>
                No loops yet. A loop watches a source — a schedule or an integration event — and
                starts a task when it fires.
              </>
            ) : (
              <>No loop matches “{query}”, by name or by where it listens.</>
            )}
          </SectionEmpty>
        ) : (
          rows.map((loop) => <LoopRow key={loop.id} loop={loop} />)
        )}
      </SettingsSection>

      <CreateLoopDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />
    </SettingsPageContainer>
  );
}

function LoopRow({ loop }: { readonly loop: Loop }) {
  return (
    <Link
      to="/settings/loops/$loopId"
      params={{ loopId: loop.id }}
      className={cn(ITEM_ROW_CLASSNAME, "block hover:bg-accent", loop.deleted && "opacity-64")}
    >
      <div className={ITEM_ROW_INNER_CLASSNAME}>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                "truncate text-sm font-medium",
                loop.active ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {loop.name}
            </span>
            <Badge variant="outline" size="sm">
              {loop.deleted ? "deleted" : loopStateLabel(loop.executionState)}
            </Badge>
            {loop.syncedFromGit ? (
              <Badge variant="outline" size="sm">
                git
              </Badge>
            ) : null}
          </div>
          <p className="mt-0.5 truncate text-[13px] leading-[1.45] text-muted-foreground/80">
            {loopSourceSummary(loop)}
          </p>
        </div>
        <ChevronRightIcon
          className="size-4 shrink-0 self-center text-muted-foreground/60"
          aria-hidden
        />
      </div>
    </Link>
  );
}

const CREATE_KINDS: readonly {
  readonly value: Extract<LoopKind, "schedule" | "manual">;
  readonly label: string;
}[] = [
  { value: "schedule", label: "Schedule" },
  { value: "manual", label: "Manual" },
];

/**
 * Creating a Loop asks for the least that makes a valid one: a name, the
 * repository its tasks run in, and — for a schedule — when it fires. Everything
 * else, including routing, prompt and lifecycle, is edited on the Loop's page.
 *
 * Subscription loops are not created here: they need a live integration
 * connection to bind to, which is the Integrations surface's job. This dialog
 * covers the two kinds that stand on their own.
 */
function CreateLoopDialog({
  open,
  onOpenChange,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}) {
  const repositories = useMoatlessQuery(repositoriesQuery);
  const [kind, setKind] = useState<Extract<LoopKind, "schedule" | "manual">>("schedule");
  const [name, setName] = useState("");
  const [repositoryId, setRepositoryId] = useState("");
  const [cronExpression, setCronExpression] = useState("");
  const [messageTemplate, setMessageTemplate] = useState("");

  const create = useMoatlessCommand<CreateLoopRequest, Loop>((request) => createLoop(request), {
    invalidates: ["loops"],
  });

  const trimmedName = name.trim();
  const scheduleReady =
    kind !== "schedule" || (cronExpression.trim().length > 0 && messageTemplate.trim().length > 0);
  const canSubmit = trimmedName.length > 0 && repositoryId.length > 0 && scheduleReady;

  function resetFields() {
    setKind("schedule");
    setName("");
    setRepositoryId("");
    setCronExpression("");
    setMessageTemplate("");
    create.reset();
  }

  async function submit() {
    if (!canSubmit) return;
    const source: CreateLoopSource =
      kind === "schedule"
        ? {
            cronExpression: cronExpression.trim(),
            messageTemplate: messageTemplate.trim(),
            timezone: "UTC",
          }
        : {};
    const created = await create.run({
      name: trimmedName,
      kind,
      active: false,
      config: { repositoryId, routingMode: "by_subject", agentType: "claude-code", tagIds: [] },
      source,
    });
    if (created !== null) {
      resetFields();
      onOpenChange(false);
    }
  }

  const catalog: RepositoryResponse[] = repositories.data ?? [];

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) resetFields();
        onOpenChange(next);
      }}
    >
      <DialogPopup className="max-w-md">
        <DialogHeader>
          <DialogTitle>New loop</DialogTitle>
          <DialogDescription>
            Create it paused. Routing, prompt and activation are set on its page.
          </DialogDescription>
        </DialogHeader>
        <DialogPanel className="space-y-4 px-6 pb-5">
          <div>
            <label
              htmlFor="new-loop-name"
              className="mb-1.5 block text-xs font-medium text-foreground"
            >
              Name
            </label>
            <Input
              id="new-loop-name"
              value={name}
              onChange={(event) => setName(event.currentTarget.value)}
              placeholder="What to call this loop"
            />
          </div>

          <div>
            <span className="mb-1.5 block text-xs font-medium text-foreground">Kind</span>
            <Select
              value={kind}
              onValueChange={(value) => setKind(value as Extract<LoopKind, "schedule" | "manual">)}
            >
              <SelectTrigger>
                <SelectValue>
                  {CREATE_KINDS.find((option) => option.value === kind)?.label}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {CREATE_KINDS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <span className="mb-1.5 block text-xs font-medium text-foreground">Repository</span>
            <Select value={repositoryId} onValueChange={(value) => setRepositoryId(value ?? "")}>
              <SelectTrigger>
                <SelectValue placeholder="Select repository">
                  {repositoryId
                    ? (catalog.find((repository) => repository.id === repositoryId)?.name ??
                      repositoryId)
                    : undefined}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {catalog.map((repository) => (
                  <SelectItem key={repository.id} value={repository.id ?? ""}>
                    {repository.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {kind === "schedule" ? (
            <>
              <div>
                <label
                  htmlFor="new-loop-cron"
                  className="mb-1.5 block text-xs font-medium text-foreground"
                >
                  Cron expression
                </label>
                <Input
                  id="new-loop-cron"
                  value={cronExpression}
                  onChange={(event) => setCronExpression(event.currentTarget.value)}
                  placeholder="0 0 0 * * *"
                  className="font-mono text-[13px]"
                />
              </div>
              <div>
                <label
                  htmlFor="new-loop-template"
                  className="mb-1.5 block text-xs font-medium text-foreground"
                >
                  Message template
                </label>
                <Textarea
                  id="new-loop-template"
                  value={messageTemplate}
                  onChange={(event) => setMessageTemplate(event.currentTarget.value)}
                  placeholder="The message each run starts its task with."
                />
              </div>
            </>
          ) : null}

          {create.error ? (
            <p className="text-[13px] text-destructive-foreground">{create.error.message}</p>
          ) : null}
        </DialogPanel>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!canSubmit || create.isRunning} onClick={() => void submit()}>
            {create.isRunning ? <LoaderIcon className="animate-spin" /> : null}
            Create loop
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
