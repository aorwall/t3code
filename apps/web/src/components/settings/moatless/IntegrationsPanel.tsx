import { Link } from "@tanstack/react-router";
import { ChevronRightIcon, ExternalLinkIcon, LoaderIcon, PlusIcon } from "lucide-react";
import { useMemo, useState } from "react";

import { createAdapterConnection } from "@t3tools/moatless-api/generated/adapters/adapters";
import type {
  AdapterAppSummary,
  AdapterConnectionResponse,
  CreateAdapterConnectionRequest,
  GitHubAppOption,
} from "@t3tools/moatless-api/generated/model";

import { useMoatlessCommand, useMoatlessQuery } from "../../../moatless/query";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "../../ui/dialog";
import { Input } from "../../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select";
import { ITEM_ROW_CLASSNAME, ITEM_ROW_INNER_CLASSNAME } from "../itemRows";
import { SettingsPageContainer, SettingsSection } from "../settingsLayout";
import { searchableSetting } from "../settingsSearch";
import {
  adapterKindLabel,
  compareAdapterApps,
  compareConnections,
  defaultConnectionKind,
  secretFingerprints,
} from "./integrationRows";
import { SectionEmpty, SectionError, SectionPending } from "./MoatlessSectionState";
import {
  adapterAppsQuery,
  adaptersQuery,
  connectionsQuery,
  githubAppsQuery,
  globalGithubInstallationQuery,
} from "./queries";
import { cn } from "~/lib/utils";

export function IntegrationsPanel() {
  return (
    <SettingsPageContainer>
      <ConnectionsSection />
      <AppsSection />
      <GithubSection />
    </SettingsPageContainer>
  );
}

function ConnectionsSection() {
  const { data, error, isPending, refresh } = useMoatlessQuery(connectionsQuery);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const rows = useMemo(() => [...(data ?? [])].sort(compareConnections), [data]);

  return (
    <SettingsSection
      {...searchableSetting("integrations-connections")}
      headerAction={
        <Button
          size="icon-xs"
          variant="ghost"
          aria-label="Add connection"
          onClick={() => setIsCreateOpen(true)}
        >
          <PlusIcon />
        </Button>
      }
    >
      {error ? (
        <SectionError error={error} label="connections" onRetry={refresh} />
      ) : data === null ? (
        isPending ? (
          <SectionPending label="connections" />
        ) : null
      ) : rows.length === 0 ? (
        <SectionEmpty>
          No connections yet. A connection is an account on an integration — a Slack workspace, a
          Linear org — that loops can subscribe to.
        </SectionEmpty>
      ) : (
        rows.map((connection) => <ConnectionRow key={connection.id} connection={connection} />)
      )}

      <CreateConnectionDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />
    </SettingsSection>
  );
}

function ConnectionRow({ connection }: { readonly connection: AdapterConnectionResponse }) {
  return (
    <Link
      to="/settings/integrations/$connectionId"
      params={{ connectionId: connection.id }}
      className={cn(ITEM_ROW_CLASSNAME, "block hover:bg-accent")}
    >
      <div className={ITEM_ROW_INNER_CLASSNAME}>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-medium text-foreground">
              {connection.externalAccountId}
            </span>
            <Badge variant="secondary" size="sm">
              {connection.connectionKind}
            </Badge>
          </div>
          <p className="mt-0.5 truncate text-[13px] leading-[1.45] text-muted-foreground/80">
            {adapterKindLabel(connection.adapterKind)}
          </p>
        </div>
        <ChevronRightIcon
          className="size-4 shrink-0 self-center text-muted-foreground/60"
          aria-hidden
        />
      </div>
    </Link>
  );
}

/**
 * Creating a connection names the account it points at. The adapter list comes
 * from the deployment; the connection kind defaults from it and can be changed;
 * a webhook secret is optional. The transport config a connection may also carry
 * is edited from the connection's own page, not asked for up front.
 */
