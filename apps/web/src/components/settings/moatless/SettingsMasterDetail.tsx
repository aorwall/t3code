/**
 * Fork-only. A settings page drawn as a list of entries beside the selected
 * entry's editor.
 *
 * The markup is copied from `ProviderSettingsPanel`, which draws the same card
 * inline and exports none of it. Keep the two in step by eye: an upstream
 * restyle of that panel does not reach this file. See the convergence note in
 * `docs/fork/inventory.json` — drop this copy if upstream ever exports the
 * primitive.
 */

import type { ReactNode } from "react";

import { ScrollArea } from "../../ui/scroll-area";
import { cn } from "~/lib/utils";

export interface MasterDetailEntry<Id extends string> {
  readonly id: Id;
  readonly label: string;
  /** The second line of the list row: what this entry is, in a few words. */
  readonly summary: string;
  readonly icon: ReactNode;
  readonly badge?: ReactNode;
  readonly detail: ReactNode;
}

const cardClassName = "rounded-xl border border-border/60 bg-card/40 shadow-xs/5";
// Fixed, so selecting a short entry does not collapse the card under a long one.
const cardHeightClassName = "lg:h-[min(44rem,calc(100dvh-11rem))] lg:min-h-[32rem]";

/**
 * Renders `entries` as a list on the left and the selected entry's `detail` on
 * the right. Below the `lg` breakpoint the grid collapses and the list stacks
 * above the detail, so a phone shows both.
 *
 * Falls back to the first entry when `selectedId` names none of them, which is
 * what a stale deep link and a vanishing entry both look like here.
 */
export function SettingsMasterDetail<Id extends string>({
  entries,
  selectedId,
  onSelect,
}: {
  readonly entries: readonly MasterDetailEntry<Id>[];
  readonly selectedId: Id | null;
  readonly onSelect: (id: Id) => void;
}) {
  const selected = entries.find((entry) => entry.id === selectedId) ?? entries[0] ?? null;

  return (
    <div
      className={cn(
        cardClassName,
        cardHeightClassName,
        "overflow-hidden lg:grid lg:grid-cols-[17rem_minmax(0,1fr)]",
      )}
    >
      <div className="border-b border-border/60 bg-muted/10 lg:flex lg:min-h-0 lg:flex-col lg:border-r lg:border-b-0">
        <ScrollArea scrollFade chainVerticalScroll className="lg:min-h-0 lg:flex-1">
          <div className="divide-y divide-border/50">
            {entries.map((entry) => (
              <button
                key={entry.id}
                type="button"
                data-slot="settings-row"
                aria-pressed={entry.id === selected?.id}
                onClick={() => onSelect(entry.id)}
                className={cn(
                  "flex min-h-18 w-full cursor-pointer items-start gap-3 px-3 py-3 text-left outline-none transition-colors sm:px-4",
                  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                  entry.id === selected?.id ? "bg-muted/45" : "hover:bg-muted/25",
                )}
              >
                <span className="mt-0.5 shrink-0 text-muted-foreground">{entry.icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-sm font-medium text-foreground">
                      {entry.label}
                    </span>
                    {entry.badge}
                  </span>
                  <span className="mt-0.5 block text-[13px] leading-[1.45] text-muted-foreground/80">
                    {entry.summary}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>

      <div className="min-w-0 lg:min-h-0">
        {selected ? (
          <ScrollArea scrollFade chainVerticalScroll className="lg:h-full">
            <div className="space-y-4 py-2">{selected.detail}</div>
          </ScrollArea>
        ) : (
          <div className="p-6 text-sm text-muted-foreground">Nothing to configure here.</div>
        )}
      </div>
    </div>
  );
}
