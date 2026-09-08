/**
 * Fork-only: the right panel's Sandbox surface — the machine every other
 * surface runs inside, and the controls that move it.
 *
 * The surface exists because the pill it replaces could only start and stop.
 * Everything a stuck sandbox actually needs — the image it is running, which
 * container is crash-looping and why, what the runtime last said about it, how
 * long before the reaper stops it — was reachable only from the Moatless web
 * UI, on a different host, behind a different login.
 *
 * Seven sections, in the order a person reads them when something is wrong:
 * what state the sandbox is in, what it is running, when it will stop by
 * itself, what its containers are doing, what the runtime said, what the agent
 * left running, and what is listening. Every section after the third is absent
 * rather than empty when the deployment publishes nothing for it; see the
 * `SandboxDetail` contract module.
 *
 * This surface is deliberately reachable with the sandbox stopped
 * (`sandboxSurfaces.ts`): it is where a person starts one.
 */
import {
  isAtomCommandInterrupted,
  squashAtomCommandFailure,
} from "@t3tools/client-runtime/state/runtime";
import type {
  CommandSummary,
  SandboxContainerInfo,
  SandboxImageInfo,
  SandboxRuntimeStatus,
  SandboxStatusResult,
  ScopedThreadRef,
  ThreadServer,
} from "@t3tools/contracts";
import {
  ArrowUpCircleIcon,
  ExternalLinkIcon,
  LoaderCircleIcon,
  PlayIcon,
  RefreshCwIcon,
  RotateCcwIcon,
  ScrollTextIcon,
  SquareIcon,
  Trash2Icon,
} from "lucide-react";
import { useCallback, useState } from "react";

import { requestConfirmDialog } from "~/confirmDialog";
import { cn } from "~/lib/utils";
import type { EnvironmentQueryView } from "~/state/query";
import { sandboxEnvironment } from "~/state/sandbox";
import { useAtomCommand } from "~/state/use-atom-command";

import { Button } from "../ui/button";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "../ui/menu";
import { ScrollArea } from "../ui/scroll-area";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import { useThreadPreviewServers } from "../preview/useThreadPreviewServers";
import { SandboxServerLogs } from "./SandboxServerLogs";
import {
  SandboxDot,
  SandboxEmpty,
  SandboxEntry,
  SandboxNote,
  SandboxRow,
  SandboxSection,
} from "./SandboxPanelPrimitives";
import {
  containerReason,
  eventIsWarning,
  formatCpu,
  formatIdleTimeout,
  formatMemory,
  IDLE_TIMEOUT_CHOICES,
  imageUpdateAvailable,
  SANDBOX_ACTION_CONFIRMATIONS,
  SANDBOX_CONFIRM_ACTIONS,
  sandboxActionsFor,
  shortImageRef,
  totalContainerResources,
  type SandboxAction,
} from "./sandboxPanelFormat";
import { useSandboxAvailability } from "./useSandboxAvailability";
import { useSandboxDetail } from "./useSandboxDetail";
import { commandEndedBadly, commandStateLabel, formatElapsed } from "./commandDisplay";

const STATUS_PRESENTATION: Record<
  SandboxRuntimeStatus,
  { readonly label: string; readonly tone: "success" | "warning" | "danger" | "muted" | "info" }
> = {
  not_created: { label: "Not created", tone: "muted" },
  initializing: { label: "Starting", tone: "info" },
  ready: { label: "Running", tone: "success" },
  stopped: { label: "Stopped", tone: "warning" },
  removing: { label: "Removing", tone: "info" },
  removed: { label: "Removed", tone: "muted" },
  error: { label: "Error", tone: "danger" },
};

const AGENT_LABELS = {
  running: "Working",
  waiting: "Waiting",
  idle: "Idle",
  unknown: "Unreachable",
} as const;

const CONTAINER_TONES = {
  running: "success",
  waiting: "warning",
  terminated: "danger",
  unknown: "muted",
} as const;

const SERVER_TONES = {
  started: "success",
  starting: "info",
  installing: "info",
  stopped: "muted",
  failed: "danger",
} as const;

const ACTION_LABELS: Record<SandboxAction, string> = {
  start: "Start",
  stop: "Stop",
  restart: "Restart",
  redeploy: "Redeploy",
  cleanup: "Cleanup",
};

const ACTION_ICONS = {
  start: PlayIcon,
  stop: SquareIcon,
  restart: RotateCcwIcon,
  redeploy: ArrowUpCircleIcon,
  cleanup: Trash2Icon,
} as const;

/**
 * The order the buttons appear in, which is not the order they are gated in:
 * the two that need confirming sit last so a mis-aimed click lands on a
 * reversible one.
 */
