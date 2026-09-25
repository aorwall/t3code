import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeftIcon, LoaderIcon } from "lucide-react";
import { useMemo, useState } from "react";

import {
  clearPluginActivation,
  deletePlugin,
  setPluginActivation,
} from "@t3tools/moatless-api/generated/plugins/plugins";
import type {
  ActivationReach,
  ActivationResponse,
  EffectivePluginResponse,
  PluginResponse,
} from "@t3tools/moatless-api/generated/model";

import { useMoatlessCommand, useMoatlessQuery } from "../../../moatless/query";
import { useMoatlessSession } from "../../../moatless/session";
import { Badge } from "../../ui/badge";
import {
  AlertDialog,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
} from "../../ui/alert-dialog";
import { Button } from "../../ui/button";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "../../ui/select";
import { ITEM_ROW_CLASSNAME } from "../itemRows";
import { SettingsPageContainer, SettingsSection } from "../settingsLayout";
import { SectionError, SectionPending } from "./MoatlessSectionState";
import {
  effectivePluginsQuery,
  pluginActivationsQuery,
  pluginsQuery,
  pluginSkillsQuery,
  usersQuery,
} from "./queries";
import {
  type ActivationIdentity,
  activationIdentities,
  activationSetting,
  identityValue,
  isSkillDelivered,
  pluginActivationRows,
  selectedIdentity,
  SETTINGS,
  type Setting,
  settingLabel,
  VIEWER_IDENTITY,
} from "./skillRows";
import { cn } from "~/lib/utils";

/**
 * One plugin: what it is, the skills it sources, and — per skill and for the
 * plugin as a whole — who gets it.
 *
 * The plugin itself comes from the catalog list rather than a read of its own,
 * because the backend has no by-id plugin read: the list is the source of that
 * fact. The skills, the activation records, and the resolved delivery are three
 * further independent reads, and each section owns its own loading state so a
 * slow skill sync does not blank the activation controls or vice versa.
 */
export function PluginDetailPanel({ pluginId }: { readonly pluginId: string }) {
  const { data, error, isPending, refresh } = useMoatlessQuery(pluginsQuery);
  const plugin = data?.find((candidate) => candidate.id === pluginId) ?? null;

  return (
    <SettingsPageContainer>
      <div>
        <Button
          size="xs"
          variant="ghost"
          className="-ml-1.5 text-muted-foreground"
          render={<Link to="/settings/skills" />}
        >
          <ArrowLeftIcon />
          Skills
        </Button>
      </div>

      {error ? (
        <SettingsSection id="plugin" title="Plugin">
          <SectionError error={error} label="this plugin" onRetry={refresh} />
        </SettingsSection>
      ) : plugin === null ? (
        <SettingsSection id="plugin" title="Plugin">
          {isPending ? (
            <SectionPending label="this plugin" />
          ) : (
            <div className={cn(ITEM_ROW_CLASSNAME, "text-sm text-muted-foreground")}>
              This plugin is no longer registered.
            </div>
          )}
        </SettingsSection>
      ) : (
        <PluginDetail key={plugin.id} plugin={plugin} />
      )}
    </SettingsPageContainer>
  );
}

function PluginDetail({ plugin }: { readonly plugin: PluginResponse }) {
  return (
    <>
      <DetailsSection plugin={plugin} />
      <ActivationSection plugin={plugin} />
      <DangerSection plugin={plugin} />
    </>
  );
}

function DetailsSection({ plugin }: { readonly plugin: PluginResponse }) {
  return (
    <SettingsSection id="plugin-details" title="Details">
      <div className={cn(ITEM_ROW_CLASSNAME, "space-y-3")}>
        <DetailRow label="Name" value={plugin.name} />
        <DetailRow label="Git URL" value={plugin.gitUrl} mono />
        <DetailRow
          label="Synced version"
          value={plugin.syncedVersion ?? "Not synced yet"}
          mono={plugin.syncedVersion !== undefined && plugin.syncedVersion !== null}
        />
      </div>
    </SettingsSection>
  );
}

function DetailRow({
  label,
  value,
  mono = false,
}: {
  readonly label: string;
  readonly value: string;
  readonly mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-4">
      <span className="w-32 shrink-0 text-sm text-muted-foreground">{label}</span>
      <span className={cn("min-w-0 break-words text-sm text-foreground", mono && "font-mono")}>
        {value}
      </span>
    </div>
  );
}

