/**
 * Fork-only. A sidebar row's links to the rest of its task tree: a count of the
 * thread's child tasks that opens their list, and a link up to the thread's
 * parent. Moatless lists child tasks as rows of their own, so these are how a
 * row says which rows belong to it.
 *
 * Both sit inside a row whose pointerdown starts a drag and whose click opens
 * the thread, so each control stops both from reaching the row.
 */
import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import type { EnvironmentId, ThreadId } from "@t3tools/contracts";
import { Link } from "@tanstack/react-router";
import { CornerLeftUpIcon, ListTreeIcon } from "lucide-react";
import { useState, type SyntheticEvent } from "react";

import { InlineButton } from "~/components/ui/button";
import { Popover, PopoverPopup, PopoverTrigger } from "~/components/ui/popover";
import { useThreadShell } from "~/state/entities";

import { SubtasksSection, useThreadSubtasks } from "./SubtasksSection";

const stopRowEvent = (event: SyntheticEvent) => event.stopPropagation();

interface ThreadFamilyProps {
  readonly environmentId: EnvironmentId;
  readonly threadId: ThreadId;
}

/** The thread's child tasks, read only while the list is open. */
function ChildTasksList({ environmentId, threadId }: ThreadFamilyProps) {
  const view = useThreadSubtasks({ environmentId, threadId });
  return <SubtasksSection view={view} />;
}

/** How many child tasks the thread has, or nothing when it has none. */
export function SidebarChildTasksBadge({
  environmentId,
  threadId,
  childCount,
}: ThreadFamilyProps & { readonly childCount: number | undefined }) {
  const [open, setOpen] = useState(false);
  if (!childCount) return null;
  const label = `${childCount} child task${childCount === 1 ? "" : "s"}`;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={<InlineButton tone="muted" />}
        aria-label={label}
        title={label}
        onPointerDown={stopRowEvent}
        onClick={stopRowEvent}
      >
        <ListTreeIcon aria-hidden className="size-3" />
        <span className="font-normal tabular-nums">{childCount}</span>
      </PopoverTrigger>
      <PopoverPopup width="md" padding="compact" align="end" onClick={stopRowEvent}>
        {open ? <ChildTasksList environmentId={environmentId} threadId={threadId} /> : null}
      </PopoverPopup>
    </Popover>
  );
}

/** A link to the thread's parent, named by its title when the sidebar has it. */
export function SidebarParentLink({
  environmentId,
  parentThreadId,
}: {
  readonly environmentId: EnvironmentId;
  readonly parentThreadId: ThreadId | null;
}) {
  const parent = useThreadShell(
    parentThreadId === null ? null : scopeThreadRef(environmentId, parentThreadId),
  );
  if (parentThreadId === null) return null;
  const label = parent ? `Parent task: ${parent.title}` : "Parent task";
  return (
    <InlineButton
      tone="muted"
      render={
        <Link to="/$environmentId/$threadId" params={{ environmentId, threadId: parentThreadId }} />
      }
      aria-label={label}
      title={label}
      onPointerDown={stopRowEvent}
      onClick={stopRowEvent}
    >
      <CornerLeftUpIcon aria-hidden className="size-3" />
    </InlineButton>
  );
}
