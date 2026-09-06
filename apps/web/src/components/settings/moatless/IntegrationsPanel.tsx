import { Link } from "@tanstack/react-router";
import {
  ChevronRightIcon,
  ExternalLinkIcon,
  KeyRoundIcon,
  LoaderIcon,
  PlusIcon,
  Trash2Icon,
  UserPlusIcon,
} from "lucide-react";
import { useMemo, useState } from "react";

import { createAdapterConnection } from "@t3tools/moatless-api/generated/adapters/adapters";
import {
  adminRegisterGithubApp,
  adminRemoveGithubApp,
  adminRotateGithubAppKey,
} from "@t3tools/moatless-api/generated/app-administration/app-administration";
import type {
  AdapterAppSummary,
  AdapterConnectionResponse,
  CreateAdapterConnectionRequest,
  CreateUserRequest,
  GitHubAppOption,
  GitHubAppRegistrationResponse,
  RegisterGitHubAppRequest,
  RemoveGitHubAppResponse,
  RotateGitHubAppKeyRequest,
} from "@t3tools/moatless-api/generated/model";
import { createUserHandler } from "@t3tools/moatless-api/generated/users/users";

import { useMoatlessCommand, useMoatlessQuery } from "../../../moatless/query";
import {
  AlertDialog,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
} from "../../ui/alert-dialog";
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
import { Textarea } from "../../ui/textarea";
import { ITEM_ROW_CLASSNAME, ITEM_ROW_INNER_CLASSNAME } from "../itemRows";
import { SettingsPageContainer, SettingsSection } from "../settingsLayout";
import { searchableSetting } from "../settingsSearch";
import {
  adapterKindLabel,
  compareAdapterApps,
  compareConnections,
  defaultConnectionKind,
  parseGithubAppRegistration,
  secretFingerprints,
} from "./integrationRows";
import { SectionEmpty, SectionError, SectionPending } from "./MoatlessSectionState";
import { adapterAppsQuery, adaptersQuery, connectionsQuery, githubAppsQuery } from "./queries";
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
 * The GitHub apps registered on this deployment, where each is installed, and
 * whether a bot user staffs it.
 *
 * A registered app is only half of a credential. Tasks authenticate to GitHub as
 * an app *installation*, and the identity that mints that token is the app's bot
 * user — so an app with no bot has nothing to run as, and the row says so and
 * offers to create one. Pointing a workspace at that bot is what finally makes
 * its sandboxes push as the app; that control lives on the workspace.
 */
function GithubSection() {
  const apps = useMoatlessQuery(githubAppsQuery);
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);

  const rows = apps.data?.apps ?? [];

  return (
    <SettingsSection
      {...searchableSetting("integrations-github")}
      headerAction={
        <Button
          size="icon-xs"
          variant="ghost"
          aria-label="Register GitHub app"
          onClick={() => setIsRegisterOpen(true)}
        >
          <PlusIcon />
        </Button>
      }
    >
      {apps.error ? (
        <SectionError error={apps.error} label="GitHub apps" onRetry={apps.refresh} />
      ) : apps.data === null ? (
        apps.isPending ? (
          <SectionPending label="GitHub apps" />
        ) : null
      ) : rows.length === 0 ? (
        <SectionEmpty>
          No GitHub apps registered. A GitHub app lets Moatless act on repositories and pull
          requests.
        </SectionEmpty>
      ) : (
        rows.map((app) => <GithubAppRow key={app.githubAppKey} app={app} />)
      )}

      <RegisterGithubAppDialog open={isRegisterOpen} onOpenChange={setIsRegisterOpen} />
    </SettingsSection>
  );
}

function GithubAppRow({ app }: { readonly app: GitHubAppOption }) {
  const [isRotateOpen, setIsRotateOpen] = useState(false);
  const [isRemoveOpen, setIsRemoveOpen] = useState(false);

  // The deployment's login app is start-up state: its key is not stored here and
  // removing it would lock everyone out of the UI that removed it.
  const editable = app.deploymentConfigured !== true;

  return (
    <div className={ITEM_ROW_CLASSNAME}>
      <div className={ITEM_ROW_INNER_CLASSNAME}>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-medium text-foreground">{app.name}</span>
            <code className="rounded bg-accent px-1 py-px text-[11px] text-muted-foreground">
              {app.githubAppKey}
            </code>
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
          {app.botUserId ? null : <CreateBotUserAction app={app} />}
        </div>
        <div className="flex shrink-0 items-center gap-0.5 self-center">
          {editable ? (
            <Button
              size="icon-xs"
              variant="ghost"
              aria-label={`Rotate signing key for ${app.name}`}
              onClick={() => setIsRotateOpen(true)}
            >
              <KeyRoundIcon />
            </Button>
          ) : null}
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
          {editable ? (
            <Button
              size="icon-xs"
              variant="ghost"
              aria-label={`Remove ${app.name}`}
              onClick={() => setIsRemoveOpen(true)}
            >
              <Trash2Icon />
            </Button>
          ) : null}
        </div>
      </div>

      <RotateGithubAppKeyDialog app={app} open={isRotateOpen} onOpenChange={setIsRotateOpen} />
      <RemoveGithubAppDialog app={app} open={isRemoveOpen} onOpenChange={setIsRemoveOpen} />
    </div>
  );
}

