import { AlertTriangleIcon, LoaderIcon } from "lucide-react";
import type { ReactNode } from "react";

import { MoatlessRequestError } from "@t3tools/moatless-api/customInstance";
import { Button } from "../../ui/button";
import { ITEM_ROW_CLASSNAME } from "../itemRows";
import { cn } from "~/lib/utils";

/**
 * The three states every administration list has before it has rows, drawn once.
 *
 * Each section owns its own state rather than the page owning one for all of
 * them. A Workspace detail page reads its workspace and the repository catalog
 * separately, and a page that blanks because the catalog is slow has hidden
 * the thing the person came for.
 */

export function SectionPending({ label }: { readonly label: string }) {
  return (
    <div
      className={cn(
        ITEM_ROW_CLASSNAME,
        "flex items-center gap-2 text-[13px] text-muted-foreground",
      )}
    >
      <LoaderIcon className="size-3.5 animate-spin" aria-hidden />
      Loading {label}…
    </div>
  );
}

/**
 * A failed read.
 *
 * A 403 gets its own wording. It is the one failure here a person can act on
 * and the one they are most likely to misread: they are signed in, so "could
 * not load" reads as a broken deployment rather than as an answer.
 */
export function SectionError({
  error,
  label,
  onRetry,
}: {
  readonly error: Error;
  readonly label: string;
  readonly onRetry?: () => void;
}) {
  const forbidden = error instanceof MoatlessRequestError && error.isForbidden;

  return (
    <div
      className={cn(
        ITEM_ROW_CLASSNAME,
        "flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between",
      )}
    >
      <div className="flex min-w-0 items-start gap-2">
        <AlertTriangleIcon
          className="mt-0.5 size-3.5 shrink-0 text-destructive-foreground"
          aria-hidden
        />
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-foreground">
            {forbidden ? `You cannot administer ${label}` : `Could not load ${label}`}
          </p>
          <p className="text-[13px] leading-[1.45] text-muted-foreground/80">
            {forbidden
              ? "This account is not an administrator of this Moatless deployment."
              : error.message}
          </p>
        </div>
      </div>
      {onRetry && !forbidden ? (
        <Button size="xs" variant="outline" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}

export function SectionEmpty({ children }: { readonly children: ReactNode }) {
  return (
    <div className={cn(ITEM_ROW_CLASSNAME, "text-[13px] text-muted-foreground")}>{children}</div>
  );
}