/**
 * Who gets this plugin, and each skill in it — read straight from the server's
 * resolved delivery, decided by two separate controls.
 *
 * The delivered badge is never computed here from the two controls. Off for
 * everyone plus on for you does not resolve to a truth this component owns; the
 * server resolves it and reports it in `/plugins/effective`, and the badge only
 * reads that. That is why a row can read "Off / On" and still say Delivered.
 *
 * The Everyone control writes the deployment-wide default, which is an
 * administrator's call; the second control writes one person's override, which
 * is anyone's for themselves and an administrator's for a bot user. Both are
 * hidden by the server for a non-administrator on the Everyone side, so the
 * control is shown disabled rather than absent — a missing control reads as
 * "there is no default", a disabled one as "not yours to set".
 *
 * Whose overrides the second column shows is a selection rather than a third
 * column, so the badge beside a row keeps one meaning: what the person named in
 * the header gets. A bot's tasks are provisioned from exactly that answer.
 */
function ActivationSection({ plugin }: { readonly plugin: PluginResponse }) {
  const { isAdmin } = useMoatlessSession();
  const users = useMoatlessQuery(usersQuery);
  const [selected, setSelected] = useState(VIEWER_IDENTITY);

  const identities = useMemo(
    () => activationIdentities(users.data?.users ?? []),
    [users.data?.users],
  );
  const identity = selectedIdentity(identities, selected);

  const skills = useMoatlessQuery(pluginSkillsQuery(plugin.id));
  const activations = useMoatlessQuery(pluginActivationsQuery(plugin.id, identity.userId));
  const effective = useMoatlessQuery(effectivePluginsQuery(identity.userId));

  const apply = useMoatlessCommand<
    { reach: ActivationReach; skillName: string | undefined; next: Setting },
    unknown
  >(
    ({ reach, skillName, next }) => {
      // Omit skillName rather than send undefined: a whole-plugin record has no
      // skill, and the wire form for that is an absent field, not a null one.
      const skill = skillName === undefined ? {} : { skillName };
      // Same for the subject: the viewer's own record is the one with no user
      // on it, and the everyone reach refuses a user outright.
      const subject =
        reach === "personal" && identity.userId !== undefined ? { userId: identity.userId } : {};
      return next === "unset"
        ? clearPluginActivation(plugin.id, { reach, ...skill, ...subject })
        : setPluginActivation(plugin.id, { enabled: next === "on", reach, ...skill, ...subject });
    },
    { invalidates: [`plugins/${plugin.id}/activations`, "plugins-effective"] },
  );

  const records: ActivationResponse[] = activations.data ?? [];
  const delivered: EffectivePluginResponse | undefined =
    effective.data?.find((candidate) => candidate.pluginId === plugin.id) ?? undefined;
  const rows = pluginActivationRows(plugin.name, skills.data ?? []);

  const skillsError = skills.error;
  const isViewer = identity.userId === undefined;

  return (
    <SettingsSection
      id="plugin-activation"
      title="Activation"
      headerAction={
        // One option is not a choice: a deployment with no bot users, or a
        // users list that has not arrived, shows no picker at all.
        identities.length > 1 ? (
          <IdentityPicker
            identities={identities}
            value={selected}
            label={identity.label}
            onChange={setSelected}
          />
        ) : null
      }
    >
      {skillsError ? (
        <SectionError error={skillsError} label="this plugin's skills" onRetry={skills.refresh} />
      ) : skills.data === null && skills.isPending ? (
        <SectionPending label="skills" />
      ) : (
        rows.map((row) => (
          <div
            key={row.skillName ?? "whole-plugin"}
            className={cn(ITEM_ROW_CLASSNAME, "space-y-3")}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-foreground">{row.label}</span>
                  {isSkillDelivered(delivered, row.skillName) ? (
                    <Badge variant="success" size="sm" title={`Delivered to ${identity.label}`}>
                      Delivered
                    </Badge>
                  ) : (
                    <Badge
                      variant="secondary"
                      size="sm"
                      title={`Not delivered to ${identity.label}`}
                    >
                      Not delivered
                    </Badge>
                  )}
                </div>
                {row.description ? (
                  <p className="mt-0.5 text-xs leading-normal text-muted-foreground/80">
                    {row.description}
                  </p>
                ) : null}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <ReachControl
                reachLabel="Everyone"
                hint={
                  isAdmin
                    ? "The deployment-wide default."
                    : "The deployment-wide default, set by an administrator."
                }
                disabled={!isAdmin || apply.isRunning}
                value={activationSetting(records, "everyone", row.skillName)}
                onChange={(next) =>
                  void apply.run({ reach: "everyone", skillName: row.skillName, next })
                }
                pending={activations.data === null && activations.isPending}
              />
              <ReachControl
                reachLabel={identity.label}
                hint={
                  isViewer
                    ? "Your own override, which wins over the default."
                    : "This bot's own override, which wins over the default. Its tasks get what it resolves to."
                }
                disabled={apply.isRunning}
                value={activationSetting(records, "personal", row.skillName)}
                onChange={(next) =>
                  void apply.run({ reach: "personal", skillName: row.skillName, next })
                }
                pending={activations.data === null && activations.isPending}
              />
            </div>
          </div>
        ))
      )}

      {apply.error ? (
        <p className={cn(ITEM_ROW_CLASSNAME, "py-0 text-sm text-destructive-foreground")}>
          {apply.error.message}
        </p>
      ) : null}
    </SettingsSection>
  );
}