/**
 * An app with no bot user cannot be run as. Creating one is a single act with no
 * options — the server resolves the `{slug}[bot]` identity from the app itself —
 * so it is a button on the row rather than a dialog.
 */
function CreateBotUserAction({ app }: { readonly app: GitHubAppOption }) {
  const create = useMoatlessCommand<CreateUserRequest, unknown>(
    (request) => createUserHandler(request),
    // Both lists change: the app gains a bot, and the deployment gains a user.
    { invalidates: ["integrations", "users"] },
  );

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-2">
      <Button
        size="sm"
        variant="outline"
        disabled={create.isRunning}
        onClick={() => {
          void create.run({ isBot: true, githubAppKey: app.githubAppKey });
        }}
      >
        {create.isRunning ? <LoaderIcon className="animate-spin" /> : <UserPlusIcon />}
        Create bot user
      </Button>
      <span className="text-[13px] text-muted-foreground/80">
        {create.error ? (
          <span className="text-destructive-foreground">{create.error.message}</span>
        ) : (
          "No bot user — nothing can run as this app yet."
        )}
      </span>
    </div>
  );
}

/**
 * Registering proves the signing key against GitHub before storing anything, so
 * a key GitHub will not accept leaves the deployment exactly as it was and the
 * error here is GitHub's own.
 *
 * The installation id is left empty in the ordinary case: an app resolves one
 * installation per repository owner on its own, and pinning one is for a
 * deployment that wants every repository to go through a single installation.
 */
