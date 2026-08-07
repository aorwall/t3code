import { Link } from "@tanstack/react-router";
import { BotIcon, ChevronRightIcon } from "lucide-react";
import { useMemo, useState } from "react";

import { useMoatlessQuery } from "../../../moatless/query";
import { ITEM_ROW_CLASSNAME, ITEM_ROW_INNER_CLASSNAME } from "../itemRows";
import { SettingsPageContainer, SettingsSection } from "../settingsLayout";
import { searchableSetting } from "../settingsSearch";
import { SectionEmpty, SectionError, SectionPending } from "./MoatlessSectionState";
import { usersQuery } from "./queries";
import { SectionCount, SectionSearch } from "./SectionSearch";
import { compareUsers, filterUsers, userDisplayName, userMonogram } from "./userRows";
import { cn } from "~/lib/utils";

/**
 * Everyone with an account, and the way to one person's page.
 *
 * The list is the whole administration of users beyond a single record: it is
 * where an admin finds a login to promote or demote, so the row leads to the
 * detail and nothing is edited from here.
 */
export function UsersPanel() {
  const { data, error, isPending, refresh } = useMoatlessQuery(usersQuery);

  const [query, setQuery] = useState("");

  const all = useMemo(() => [...(data?.users ?? [])].sort(compareUsers), [data]);
  const rows = useMemo(() => filterUsers(all, query), [all, query]);

  return (
    <SettingsPageContainer>
      <SettingsSection
        {...searchableSetting("users")}
        headerAction={
          <SectionSearch
            query={query}
            onChange={setQuery}
            label="users"
            count={<SectionCount count={all.length} singular="user" plural="users" />}
          />
        }
      >
        {error ? (
          <SectionError error={error} label="users" onRetry={refresh} />
        ) : isPending && data === null ? (
          <SectionPending label="users" />
        ) : rows.length === 0 ? (
          <SectionEmpty>
            {all.length === 0 ? (
              "No users yet."
            ) : (
              <>No user matches “{query}”, by name, login or email.</>
            )}
          </SectionEmpty>
        ) : (
          rows.map((user) => (
            <Link
              key={user.id}
              to="/settings/users/$login"
              params={{ login: user.login }}
              className={cn(ITEM_ROW_CLASSNAME, "block hover:bg-accent")}
            >
              <div className={ITEM_ROW_INNER_CLASSNAME}>
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-[12px] font-medium text-muted-foreground"
                    aria-hidden
                  >
                    {userMonogram(user)}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-medium text-foreground">
                        {userDisplayName(user)}
                      </span>
                      {user.role === "admin" ? <RoleTag>admin</RoleTag> : null}
                      {user.isBot ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-accent px-1.5 py-px text-[10.5px] font-medium text-muted-foreground">
                          <BotIcon className="size-2.5" aria-hidden />
                          bot
                        </span>
                      ) : null}
                    </div>
                    <p className="truncate text-[13px] leading-[1.45] text-muted-foreground/80">
                      {user.email ?? user.login}
                    </p>
                  </div>
                </div>
                <ChevronRightIcon
                  className="size-4 shrink-0 self-center text-muted-foreground/60"
                  aria-hidden
                />
              </div>
            </Link>
          ))
        )}
      </SettingsSection>
    </SettingsPageContainer>
  );
}

function RoleTag({ children }: { readonly children: string }) {
  return (
    <span className="rounded-full bg-primary/12 px-1.5 py-px text-[10.5px] font-medium text-primary">
      {children}
    </span>
  );
}
