import { type OrchestrationMessageOrigin } from "@t3tools/contracts";

/**
 * Which glyph the origin chip shows. The generic key is the fallback for an
 * adapter kind the client does not recognize — a newer backend can name a
 * source this build has no icon for, and the chip still renders.
 */
export type MessageOriginIconKey = "slack" | "github" | "linear" | "telegram" | "task" | "generic";

/** Everything the origin chip needs to render, derived from one origin. */
export interface MessageOriginChipModel {
  readonly iconKey: MessageOriginIconKey;
  /** The source's human name, then its label, then its author — each only when
   *  present. The chip joins these; the first is always the source name. */
  readonly segments: ReadonlyArray<string>;
  /** A link to the source, or null when there is nothing to open. */
  readonly url: string | null;
  /** The whole thing as one sentence, for assistive technology. */
  readonly ariaLabel: string;
}

/** The source name and icon for a known kind, or `null` to fall back. */
const KNOWN_SOURCES: Record<
  string,
  { readonly iconKey: MessageOriginIconKey; readonly name: string }
> = {
  task: { iconKey: "task", name: "Another task" },
  github_pr: { iconKey: "github", name: "GitHub" },
  slack: { iconKey: "slack", name: "Slack" },
  linear: { iconKey: "linear", name: "Linear" },
  telegram: { iconKey: "telegram", name: "Telegram" },
};

/** Title-cases an unknown adapter kind for display: `custom_adapter` → `Custom adapter`. */
function humanizeKind(kind: string): string {
  const spaced = kind.replace(/[_-]+/g, " ").trim();
  if (spaced.length === 0) {
    return "External";
  }
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * Turn a message's origin into what the chip renders.
 *
 * A recognized kind gets its own name and icon; anything else is shown by a
 * humanized form of the kind under a generic icon, so a source this build has
 * never heard of is still labelled rather than dropped.
 */
export function resolveMessageOriginChip(
  origin: OrchestrationMessageOrigin,
): MessageOriginChipModel {
  const known = KNOWN_SOURCES[origin.kind];
  const iconKey = known?.iconKey ?? "generic";
  const sourceName = known?.name ?? humanizeKind(origin.kind);

  const label = origin.label?.trim() ?? "";
  const user = origin.user?.trim() ?? "";
  const segments = [
    sourceName,
    ...(label.length > 0 ? [label] : []),
    ...(user.length > 0 ? [user] : []),
  ];

  const ariaLabel = [
    `Sent from ${sourceName}`,
    label.length > 0 ? label : null,
    user.length > 0 ? `by ${user}` : null,
  ]
    .filter((part): part is string => part !== null)
    .join(", ");

  return {
    iconKey,
    segments,
    url: origin.url ?? null,
    ariaLabel,
  };
}
