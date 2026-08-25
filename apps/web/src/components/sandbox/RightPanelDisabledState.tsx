/**
 * Fork-only: what the right panel shows while the thread's sandbox is down.
 *
 * The surfaces all run inside that sandbox, so this stands in for the launcher
 * and carries the same status control the launcher does — the way back up is
 * where the explanation is, not in the panel's top bar.
 */
import { LockKeyholeIcon } from "lucide-react";
import type { ReactNode } from "react";

export function RightPanelDisabledState({
  reason,
  control,
}: {
  readonly reason: string;
  readonly control?: ReactNode;
}) {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center p-6">
      <div className="flex max-w-sm flex-col items-center text-center">
        <span className="mb-3 flex size-10 items-center justify-center rounded-lg border border-border/70 bg-muted/35 text-muted-foreground">
          <LockKeyholeIcon className="size-5" />
        </span>
        <h3 className="text-sm font-medium text-foreground">Sandbox required</h3>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{reason}</p>
        {control ? <div className="mt-4">{control}</div> : null}
      </div>
    </div>
  );
}
