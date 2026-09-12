/**
 * Fork-only. The sidebar's filter over the thread list, beside the project scope.
 *
 * Owner and tag are an administrator's control, and they are gated on being one
 * only so that nobody is offered a filter whose every answer would be empty:
 * Moatless decides what a browse may return from the same read rules the rest of
 * the listing uses, and a non-administrator narrowing by owner would get the
 * public work of that person and nothing else. "Include closed" is nobody's
 * privilege — it is the viewer's own archive — so it is offered to everyone.
 */
import { ListFilterIcon, XIcon } from "lucide-react";

import { Button } from "../components/ui/button";
import { Label } from "../components/ui/label";
import { Popover, PopoverPopup, PopoverTrigger } from "../components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { SidebarMenuButton } from "../components/ui/sidebar";
import { Switch } from "../components/ui/switch";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../components/ui/tooltip";
import { tagsQuery, usersQuery } from "../components/settings/moatless/queries";
import { useMoatlessQuery } from "../moatless/query";
import { useMoatlessSession } from "../moatless/session";
import { useServerConfigs } from "../state/entities";
import { useThreadBrowseFilter } from "./browsedThreadShells";
import { isThreadFilterActive, useThreadBrowseFilterStore } from "./threadBrowseFilter";

/** What a Select carries for "no value", since its value is a string. */
const ANY = "__any__";

export function SidebarThreadFilter() {
  const filter = useThreadBrowseFilter();
  const setIncludeClosed = useThreadBrowseFilterStore((store) => store.setIncludeClosed);
  const reset = useThreadBrowseFilterStore((store) => store.reset);
  const { isAdmin } = useMoatlessSession();
  const serverConfigs = useServerConfigs();
  const canBrowse =
    isAdmin &&
    [...serverConfigs.values()].some(
      (config) => config.environment.capabilities.threadBrowse === true,
    );
  const active = isThreadFilterActive(filter);

  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger
          render={
            <PopoverTrigger
              render={
                <SidebarMenuButton
                  size="icon"
                  type="button"
                  aria-label="Filter threads"
                  className="relative shrink-0 focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar"
                />
              }
            />
          }
        >
          <ListFilterIcon />
          {active ? (
            <span
              aria-hidden="true"
              className="absolute right-1 top-1 size-1.5 rounded-full bg-primary"
            />
          ) : null}
        </TooltipTrigger>
        <TooltipPopup side="right">Filter threads</TooltipPopup>
      </Tooltip>
      <PopoverPopup align="start" side="bottom" className="w-64">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium text-sm">Filter threads</span>
            {active ? (
              <Button variant="ghost" size="xs" onClick={reset}>
                <XIcon />
                Reset
              </Button>
            ) : null}
          </div>
          {canBrowse ? <ThreadBrowseSelects /> : null}
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="sidebar-thread-filter-closed" className="text-muted-foreground text-xs">
              Include closed threads
            </Label>
            <Switch
              id="sidebar-thread-filter-closed"
              size="sm"
              checked={filter.includeClosed}
              onCheckedChange={setIncludeClosed}
            />
          </div>
        </div>
      </PopoverPopup>
    </Popover>
  );
}

/**
 * The two selects that reach outside the viewer's own listing.
 *
 * A child component so that the user directory and the tag list are read when
 * the filter is opened, not on every sidebar mount.
 */
function ThreadBrowseSelects() {
  const filter = useThreadBrowseFilter();
  const setOwnerUserId = useThreadBrowseFilterStore((store) => store.setOwnerUserId);
  const setTag = useThreadBrowseFilterStore((store) => store.setTag);
  const users = useMoatlessQuery(usersQuery);
  const tags = useMoatlessQuery(tagsQuery);
  const owner = users.data?.users.find((user) => user.id === filter.ownerUserId) ?? null;

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <Label className="text-muted-foreground text-xs">Owner</Label>
        <Select
          value={filter.ownerUserId ?? ANY}
          onValueChange={(value) => setOwnerUserId(value === ANY ? null : String(value))}
        >
          <SelectTrigger size="sm" aria-label="Filter threads by owner">
            <SelectValue>
              {/* Falls back to the id so a filter that is set never reads as
                  unset while the directory is still loading. */}
              {filter.ownerUserId === null ? "Anyone" : (ownerLabel(owner) ?? filter.ownerUserId)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>Anyone</SelectItem>
            {(users.data?.users ?? []).map((user) => (
              <SelectItem key={user.id} value={user.id}>
                {ownerLabel(user)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label className="text-muted-foreground text-xs">Tag</Label>
        <Select
          value={filter.tag ?? ANY}
          onValueChange={(value) => setTag(value === ANY ? null : String(value))}
        >
          <SelectTrigger size="sm" aria-label="Filter threads by tag">
            <SelectValue>{filter.tag ?? "Any tag"}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>Any tag</SelectItem>
            {(tags.data ?? []).map((tag) => (
              <SelectItem key={tag.tagId} value={tag.name}>
                {tag.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </>
  );
}

function ownerLabel(user: { readonly login: string; readonly name?: string | null } | null) {
  return user === null ? null : user.name?.trim() || user.login;
}
