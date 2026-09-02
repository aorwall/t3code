/**
 * Fork-only. The child threads of a thread, as the first section of the agents
 * panel.
 *
 * A Moatless thread has two kinds of child and they are not the same kind of
 * thing. A *subagent* lives inside the conversation and is folded out of its
 * activities — the fleet the rest of that panel renders. A *subtask* is a
 * thread of its own: another task this one created, or a fork of it, with its
 * own transcript, its own sandbox and its own route. So the row here is a link
 * and the row there is not, which is the whole reason these are two sections
 * and not one list.
 *
 * The status vocabulary is deliberately the panel's own, so the two sections
 * read as one surface. The classes below mirror `AgentsPanel`'s `STATUS_VISUALS`
 * rather than importing it: keeping the delta out of that upstream file is worth
 * more at merge time than sharing six lines of Tailwind.
 */
import { useAtomValue } from "@effect/atom-react";
import type { EnvironmentId, Subtask, SubtaskStatus, ThreadId } from "@t3tools/contracts";
import { Link } from "@tanstack/react-router";
import * as Cause from "effect/Cause";
import { AsyncResult, Atom } from "effect/unstable/reactivity";
import { ChevronRight, GitBranch } from "lucide-react";

import { cn } from "~/lib/utils";
import { subtasksEnvironment } from "~/state/subtasks";

/** What the hook reads before a thread is chosen. Hooks may not be conditional,
 *  and a family member keyed on a null thread is not a thing to ask for. */
const EMPTY_SUBTASKS_ATOM = Atom.make(AsyncResult.initial<never, never>(false)).pipe(
  Atom.withLabel("fork-subtasks:empty"),
);

const STATUS_VISUALS: Record<SubtaskStatus, { dotClass: string; label: string }> = {
  pending: { dotClass: "bg-info", label: "Starting" },
  running: { dotClass: "bg-info", label: "Working" },
  idle: { dotClass: "bg-muted-foreground/50", label: "Idle · resumable" },
  completed: { dotClass: "bg-success", label: "Closed" },
  failed: { dotClass: "bg-destructive", label: "Failed" },
  interrupted: { dotClass: "bg-muted-foreground/60", label: "Stopped" },
};

export interface ThreadSubtasksView {
  readonly subtasks: ReadonlyArray<Subtask>;
  readonly hasSubtasks: boolean;
  /** A message to show, or null when there is nothing to say — including when
   *  the environment has no task tree at all. */
  readonly error: string | null;
  readonly environmentId: EnvironmentId | null;
}

/**
 * What a failed read should say, or null when it should say nothing.
 *
 * An environment that does not serve the method is not an error a person should
 * read: the section simply is not part of that product, and a build pointed at
 * a server without a task tree shows the panel exactly as upstream does. Every
 * other failure is surfaced, because a section that silently empties itself
 * would be a lie about the fleet.
 *
 * The cause is inspected structurally rather than by `instanceof`: it crossed a
 * socket and was rebuilt by the schema decoder, so what arrives is the tagged
 * shape and not necessarily the class this bundle holds.
 */
export function subtaskLoadError(cause: Cause.Cause<unknown>): string | null {
  const error: unknown = Cause.squash(cause);
  const unsupported =
    typeof error === "object" &&
    error !== null &&
    "_tag" in error &&
    (error as { _tag: unknown })._tag === "UnsupportedMethodError";
  return unsupported ? null : "Could not load this thread's subtasks.";
}

/** Read a thread's child threads. */
export function useThreadSubtasks({
  environmentId,
  threadId,
}: {
  environmentId: EnvironmentId | null;
  threadId: ThreadId | null;
}): ThreadSubtasksView {
  const result = useAtomValue(
    environmentId === null || threadId === null
      ? EMPTY_SUBTASKS_ATOM
      : subtasksEnvironment.list({ environmentId, input: { threadId } }),
  );

  if (result._tag === "Failure") {
    return {
      subtasks: [],
      hasSubtasks: false,
      error: subtaskLoadError(result.cause),
      environmentId,
    };
  }

  const subtasks = result._tag === "Success" ? result.value.subtasks : [];
  return { subtasks, hasSubtasks: subtasks.length > 0, error: null, environmentId };
}

/** One child thread. The whole row is the link that opens it. */
function SubtaskRow({
  subtask,
  environmentId,
}: {
  subtask: Subtask;
  environmentId: EnvironmentId;
}) {
  const visuals = STATUS_VISUALS[subtask.status];
  const metadata = [
    subtask.agentType,
    subtask.turnCount > 0 ? `${subtask.turnCount} turn${subtask.turnCount === 1 ? "" : "s"}` : null,
    subtask.branch,
  ].filter((value): value is string => value !== null);

  return (
    <Link
      to="/$environmentId/$threadId"
      params={{ environmentId, threadId: subtask.threadId }}
      className="grid h-[2.875rem] grid-cols-[0.375rem_minmax(0,1fr)_auto] grid-rows-[1.25rem_1rem] items-center gap-x-2 rounded-md px-1.5 py-1 hover:bg-accent/40"
    >
      <span className="col-start-1 row-start-1 flex items-center">
        <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", visuals.dotClass)} />
      </span>
      <span className="col-start-2 row-start-1 flex min-w-0 items-baseline gap-2">
        <span className="min-w-0 truncate text-sm font-medium">{subtask.title}</span>
        {subtask.relation === "forkedFrom" ? (
          <span className="flex shrink-0 items-center gap-0.5 rounded-sm border border-border/60 px-1 font-mono text-[.65rem] text-muted-foreground">
            <GitBranch aria-hidden className="size-2.5" />
            fork
          </span>
        ) : null}
      </span>
      <span className="col-start-3 row-start-1 flex items-center gap-1 text-muted-foreground/80">
        {subtask.awaitingInput ? (
          <span className="rounded-sm border border-info/40 px-1 font-mono text-[.65rem] text-info-foreground">
            needs input
          </span>
        ) : null}
        <ChevronRight aria-hidden className="size-3" />
      </span>
      <span className="col-start-2 col-end-4 row-start-2 truncate font-mono text-[.7rem] text-muted-foreground/70">
        {[visuals.label, ...metadata].join(" · ")}
      </span>
    </Link>
  );
}

/**
 * The section, or nothing at all.
 *
 * A thread with no children renders no header: an empty "Subtasks" heading on
 * every thread would push the fleet down the panel to say nothing.
 */
export function SubtasksSection({ view }: { view: ThreadSubtasksView }) {
  if (view.error !== null) {
    return <section className="px-1.5 pt-1 text-xs text-muted-foreground">{view.error}</section>;
  }
  const environmentId = view.environmentId;
  if (!view.hasSubtasks || environmentId === null) {
    return null;
  }
  return (
    <section>
      <div className="flex items-center gap-2 px-1.5 pt-1 text-[.65rem] font-medium uppercase tracking-wider text-muted-foreground">
        <span>Subtasks</span>
        <span className="font-normal normal-case text-muted-foreground/70">
          {view.subtasks.length} thread{view.subtasks.length === 1 ? "" : "s"}
        </span>
      </div>
      {view.subtasks.map((subtask) => (
        <SubtaskRow key={subtask.threadId} subtask={subtask} environmentId={environmentId} />
      ))}
    </section>
  );
}