const ACTION_ORDER: ReadonlyArray<SandboxAction> = [
  "start",
  "stop",
  "restart",
  "redeploy",
  "cleanup",
];

function failureMessage(error: unknown): string {
  return error instanceof Error && error.message.trim().length > 0
    ? error.message
    : "The sandbox request failed.";
}

export function SandboxPanel({ threadRef }: { readonly threadRef: ScopedThreadRef }) {
  // The same hook the launcher's indicator reads, so the panel and the
  // indicator can never disagree about what state the sandbox is in.
  const { status } = useSandboxAvailability(threadRef);
  const detail = useSandboxDetail(threadRef);
  const servers = useThreadPreviewServers(threadRef);
  const sandboxStatus = status.data?.sandboxStatus ?? null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-3 p-2">
          <StatusSection threadRef={threadRef} status={status} detail={detail} />
          {detail.data?.image ? (
            <ImageSection image={detail.data.image} desiredState={detail.data.desiredState} />
          ) : null}
          {detail.data ? (
            <IdleStopSection
              threadRef={threadRef}
              minutes={detail.data.idleTimeoutMinutes}
              onChanged={detail.refresh}
            />
          ) : null}
          {detail.data?.containers?.length ? (
            <ContainersSection containers={detail.data.containers} />
          ) : null}
          {detail.data?.runtimeEvents?.length ? (
            <SandboxSection title="Runtime events">
              {detail.data.runtimeEvents.map((event) => (
                <SandboxEntry
                  // The runtime publishes no id, and one reason can repeat with
                  // a different message, so the pair is the key.
                  key={`${event.reason}:${event.message}`}
                  title={event.reason}
                  badge={
                    <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
                      {event.count === null ? "" : `×${event.count}`}
                    </span>
                  }
                >
                  <SandboxNote tone={eventIsWarning(event) ? "warning" : "default"}>
                    {event.message}
                  </SandboxNote>
                </SandboxEntry>
              ))}
            </SandboxSection>
          ) : null}
          {status.data?.commands?.length ? (
            <CommandsSection commands={status.data.commands} />
          ) : null}
          <ServersSection threadRef={threadRef} servers={servers.servers} />
        </div>
      </ScrollArea>
    </div>
  );
}

function StatusSection({
  threadRef,
  status,
  detail,
}: {
  readonly threadRef: ScopedThreadRef;
  readonly status: EnvironmentQueryView<SandboxStatusResult>;
  readonly detail: ReturnType<typeof useSandboxDetail>;
}) {
  const start = useAtomCommand(sandboxEnvironment.start, { reportFailure: false });
  const stop = useAtomCommand(sandboxEnvironment.stop, { reportFailure: false });
  const restart = useAtomCommand(sandboxEnvironment.restart, { reportFailure: false });
  const redeploy = useAtomCommand(sandboxEnvironment.redeploy, { reportFailure: false });
  const cleanup = useAtomCommand(sandboxEnvironment.cleanup, { reportFailure: false });
  const [pending, setPending] = useState<SandboxAction | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const sandboxStatus = status.data?.sandboxStatus ?? null;
  const presentation = sandboxStatus ? STATUS_PRESENTATION[sandboxStatus] : null;
  const available = sandboxActionsFor(status.isPending ? null : sandboxStatus);
  const commands = { start, stop, restart, redeploy, cleanup };
  const { refresh: refreshStatus } = status;
  const { refresh: refreshDetail } = detail;

  const run = useCallback(
    async (action: SandboxAction) => {
      if (SANDBOX_CONFIRM_ACTIONS.has(action)) {
        // Undefined means no themed host is mounted, and the click itself was
        // the request; the same reading `ServerUpdateAction` takes.
        const confirmed =
          (await requestConfirmDialog(SANDBOX_ACTION_CONFIRMATIONS[action] ?? "", {
            variant: "destructive",
          })) ?? true;
        if (!confirmed) return;
      }
      setActionError(null);
      setPending(action);
      const result = await commands[action]({
        environmentId: threadRef.environmentId,
        input: { threadId: threadRef.threadId },
      });
      setPending(null);
      refreshStatus();
      refreshDetail();
      if (result._tag === "Success" || isAtomCommandInterrupted(result)) return;
      setActionError(failureMessage(squashAtomCommandFailure(result)));
    },
    // The five commands are stable atom bindings; only the thread they are
    // aimed at and the two refreshes change.
    [refreshDetail, refreshStatus, threadRef.environmentId, threadRef.threadId],
  );

  const offered = ACTION_ORDER.filter((action) => available.has(action));

  return (
    <SandboxSection
      title="Status"
      action={
        <Button
          aria-label="Refresh sandbox status"
          size="icon-micro"
          variant="ghost-muted"
          onClick={() => {
            refreshStatus();
            refreshDetail();
          }}
        >
          <RefreshCwIcon />
        </Button>
      }
    >
      <div className="flex min-w-0 items-center gap-2 border-b border-border/50 px-2.5 py-2">
        {status.isPending && presentation === null ? (
          <LoaderCircleIcon className="size-3 shrink-0 animate-spin text-muted-foreground" />
        ) : (
          <SandboxDot tone={presentation?.tone ?? "muted"} />
        )}
        <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
          {presentation?.label ?? "Checking"}
        </span>
        {status.data?.agentStatus ? (
          <span className="shrink-0 text-[11px] text-muted-foreground">
            Agent {AGENT_LABELS[status.data.agentStatus].toLowerCase()}
          </span>
        ) : null}
      </div>
      {status.data?.sandboxError ? (
        <SandboxNote tone="danger">{status.data.sandboxError}</SandboxNote>
      ) : null}
      {status.error ? <SandboxNote tone="danger">{status.error}</SandboxNote> : null}
      {actionError ? <SandboxNote tone="danger">{actionError}</SandboxNote> : null}
      {detail.supported ? (
        offered.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 px-2.5 py-2">
            {offered.map((action) => {
              const Icon = ACTION_ICONS[action];
              return (
                <Button
                  key={action}
                  size="xs"
                  variant={action === "cleanup" ? "destructive-outline" : "outline"}
                  disabled={pending !== null}
                  onClick={() => void run(action)}
                >
                  {pending === action ? (
                    <LoaderCircleIcon className="size-3.5 animate-spin" />
                  ) : (
                    <Icon className="size-3.5" />
                  )}
                  <span>{ACTION_LABELS[action]}</span>
                </Button>
              );
            })}
          </div>
        ) : (
          <SandboxEmpty label="Nothing to do while the sandbox is moving." />
        )
      ) : (
        <SandboxEmpty label="This server does not serve sandbox controls." />
      )}
    </SandboxSection>
  );
}

