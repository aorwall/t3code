import { Link } from "@tanstack/react-router";
import { ArrowLeftIcon, BotIcon, LoaderIcon } from "lucide-react";

import { updateUserHandler } from "@t3tools/moatless-api/generated/users/users";
import type { UserInfo, UserListItem, UserRole } from "@t3tools/moatless-api/generated/model";

import { useMoatlessCommand, useMoatlessQuery } from "../../../moatless/query";
import { useDirtyForm } from "../../../moatless/useDirtyForm";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select";
import { ITEM_ROW_CLASSNAME } from "../itemRows";
import { SettingsPageContainer, SettingsSection } from "../settingsLayout";
import { SectionError, SectionPending } from "./MoatlessSectionState";
import { usersQuery } from "./queries";
import { userDisplayName } from "./userRows";
import { cn } from "~/lib/utils";

/**
 * One user: their identity, and the two things an administrator changes about
 * them — their profile and their global role.
 *
 * There is no single-user endpoint, so this reads the same list the index does
 * and finds its login. A login that is not in the list is a user who was
 * deleted or renamed while the page was open; it says so rather than spinning.
 */
export function UserDetailPanel({ login }: { readonly login: string }) {
  const { data, error, isPending, refresh } = useMoatlessQuery(usersQuery);

  const user = data?.users.find((candidate) => candidate.login === login) ?? null;

  return (
    <SettingsPageContainer>
      <div>
        <Button
          size="xs"
          variant="ghost"
          className="-ml-1.5 text-muted-foreground"
          render={<Link to="/settings/users" />}
        >
          <ArrowLeftIcon />
          Users
        </Button>
      </div>

      {error ? (
        <SettingsSection id="user" title="User">
          <SectionError error={error} label="this user" onRetry={refresh} />
        </SettingsSection>
      ) : user === null ? (
        <SettingsSection id="user" title="User">
          {isPending ? (
            <SectionPending label="this user" />
          ) : (
            <p className={cn(ITEM_ROW_CLASSNAME, "text-[13px] text-muted-foreground")}>
              No user with login “{login}”. They may have been renamed or removed.
            </p>
          )}
        </SettingsSection>
      ) : (
        // Keyed so navigating between users remounts the form rather than
        // carrying one user's unsaved edits into another's fields.
        <UserDetail key={user.id} user={user} />
      )}
    </SettingsPageContainer>
  );
}

function UserDetail({ user }: { readonly user: UserListItem }) {
  return (
    <>
      <div className="flex items-center gap-3 px-1">
        <span
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-medium text-muted-foreground"
          aria-hidden
        >
          {userDisplayName(user).charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h2 className="truncate text-base font-semibold text-foreground">
              {userDisplayName(user)}
            </h2>
            {user.isBot ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-accent px-1.5 py-px text-[10.5px] font-medium text-muted-foreground">
                <BotIcon className="size-2.5" aria-hidden />
                bot
              </span>
            ) : null}
          </div>
          <p className="truncate text-[13px] text-muted-foreground/80">{user.login}</p>
        </div>
      </div>

      <ProfileSection user={user} />
      <AccountSection user={user} />
    </>
  );
}

function ProfileSection({ user }: { readonly user: UserListItem }) {
  const form = useDirtyForm<{ name: string; email: string; role: UserRole }>({
    name: user.name ?? "",
    email: user.email ?? "",
    role: user.role,
  });
  const save = useMoatlessCommand<{ name: string; email: string; role: UserRole }, UserInfo>(
    (values) =>
      updateUserHandler(user.login, {
        name: values.name.length > 0 ? values.name : null,
        email: values.email.length > 0 ? values.email : null,
        role: values.role,
      }),
    { invalidates: ["users"] },
  );

  return (
    <SettingsSection id="user-profile" title="Profile">
      <div className={cn(ITEM_ROW_CLASSNAME, "space-y-4")}>
        <div>
          <Label htmlFor="user-name">Name</Label>
          <Input
            id="user-name"
            value={form.values.name}
            placeholder="Display name"
            onChange={(event) => form.setField("name", event.currentTarget.value)}
            className="mt-1.5"
          />
        </div>
        <div>
          <Label htmlFor="user-email">Email</Label>
          <Input
            id="user-email"
            type="email"
            value={form.values.email}
            placeholder="user@example.com"
            onChange={(event) => form.setField("email", event.currentTarget.value)}
            className="mt-1.5"
          />
        </div>
        <div>
          <Label htmlFor="user-role">Global role</Label>
          <Select
            value={form.values.role}
            onValueChange={(next) => next && form.setField("role", next as UserRole)}
          >
            <SelectTrigger id="user-role" className="mt-1.5 w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="user">User</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>
          <p className="mt-1.5 text-[13px] leading-[1.45] text-muted-foreground/80">
            An admin reaches every administration page and can manage all users and settings.
          </p>
        </div>
        {save.error ? (
          <p className="text-[13px] text-destructive-foreground">{save.error.message}</p>
        ) : null}
      </div>
      {form.isDirty ? (
        <div className={cn(ITEM_ROW_CLASSNAME, "flex justify-end gap-2 pt-0")}>
          <Button size="sm" variant="ghost" onClick={form.reset} disabled={save.isRunning}>
            Discard
          </Button>
          <Button
            size="sm"
            disabled={save.isRunning || form.values.name.trim().length === 0}
            onClick={() => {
              void save.run({
                name: form.values.name.trim(),
                email: form.values.email.trim(),
                role: form.values.role,
              });
            }}
          >
            {save.isRunning ? <LoaderIcon className="animate-spin" /> : null}
            Save
          </Button>
        </div>
      ) : null}
    </SettingsSection>
  );
}

function AccountSection({ user }: { readonly user: UserListItem }) {
  const rows: ReadonlyArray<{ readonly label: string; readonly value: string }> = [
    { label: "User ID", value: user.id },
    { label: "Login", value: user.login },
    { label: "Provider", value: user.provider },
    { label: "Account type", value: user.isBot ? "Bot" : "User" },
    { label: "Created", value: formatTimestamp(user.createdAt) },
    { label: "Last login", value: formatTimestamp(user.lastLoginAt) },
  ];

  return (
    <SettingsSection id="user-account" title="Account">
      <div className={cn(ITEM_ROW_CLASSNAME, "grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2")}>
        {rows.map((row) => (
          <div key={row.label} className="min-w-0">
            <p className="text-[12px] font-medium text-muted-foreground/70">{row.label}</p>
            <p className="mt-0.5 break-all text-[13px] text-foreground">{row.value}</p>
          </div>
        ))}
      </div>
    </SettingsSection>
  );
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}
