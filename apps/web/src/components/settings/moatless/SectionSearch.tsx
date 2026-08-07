import { SearchIcon } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Button } from "../../ui/button";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../../ui/tooltip";

/**
 * The search control in an administration section's header.
 *
 * Collapsed it is an icon beside the row count; opened it is an input. That is
 * the shape upstream's Keybindings page already uses for the one settings list
 * long enough to need searching, and these lists are the same thing — so they
 * behave the same way rather than inventing a second convention two pages
 * apart.
 *
 * It is a fork-owned copy rather than an import: upstream's lives inside
 * `KeybindingsSettings.tsx`, is not exported, and hard-codes its own labels.
 * Exporting and parameterizing it would be a restructure of an upstream file
 * for the fork's benefit, which the fork's merge rules avoid. If upstream ever
 * lifts theirs into a shared component, delete this and use it.
 *
 * Opening is deliberately not automatic: the query survives a blur so results
 * can be clicked, and only Escape or leaving an empty box puts it away.
 */
export function SectionSearch({
  query,
  onChange,
  label,
  count,
}: {
  readonly query: string;
  readonly onChange: (next: string) => void;
  /** Plural noun for the aria-label and placeholder — "workspaces", "users". */
  readonly label: string;
  /** Shown while collapsed, so the header still says how long the list is. */
  readonly count?: ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);

  if (!isOpen) {
    return (
      <>
        {count}
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                type="button"
                size="icon-xs"
                variant="ghost"
                aria-label={`Search ${label}`}
                onClick={() => setIsOpen(true)}
              >
                <SearchIcon />
              </Button>
            }
          />
          <TooltipPopup side="top">Search {label}</TooltipPopup>
        </Tooltip>
      </>
    );
  }

  return (
    <div className="relative">
      <SearchIcon
        className="pointer-events-none absolute top-1/2 left-2 size-3 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <input
        autoFocus
        type="text"
        value={query}
        onChange={(event) => onChange(event.currentTarget.value)}
        onBlur={() => {
          if (query.length === 0) setIsOpen(false);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            onChange("");
            setIsOpen(false);
          }
        }}
        placeholder={`Search ${label}`}
        aria-label={`Search ${label}`}
        className="h-6 w-44 rounded-md border border-input bg-background pr-2 pl-7 text-[11px] text-foreground outline-none placeholder:text-muted-foreground/72 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/24"
      />
    </div>
  );
}

/**
 * The count beside the search icon, singular when there is one of something.
 *
 * Here rather than in each panel because "1 loops" is the kind of thing that
 * gets written once per page otherwise.
 */
export function SectionCount({
  count,
  singular,
  plural,
}: {
  readonly count: number;
  readonly singular: string;
  readonly plural: string;
}) {
  return (
    <span className="text-[11px] text-muted-foreground">
      {count} {count === 1 ? singular : plural}
    </span>
  );
}
