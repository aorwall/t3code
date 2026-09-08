/**
 * Fork-only: what the right panel shows while the thread's sandbox is down.
 *
 * The surfaces all run inside that sandbox, so this stands in for the launcher:
 * it says what is wrong, and it opens the one surface that can fix it.
 */
import { LockKeyholeIcon } from "lucide-react";

import { Button } from "../ui/button";

export function RightPanelDisabledState({
  reason,
  onOpenSandbox,
}: {
  readonly reason: string;
  readonly onOpenSandbox?: (() => void) | undefined;
}) {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center p-6">
      <div className="flex max-w-sm flex-col items-center text-center">
        <span className="mb-3 flex size-10 items-center justify-center rounded-lg border border-border/70 bg-muted/35 text-muted-foreground">
          <LockKeyholeIcon className="size-5" />
        </span>
        <h3 className="text-sm font-medium text-foreground">Sandbox required</h3>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{reason}</p>
        {onOpenSandbox ? (
          <Button className="mt-4" size="sm" variant="outline" onClick={onOpenSandbox}>
            Open sandbox
          </Button>
        ) : null}
      </div>
    </div>
  );
}