function ImageSection({
  image,
  desiredState,
}: {
  readonly image: SandboxImageInfo;
  readonly desiredState: string;
}) {
  const stale = imageUpdateAvailable(image);
  return (
    <SandboxSection title="Image">
      <SandboxRow label="Desired state" value={desiredState} />
      <SandboxRow
        label="Running"
        value={image.current === null ? "—" : shortImageRef(image.current)}
        full={image.current ?? undefined}
        tone={image.current === null ? "muted" : "default"}
      />
      <SandboxRow
        label="Latest"
        value={image.latest === null ? "—" : shortImageRef(image.latest)}
        full={image.latest ?? undefined}
        tone={stale ? "warning" : image.latest === null ? "muted" : "default"}
      />
      {stale ? (
        <SandboxNote tone="warning">
          Redeploy to move this sandbox onto the latest image.
        </SandboxNote>
      ) : null}
    </SandboxSection>
  );
}

function IdleStopSection({
  threadRef,
  minutes,
  onChanged,
}: {
  readonly threadRef: ScopedThreadRef;
  readonly minutes: number;
  readonly onChanged: () => void;
}) {
  const setIdleTimeout = useAtomCommand(sandboxEnvironment.setIdleTimeout, {
    reportFailure: false,
  });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const choose = useCallback(
    async (next: number) => {
      setError(null);
      setPending(true);
      const result = await setIdleTimeout({
        environmentId: threadRef.environmentId,
        input: { threadId: threadRef.threadId, minutes: next },
      });
      setPending(false);
      onChanged();
      if (result._tag === "Success" || isAtomCommandInterrupted(result)) return;
      setError(failureMessage(squashAtomCommandFailure(result)));
    },
    [onChanged, setIdleTimeout, threadRef.environmentId, threadRef.threadId],
  );

  return (
    <SandboxSection
      title="Idle stop"
      action={
        <Menu>
          <MenuTrigger render={<Button size="micro" variant="ghost-muted" disabled={pending} />}>
            {pending ? <LoaderCircleIcon className="animate-spin" /> : null}
            Change
          </MenuTrigger>
          <MenuPopup align="end" side="bottom" sideOffset={6} className="min-w-36">
            {IDLE_TIMEOUT_CHOICES.map((choice) => (
              <MenuItem key={choice.minutes} onClick={() => void choose(choice.minutes)}>
                <span className={cn(choice.minutes === minutes && "font-semibold")}>
                  {choice.label}
                </span>
              </MenuItem>
            ))}
          </MenuPopup>
        </Menu>
      }
    >
      <SandboxRow
        label="Stops after"
        value={formatIdleTimeout(minutes)}
        tone={minutes === 0 ? "warning" : "default"}
      />
      {minutes === 0 ? (
        <SandboxNote tone="warning">
          This sandbox runs until someone stops it, and keeps costing while it does.
        </SandboxNote>
      ) : null}
      {error ? <SandboxNote tone="danger">{error}</SandboxNote> : null}
    </SandboxSection>
  );
}

