/**
 * Fork-only: the sandbox panel's layout vocabulary.
 *
 * These are the settings-page diagnostics blocks (`DiagnosticsSettings`,
 * `ResourceTelemetryDiagnostics`) narrowed to a right-panel column: a section
 * header, a labelled value, and a table. They are copied rather than imported
 * because those files are upstream's and export none of this — exporting from
 * them would put a fork edit in a file every upstream merge touches, to reuse
 * markup that is four elements long.
 *
 * The rhythm follows `AgentsPanel`: uppercase micro-headers, tight rows, and
 * one scroll container around the whole body.
 */
import type { ReactNode } from "react";

import { cn } from "~/lib/utils";

import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";

export function SandboxSection({
  title,
  action,
  children,
}: {
  readonly title: string;
  readonly action?: ReactNode;
  readonly children: ReactNode;
}) {
  return (
    <section className="min-w-0">
      <div className="flex min-h-6 items-center justify-between gap-2 px-1.5">
        <h3 className="text-[.65rem] font-medium uppercase tracking-wider text-muted-foreground">
          {title}
        </h3>
        {action}
      </div>
      <div className="mt-1 min-w-0 rounded-md border border-border/70 bg-card">{children}</div>
    </section>
  );
}

/** A label and its value on one line, for a value short enough to sit beside its name. */
export function SandboxRow({
  label,
  value,
  tone = "default",
  full,
}: {
  readonly label: string;
  readonly value: ReactNode;
  readonly tone?: "default" | "warning" | "danger" | "muted";
  /** The untruncated value, for a row whose value is shortened to fit. */
  readonly full?: string | undefined;
}) {
  const rendered = (
    <span
      className={cn(
        "min-w-0 truncate text-right font-mono text-xs tabular-nums text-foreground",
        tone === "muted" && "text-muted-foreground",
        tone === "warning" && "text-warning-foreground",
        tone === "danger" && "text-destructive",
      )}
    >
      {value}
    </span>
  );

  return (
    <div className="flex min-w-0 items-baseline justify-between gap-3 border-b border-border/50 px-2.5 py-1.5 last:border-b-0">
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      {full === undefined ? (
        rendered
      ) : (
        <Tooltip>
          <TooltipTrigger render={rendered} />
          <TooltipPopup side="left" className="max-w-80 font-mono text-xs break-all">
            {full}
          </TooltipPopup>
        </Tooltip>
      )}
    </div>
  );
}

/** A block of free text under a row — an error reason, an event message. */
export function SandboxNote({
  children,
  tone = "default",
}: {
  readonly children: ReactNode;
  readonly tone?: "default" | "warning" | "danger";
}) {
  return (
    <p
      className={cn(
        "px-2.5 pb-2 text-xs leading-relaxed break-words text-muted-foreground",
        tone === "warning" && "text-warning-foreground",
        tone === "danger" && "text-destructive",
      )}
    >
      {children}
    </p>
  );
}

export function SandboxEmpty({ label }: { readonly label: string }) {
  return <div className="px-2.5 py-2 text-xs text-muted-foreground">{label}</div>;
}

/**
 * A section entry that is a heading plus its own detail lines, for the two
 * sections whose members do not fit on one row.
 */
export function SandboxEntry({
  title,
  badge,
  children,
}: {
  readonly title: ReactNode;
  readonly badge?: ReactNode;
  readonly children?: ReactNode;
}) {
  return (
    <div className="min-w-0 border-b border-border/50 px-2.5 py-1.5 last:border-b-0">
      <div className="flex min-w-0 items-center justify-between gap-2">
        <span className="min-w-0 truncate font-mono text-xs text-foreground">{title}</span>
        {badge}
      </div>
      {children}
    </div>
  );
}

const DOT_TONES = {
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-destructive",
  muted: "bg-muted-foreground/50",
  info: "bg-info",
} as const;

export function SandboxDot({ tone }: { readonly tone: keyof typeof DOT_TONES }) {
  return <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", DOT_TONES[tone])} />;
}
