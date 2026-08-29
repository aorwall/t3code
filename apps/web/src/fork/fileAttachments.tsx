/**
 * Fork-only. Presentation for generic (non-image) attachments.
 *
 * Upstream's composer attaches images only: every chip it renders is a
 * thumbnail, and a `ChatFileAttachment` — which the wire contract has always
 * modelled and the Moatless backend serves up to `fileAttachments.maxUploadBytes`
 * — has nothing to paint. These two pieces give a file the same visual weight a
 * thumbnail has without pretending it is one, and are shared by the composer's
 * pending chips and the transcript's sent-message attachments so the two cannot
 * drift.
 */
import { FileTextIcon } from "lucide-react";

import { cn } from "~/lib/utils";

/** Human-readable byte count for attachment limits and chips. */
export function formatAttachmentBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"] as const;
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  // One decimal below 10 keeps "1.5 MB" honest without "1024.0 KB" noise.
  const rounded = value < 10 ? Math.round(value * 10) / 10 : Math.round(value);
  return `${rounded} ${units[unitIndex]}`;
}

export interface FileAttachmentChipProps {
  readonly name: string;
  readonly sizeBytes: number;
  readonly className?: string;
}

/**
 * A file rendered as its name and size. Deliberately not a link: a pending
 * attachment has no durable URL yet, and a sent one is fetched through the
 * environment's asset route rather than addressed directly from here.
 */
export function FileAttachmentChip({
  name,
  sizeBytes,
  className,
}: FileAttachmentChipProps): React.JSX.Element {
  return (
    <div
      data-fork-file-attachment="true"
      aria-label={`${name} (${formatAttachmentBytes(sizeBytes)})`}
      className={cn(
        "flex h-full w-full items-center gap-2 overflow-hidden rounded-lg border border-border/60 bg-muted/40 px-2 py-1.5 text-left",
        className,
      )}
    >
      <FileTextIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-medium text-foreground">{name}</div>
        <div className="text-[11px] text-muted-foreground">{formatAttachmentBytes(sizeBytes)}</div>
      </div>
    </div>
  );
}