function ContainersSection({
  containers,
}: {
  readonly containers: ReadonlyArray<SandboxContainerInfo>;
}) {
  const totals = totalContainerResources(containers);
  return (
    <SandboxSection
      title="Containers"
      action={
        totals.cpuMillicores === null && totals.memoryMb === null ? null : (
          <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
            {formatCpu(totals.cpuMillicores)} · {formatMemory(totals.memoryMb)}
          </span>
        )
      }
    >
      {containers.map((container) => {
        const reason = containerReason(container);
        return (
          <SandboxEntry
            key={container.name}
            title={
              <span className="flex min-w-0 items-center gap-2">
                <SandboxDot tone={CONTAINER_TONES[container.state]} />
                <span className="min-w-0 truncate">{container.name}</span>
              </span>
            }
            badge={
              <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
                {formatCpu(container.cpuMillicores)} · {formatMemory(container.memoryMb)}
                {container.restartCount > 0 ? ` · ${container.restartCount}↻` : ""}
              </span>
            }
          >
            {reason ? (
              <SandboxNote tone={container.state === "running" ? "default" : "warning"}>
                {reason}
              </SandboxNote>
            ) : null}
          </SandboxEntry>
        );
      })}
    </SandboxSection>
  );
}

function CommandsSection({ commands }: { readonly commands: ReadonlyArray<CommandSummary> }) {
  // One clock read for the whole section, so every elapsed is measured against
  // the same instant. There is no timer: these repaint when the status does.
  const nowMs = Date.now();
  return (
    <SandboxSection title="Commands">
      {commands.map((command) => (
        <SandboxEntry
          key={command.id}
          title={command.label}
          badge={
            <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
              {formatElapsed(command.startedAtUnixMs, nowMs)}
            </span>
          }
        >
          <SandboxNote tone={commandEndedBadly(command) ? "warning" : "default"}>
            {commandStateLabel(command)}
          </SandboxNote>
        </SandboxEntry>
      ))}
    </SandboxSection>
  );
}

function ServersSection({
  threadRef,
  servers,
}: {
  readonly threadRef: ScopedThreadRef;
  readonly servers: ReadonlyArray<ThreadServer>;
}) {
  const [openLog, setOpenLog] = useState<string | null>(null);

  return (
    <SandboxSection title="Servers">
      {servers.length === 0 ? (
        <SandboxEmpty label="This repository declares no servers." />
      ) : (
        servers.map((server) => (
          <SandboxEntry
            key={server.name}
            title={
              <span className="flex min-w-0 items-center gap-2">
                <SandboxDot tone={SERVER_TONES[server.status]} />
                <span className="min-w-0 truncate">{server.label}</span>
                <span className="shrink-0 text-[11px] text-muted-foreground">:{server.port}</span>
              </span>
            }
            badge={
              <span className="flex shrink-0 items-center gap-0.5">
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        aria-label={`${openLog === server.name ? "Hide" : "Show"} ${server.label} logs`}
                        size="icon-micro"
                        variant="ghost-muted"
                        onClick={() =>
                          setOpenLog((current) => (current === server.name ? null : server.name))
                        }
                      />
                    }
                  >
                    <ScrollTextIcon />
                  </TooltipTrigger>
                  <TooltipPopup side="top">Logs</TooltipPopup>
                </Tooltip>
                {server.url === null ? null : (
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button
                          aria-label={`Open ${server.label}`}
                          size="icon-micro"
                          variant="ghost-muted"
                          render={
                            <a href={server.url} target="_blank" rel="noreferrer noopener">
                              <ExternalLinkIcon />
                            </a>
                          }
                        />
                      }
                    />
                    <TooltipPopup side="top">{server.url}</TooltipPopup>
                  </Tooltip>
                )}
              </span>
            }
          >
            {server.error ? <SandboxNote tone="danger">{server.error}</SandboxNote> : null}
            {openLog === server.name ? (
              <SandboxServerLogs threadRef={threadRef} name={server.name} />
            ) : null}
          </SandboxEntry>
        ))
      )}
    </SandboxSection>
  );
}
