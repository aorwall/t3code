/**
 * Fork-only. The sidebar hover card's "Fork of {title}" / "Subtask of {title}" line.
 * A parent with no shell on this client shows only "Fork" or "Subtask".
 */
import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import { isProviderNativeSubagentThread, type ThreadId } from "@t3tools/contracts";
import { BotIcon, GitForkIcon } from "lucide-react";

import { useThreadShell } from "~/state/entities";
import type { SidebarThreadSummary } from "~/types";

export type ThreadParentKind = "fork" | "subtask";

export interface ThreadParent {
  readonly kind: ThreadParentKind;
  readonly threadId: ThreadId;
}

function getSidebarForkParentThreadId(
  thread: Pick<SidebarThreadSummary, "forkedFrom" | "lineage">,
): ThreadId | null {
  if (thread.lineage.relationshipToParent !== "fork") {
    return null;
  }
  return thread.forkedFrom?.type === "run"
    ? thread.forkedFrom.threadId
    : thread.lineage.parentThreadId;
}

/** The thread a row was forked from or delegated by, or `null` for a root. */
export function resolveThreadParent(
  thread: Pick<SidebarThreadSummary, "forkedFrom" | "lineage" | "source">,
): ThreadParent | null {
  const forkParent = getSidebarForkParentThreadId(thread);
  if (forkParent !== null) {
    return { kind: "fork", threadId: forkParent };
  }
  if (
    thread.lineage.relationshipToParent === "subagent" &&
    !isProviderNativeSubagentThread(thread.source) &&
    thread.lineage.parentThreadId !== null
  ) {
    return { kind: "subtask", threadId: thread.lineage.parentThreadId };
  }
  return null;
}

export function threadParentLabel(kind: ThreadParentKind, parentTitle: string | null): string {
  const noun = kind === "fork" ? "Fork" : "Subtask";
  const title = parentTitle?.trim() ?? "";
  return title.length > 0 ? `${noun} of ${title}` : noun;
}

export function ThreadParentLine({ thread }: { thread: SidebarThreadSummary }) {
  const parent = resolveThreadParent(thread);
  const parentShell = useThreadShell(
    parent === null ? null : scopeThreadRef(thread.environmentId, parent.threadId),
  );
  if (parent === null) return null;
  const Icon = parent.kind === "fork" ? GitForkIcon : BotIcon;
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Icon aria-hidden className="size-3 shrink-0 stroke-muted-foreground" />
      <div className="min-w-0 truncate text-foreground/75">
        {threadParentLabel(parent.kind, parentShell?.title ?? null)}
      </div>
    </div>
  );
}