/**
 * Whose overrides the second control shows: the viewer, or a bot user.
 *
 * In the section header rather than on each row, because it names one person
 * for the whole table — a picker per row would let two rows disagree about who
 * the page is talking about.
 */
function IdentityPicker({
  identities,
  value,
  label,
  onChange,
}: {
  readonly identities: ReadonlyArray<ActivationIdentity>;
  readonly value: string;
  readonly label: string;
  readonly onChange: (next: string) => void;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="hidden shrink-0 text-sm text-muted-foreground sm:inline">Overrides for</span>
      <Select
        value={value}
        onValueChange={(next) => onChange(next ?? VIEWER_IDENTITY)}
        aria-label="Whose overrides to show"
      >
        <SelectTrigger size="sm" className="w-40">
          <SelectValue>{label}</SelectValue>
        </SelectTrigger>
        <SelectPopup>
          {identities.map((identity) => (
            <SelectItem key={identityValue(identity)} value={identityValue(identity)}>
              {identity.label}
            </SelectItem>
          ))}
        </SelectPopup>
      </Select>
    </div>
  );
}

function ReachControl({
  reachLabel,
  hint,
  value,
  disabled,
  pending,
  onChange,
}: {
  readonly reachLabel: string;
  readonly hint: string;
  readonly value: Setting;
  readonly disabled: boolean;
  readonly pending: boolean;
  readonly onChange: (next: Setting) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5">
        <span className="text-sm font-medium text-foreground">{reachLabel}</span>
        {pending ? <LoaderIcon className="size-3 animate-spin text-muted-foreground" /> : null}
      </div>
      <Select
        value={value}
        disabled={disabled}
        onValueChange={(next) => {
          const setting = (next ?? "unset") as Setting;
          if (setting !== value) onChange(setting);
        }}
      >
        <SelectTrigger size="sm" className="w-full">
          <SelectValue>{settingLabel(value)}</SelectValue>
        </SelectTrigger>
        <SelectPopup>
          {SETTINGS.map((setting) => (
            <SelectItem key={setting} value={setting}>
              {settingLabel(setting)}
            </SelectItem>
          ))}
        </SelectPopup>
      </Select>
      <p className="text-xs leading-snug text-muted-foreground/70">{hint}</p>
    </div>
  );
}

function DangerSection({ plugin }: { readonly plugin: PluginResponse }) {
  const navigate = useNavigate();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const remove = useMoatlessCommand<void, unknown>(() => deletePlugin(plugin.id), {
    invalidates: ["plugins", "plugins-effective"],
  });

  return (
    <SettingsSection id="plugin-danger" title="Danger zone">
      <div className={ITEM_ROW_CLASSNAME}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">Remove this plugin</p>
            <p className="mt-0.5 text-xs leading-normal text-muted-foreground/80">
              Its skills stop being delivered to agents. The activation records for it are
              discarded. Registering it again re-syncs from the same source.
            </p>
          </div>
          <Button
            size="sm"
            variant="destructive-outline"
            className="shrink-0"
            onClick={() => setIsConfirmOpen(true)}
          >
            Remove
          </Button>
        </div>
        {remove.error ? (
          <p className="mt-2 text-sm text-destructive-foreground">{remove.error.message}</p>
        ) : null}
      </div>

      <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <AlertDialogPopup>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {plugin.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Its skills will no longer be delivered to any agent, and every activation record for
              it — the deployment default and everyone's overrides — is discarded.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setIsConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={remove.isRunning}
              onClick={() => {
                void remove.run().then((result) => {
                  if (result !== null) {
                    setIsConfirmOpen(false);
                    void navigate({ to: "/settings/skills" });
                  }
                });
              }}
            >
              {remove.isRunning ? <LoaderIcon className="animate-spin" /> : null}
              Remove plugin
            </Button>
          </AlertDialogFooter>
        </AlertDialogPopup>
      </AlertDialog>
    </SettingsSection>
  );
}