function CreateConnectionDialog({
  open,
  onOpenChange,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}) {
  const adapters = useMoatlessQuery(adaptersQuery);
  const adapterItems = adapters.data ?? [];
  const [adapter, setAdapter] = useState("");
  const [externalAccountId, setExternalAccountId] = useState("");
  const [connectionKind, setConnectionKind] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");

  const create = useMoatlessCommand<CreateAdapterConnectionRequest, AdapterConnectionResponse>(
    (request) => createAdapterConnection(request),
    { invalidates: ["integrations"] },
  );

  const effectiveAdapter = adapter || adapterItems[0] || "";
  const trimmedAccount = externalAccountId.trim();
  const canSubmit = effectiveAdapter.length > 0 && trimmedAccount.length > 0;

  function chooseAdapter(next: string) {
    setAdapter(next);
    setConnectionKind(defaultConnectionKind(next));
  }

  function resetFields() {
    setAdapter("");
    setExternalAccountId("");
    setConnectionKind("");
    setWebhookSecret("");
    create.reset();
  }

  async function submit() {
    if (!canSubmit) return;
    const kind = connectionKind.trim() || defaultConnectionKind(effectiveAdapter);
    const created = await create.run({
      adapterKind: effectiveAdapter as CreateAdapterConnectionRequest["adapterKind"],
      externalAccountId: trimmedAccount,
      connectionKind: kind,
      webhookSecret: webhookSecret.trim() || null,
    });
    if (created !== null) {
      resetFields();
      onOpenChange(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) resetFields();
        onOpenChange(next);
      }}
    >
      <DialogPopup className="max-w-md">
        <DialogHeader>
          <DialogTitle>New connection</DialogTitle>
          <DialogDescription>
            An account on an integration for loops to subscribe to.
          </DialogDescription>
        </DialogHeader>
        <DialogPanel className="space-y-4 px-6 pb-5">
          <div>
            <span className="mb-1.5 block text-xs font-medium text-foreground">Adapter</span>
            <Select value={effectiveAdapter} onValueChange={(value) => chooseAdapter(value ?? "")}>
              <SelectTrigger>
                <SelectValue placeholder="Select adapter">
                  {effectiveAdapter ? adapterKindLabel(effectiveAdapter) : undefined}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {adapterItems.map((item) => (
                  <SelectItem key={item} value={item}>
                    {adapterKindLabel(item)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label
              htmlFor="new-connection-account"
              className="mb-1.5 block text-xs font-medium text-foreground"
            >
              External account ID
            </label>
            <Input
              id="new-connection-account"
              value={externalAccountId}
              onChange={(event) => setExternalAccountId(event.currentTarget.value)}
              placeholder="Workspace, org or channel id"
            />
          </div>
          <div>
            <label
              htmlFor="new-connection-kind"
              className="mb-1.5 block text-xs font-medium text-foreground"
            >
              Connection kind
            </label>
            <Input
              id="new-connection-kind"
              value={connectionKind || defaultConnectionKind(effectiveAdapter)}
              onChange={(event) => setConnectionKind(event.currentTarget.value)}
              className="font-mono text-[13px]"
            />
          </div>
          <div>
            <label
              htmlFor="new-connection-secret"
              className="mb-1.5 block text-xs font-medium text-foreground"
            >
              Webhook secret
            </label>
            <Input
              id="new-connection-secret"
              type="password"
              value={webhookSecret}
              onChange={(event) => setWebhookSecret(event.currentTarget.value)}
              placeholder="Optional"
            />
          </div>
          {create.error ? (
            <p className="text-[13px] text-destructive-foreground">{create.error.message}</p>
          ) : null}
        </DialogPanel>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!canSubmit || create.isRunning} onClick={() => void submit()}>
            {create.isRunning ? <LoaderIcon className="animate-spin" /> : null}
            Create connection
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}

/**
 * The adapter apps this deployment has configured, and which of each app's
 * secrets are set. Read-only: an app's credentials are secrets, and rotating one
 * is a deliberate action taken where the secret can be entered, not a row here.
 */
function AppsSection() {
  const { data, error, isPending, refresh } = useMoatlessQuery(adapterAppsQuery);
  const rows = useMemo(() => [...(data?.apps ?? [])].sort(compareAdapterApps), [data]);

  return (
    <SettingsSection {...searchableSetting("integrations-apps")}>
      {error ? (
        <SectionError error={error} label="adapter apps" onRetry={refresh} />
      ) : data === null ? (
        isPending ? (
          <SectionPending label="adapter apps" />
        ) : null
      ) : rows.length === 0 ? (
        <SectionEmpty>
          No adapter apps configured. An app holds the credentials — bot tokens, signing secrets —
          an adapter authenticates with.
        </SectionEmpty>
      ) : (
        rows.map((app) => <AppRow key={`${app.adapterKind}:${app.appKey}`} app={app} />)
      )}
    </SettingsSection>
  );
}

function AppRow({ app }: { readonly app: AdapterAppSummary }) {
  const secrets = secretFingerprints(app);

  return (
    <div className={ITEM_ROW_CLASSNAME}>
      <div className={ITEM_ROW_INNER_CLASSNAME}>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-medium text-foreground">
              {app.displayName || adapterKindLabel(app.adapterKind)}
            </span>
            <code className="rounded bg-accent px-1 py-px text-[11px] text-muted-foreground">
              {app.appKey}
            </code>
          </div>
          {secrets.length === 0 ? (
            <p className="mt-0.5 text-[13px] leading-[1.45] text-muted-foreground/80">
              No secrets configured
            </p>
          ) : (
            <div className="mt-1 flex flex-wrap gap-1.5">
              {secrets.map((secret) => (
                <Badge key={secret.name} variant="outline" size="sm">
                  {secret.name}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * The GitHub apps registered on this deployment and where each is installed,
 * plus the global installation the deployment uses by default. Read-only:
 * registering an app and rotating its key involve credentials entered elsewhere.
 */
function GithubSection() {
  const apps = useMoatlessQuery(githubAppsQuery);
  const installation = useMoatlessQuery(globalGithubInstallationQuery);

  const rows = apps.data?.apps ?? [];

  return (
    <SettingsSection {...searchableSetting("integrations-github")}>
      {apps.error ? (
        <SectionError error={apps.error} label="GitHub apps" onRetry={apps.refresh} />
      ) : apps.data === null ? (
        apps.isPending ? (
          <SectionPending label="GitHub apps" />
        ) : null
      ) : (
        <>
          {installation.data?.configured ? (
            <div className={ITEM_ROW_CLASSNAME}>
              <div className={ITEM_ROW_INNER_CLASSNAME}>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">Default installation</p>
                  <p className="mt-0.5 truncate text-[13px] leading-[1.45] text-muted-foreground/80">
                    {installation.data.accountLogin ?? "—"}
                    {installation.data.accountType ? ` · ${installation.data.accountType}` : ""}
                  </p>
                </div>
                <Badge variant="success" size="sm">
                  configured
                </Badge>
              </div>
            </div>
          ) : null}

          {rows.length === 0 ? (
            <SectionEmpty>
              No GitHub apps registered. A GitHub app lets Moatless act on repositories and pull
              requests.
            </SectionEmpty>
          ) : (
            rows.map((app) => <GithubAppRow key={app.githubAppKey} app={app} />)
          )}
        </>
      )}
    </SettingsSection>
  );
}

function GithubAppRow({ app }: { readonly app: GitHubAppOption }) {
  return (
    <div className={ITEM_ROW_CLASSNAME}>
      <div className={ITEM_ROW_INNER_CLASSNAME}>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-medium text-foreground">{app.name}</span>
            {app.deploymentConfigured ? (
              <Badge variant="outline" size="sm">
                deployment
              </Badge>
            ) : null}
          </div>
          <p className="mt-0.5 truncate text-[13px] leading-[1.45] text-muted-foreground/80">
            {app.botLogin ? `${app.botLogin} · ` : ""}
            {app.installations.length === 1
              ? "1 installation"
              : `${app.installations.length} installations`}
            {app.installations.length > 0
              ? ` · ${app.installations.map((installation) => installation.accountLogin).join(", ")}`
              : ""}
          </p>
        </div>
        <Button
          size="icon-xs"
          variant="ghost"
          aria-label={`Install ${app.name}`}
          render={
            <a href={app.installUrl} target="_blank" rel="noreferrer">
              <ExternalLinkIcon />
            </a>
          }
        />
      </div>
    </div>
  );
}