function RegisterGithubAppDialog({
  open,
  onOpenChange,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}) {
  const [githubAppKey, setGithubAppKey] = useState("");
  const [appId, setAppId] = useState("");
  const [privateKeyPem, setPrivateKeyPem] = useState("");
  const [installationId, setInstallationId] = useState("");

  const register = useMoatlessCommand<RegisterGitHubAppRequest, GitHubAppRegistrationResponse>(
    (request) => adminRegisterGithubApp(request),
    { invalidates: ["integrations"] },
  );

  const request = parseGithubAppRegistration({
    githubAppKey,
    appId,
    privateKeyPem,
    installationId,
  });

  function resetFields() {
    setGithubAppKey("");
    setAppId("");
    setPrivateKeyPem("");
    setInstallationId("");
    register.reset();
  }

  async function submit() {
    if (request === null) return;
    const registered = await register.run(request);
    if (registered !== null) {
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
          <DialogTitle>Register GitHub app</DialogTitle>
          <DialogDescription>
            An app created at GitHub, so Moatless can act on the repositories it is installed on.
          </DialogDescription>
        </DialogHeader>
        <DialogPanel className="space-y-4 px-6 pb-5">
          <div>
            <label
              htmlFor="register-github-app-key"
              className="mb-1.5 block text-xs font-medium text-foreground"
            >
              Key
            </label>
            <Input
              id="register-github-app-key"
              value={githubAppKey}
              onChange={(event) => setGithubAppKey(event.currentTarget.value)}
              placeholder="dev-bot"
              className="font-mono text-[13px]"
            />
            <p className="mt-1 text-[13px] text-muted-foreground/80">
              What a bot user, a connection and a loop refer to this app by.
            </p>
          </div>
          <div>
            <label
              htmlFor="register-github-app-id"
              className="mb-1.5 block text-xs font-medium text-foreground"
            >
              App ID
            </label>
            <Input
              id="register-github-app-id"
              value={appId}
              onChange={(event) => setAppId(event.currentTarget.value)}
              placeholder="123456"
              inputMode="numeric"
            />
          </div>
          <div>
            <label
              htmlFor="register-github-app-pem"
              className="mb-1.5 block text-xs font-medium text-foreground"
            >
              Signing key
            </label>
            <Textarea
              id="register-github-app-pem"
              value={privateKeyPem}
              onChange={(event) => setPrivateKeyPem(event.currentTarget.value)}
              placeholder="-----BEGIN RSA PRIVATE KEY-----"
              rows={5}
              className="font-mono text-[13px]"
            />
            <p className="mt-1 text-[13px] text-muted-foreground/80">
              Proved against GitHub before it is stored, and never shown again.
            </p>
          </div>
          <div>
            <label
              htmlFor="register-github-app-installation"
              className="mb-1.5 block text-xs font-medium text-foreground"
            >
              Installation ID
            </label>
            <Input
              id="register-github-app-installation"
              value={installationId}
              onChange={(event) => setInstallationId(event.currentTarget.value)}
              placeholder="Optional — resolved per repository owner"
              inputMode="numeric"
            />
          </div>
          {register.error ? (
            <p className="text-[13px] text-destructive-foreground">{register.error.message}</p>
          ) : null}
        </DialogPanel>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={request === null || register.isRunning} onClick={() => void submit()}>
            {register.isRunning ? <LoaderIcon className="animate-spin" /> : null}
            Register app
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}

/**
 * The replacement key is proved before the stored one is replaced, so a bad key
 * leaves the app exactly as it was and nothing running loses its credential.
 */
function RotateGithubAppKeyDialog({
  app,
  open,
  onOpenChange,
}: {
  readonly app: GitHubAppOption;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}) {
  const [privateKeyPem, setPrivateKeyPem] = useState("");

  const rotate = useMoatlessCommand<RotateGitHubAppKeyRequest, GitHubAppRegistrationResponse>(
    (request) => adminRotateGithubAppKey(app.githubAppKey, request),
    { invalidates: ["integrations"] },
  );

  function resetFields() {
    setPrivateKeyPem("");
    rotate.reset();
  }

  async function submit() {
    if (privateKeyPem.trim().length === 0) return;
    const rotated = await rotate.run({ privateKeyPem });
    if (rotated !== null) {
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
          <DialogTitle>Rotate signing key</DialogTitle>
          <DialogDescription>
            Replaces the key {app.name} signs with. The current key stays in place until GitHub
            accepts the new one.
          </DialogDescription>
        </DialogHeader>
        <DialogPanel className="space-y-4 px-6 pb-5">
          <div>
            <label
              htmlFor="rotate-github-app-pem"
              className="mb-1.5 block text-xs font-medium text-foreground"
            >
              New signing key
            </label>
            <Textarea
              id="rotate-github-app-pem"
              value={privateKeyPem}
              onChange={(event) => setPrivateKeyPem(event.currentTarget.value)}
              placeholder="-----BEGIN RSA PRIVATE KEY-----"
              rows={5}
              className="font-mono text-[13px]"
            />
            {app.keyFingerprint ? (
              <p className="mt-1 text-[13px] text-muted-foreground/80">
                Current key {app.keyFingerprint}
              </p>
            ) : null}
          </div>
          {rotate.error ? (
            <p className="text-[13px] text-destructive-foreground">{rotate.error.message}</p>
          ) : null}
        </DialogPanel>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={privateKeyPem.trim().length === 0 || rotate.isRunning}
            onClick={() => void submit()}
          >
            {rotate.isRunning ? <LoaderIcon className="animate-spin" /> : null}
            Rotate key
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}

/**
 * Removing an app is installation-wide. Bot users backed by it are left in place
 * so past work stays attributed, which means they survive as identities that can
 * no longer obtain a token — the server names them and so does this.
 */
function RemoveGithubAppDialog({
  app,
  open,
  onOpenChange,
}: {
  readonly app: GitHubAppOption;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}) {
  const remove = useMoatlessCommand<void, RemoveGitHubAppResponse>(
    () => adminRemoveGithubApp(app.githubAppKey),
    { invalidates: ["integrations", "users"] },
  );

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) remove.reset();
        onOpenChange(next);
      }}
    >
      <AlertDialogPopup>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove {app.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            {app.botUserId
              ? "Its bot user stays, so past work keeps its author, but can no longer obtain a token. Tasks that run as it stop reaching GitHub."
              : "Tasks that authenticate through this app stop reaching GitHub."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {remove.error ? (
          <p className="px-6 pb-2 text-[13px] text-destructive-foreground">
            {remove.error.message}
          </p>
        ) : null}
        <AlertDialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={remove.isRunning}
            onClick={() => {
              void remove.run().then((result) => {
                if (result !== null) onOpenChange(false);
              });
            }}
          >
            {remove.isRunning ? <LoaderIcon className="animate-spin" /> : null}
            Remove app
          </Button>
        </AlertDialogFooter>
      </AlertDialogPopup>
    </AlertDialog>
  );
}
