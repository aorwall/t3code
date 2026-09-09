/**
 * Fork-only. The credentials the viewer's own tasks run with.
 *
 * One page rather than a section per provider, because the question people
 * arrive with is "can my agent reach my things" and the answer is all of them at
 * once. Everything here belongs to the viewer; the deployment-wide equivalents
 * live under the Administration pages and are reachable only by an admin.
 */

import {
  CheckIcon,
  ExternalLinkIcon,
  GithubIcon,
  KeyRoundIcon,
  LoaderIcon,
  RefreshCwIcon,
  ServerIcon,
  SparklesIcon,
  Trash2Icon,
  TriangleAlertIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  deleteCodexConfig,
  pollCodexDeviceLogin,
  saveCodexAuth,
  startCodexDeviceLogin,
} from "@t3tools/moatless-api/generated/agent-harness-access/agent-harness-access";
import {
  deleteForgejoConfig,
  deleteForgejoPatOverride,
  deleteGithubConfig,
  deleteGithubPatOverride,
  saveForgejoPat,
  saveGithubPat,
} from "@t3tools/moatless-api/generated/git-host-access/git-host-access";
import { deleteSecret, putSecret } from "@t3tools/moatless-api/generated/secrets/secrets";
import type {
  CodexDeviceCodePollResponse,
  CodexDeviceCodeStartResponse,
  ForgejoProviderTokenStatusResponse,
  GitHubProviderTokenStatusResponse,
  SecretMutationResponse,
} from "@t3tools/moatless-api/generated/model";

import { useMoatlessCommand, useMoatlessQuery } from "../../../moatless/query";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Textarea } from "../../ui/textarea";
import { ITEM_ROW_CLASSNAME, ITEM_ROW_INNER_CLASSNAME } from "../itemRows";
import { SettingsPageContainer, SettingsSection } from "../settingsLayout";
import { searchableSetting } from "../settingsSearch";
import { SectionError, SectionPending } from "./MoatlessSectionState";
import {
  CLAUDE_TOKEN_SECRET_KEY,
  canConnectGithubApp,
  claudeTokenSecret,
  codexState,
  githubConnectLabel,
  githubConnectOutcome,
  githubConnectUrl,
  githubCredential,
  isCodexAuthJson,
  withoutConnectOutcome,
  type GithubConnectOutcome,
} from "./accountRows";
import {
  FORGEJO_HOST_PARAM,
  canConnectForgejoOauth,
  forgejoConnectHost,
  forgejoConnectLabel,
  forgejoConnectOutcome,
  forgejoConnectUrl,
  forgejoCredential,
  forgejoHost,
  type ForgejoConnectOutcome,
} from "./forgejoRows";
import {
  codexAccessQuery,
  featureFlagsQuery,
  forgejoAccessQuery,
  githubAccessQuery,
  secretsQuery,
} from "./queries";
import { cn } from "~/lib/utils";

export function AccountPanel() {
  const { data: features } = useMoatlessQuery(featureFlagsQuery);

  return (
    <SettingsPageContainer>
      <GithubSection />
      {/* The flag gates nothing on the backend, which serves these endpoints
          either way. It is how a deployment says whether it runs Forgejo at
          all, and this section is the only thing that turns on it. */}
      {features?.forgejo_enabled === true ? <ForgejoSection /> : null}
      <ClaudeSection />
      <CodexSection />
    </SettingsPageContainer>
  );
}

/** What a credential is right now, above whatever changes it. */
function CredentialRow({
  title,
  description,
  badge,
  actions,
}: {
  readonly title: string;
  readonly description: string;
  readonly badge?: React.ReactNode;
  readonly actions?: React.ReactNode;
}) {
  return (
    <div className={cn(ITEM_ROW_CLASSNAME, "bg-muted/30")}>
      <div className={ITEM_ROW_INNER_CLASSNAME}>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-foreground text-sm">{title}</span>
            {badge}
          </div>
          <p className="mt-0.5 text-[13px] text-muted-foreground/80">{description}</p>
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}

function ErrorText({ error }: { readonly error: Error | null }) {
  if (error === null) return null;
  return <p className="px-3 text-[13px] text-destructive-foreground sm:px-4">{error.message}</p>;
}

/** A password field and its Save button, cleared once the value is stored. */
function TokenField({
  id,
  label,
  placeholder,
  hint,
  isSaving,
  onSave,
}: {
  readonly id: string;
  readonly label: string;
  readonly placeholder: string;
  readonly hint: React.ReactNode;
  readonly isSaving: boolean;
  /** Resolves true when the value was stored, which is when the field clears. */
  readonly onSave: (token: string) => Promise<boolean>;
}) {
  const [token, setToken] = useState("");

  async function submit() {
    if (await onSave(token)) setToken("");
  }

  return (
    <div className={ITEM_ROW_CLASSNAME}>
      <label htmlFor={id} className="mb-1.5 block font-medium text-foreground text-xs">
        {label}
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          id={id}
          type="password"
          value={token}
          autoComplete="off"
          placeholder={placeholder}
          onChange={(event) => setToken(event.currentTarget.value)}
          className="min-w-56 flex-1 font-mono text-[13px]"
        />
        <Button
          size="sm"
          disabled={token.trim().length === 0 || isSaving}
          onClick={() => void submit()}
        >
          Save
        </Button>
      </div>
      <p className="mt-1 text-[13px] text-muted-foreground/80">{hint}</p>
    </div>
  );
}

// ---------------------------------------------------------------- GitHub ----

function GithubSection() {
  const { data, error, isPending, refresh } = useMoatlessQuery(githubAccessQuery);
  // The connect flow ends by loading this page again with its result in the
  // query string. Read once at mount, because the effect below then strips it —
  // otherwise a reload would re-announce a connect that already happened.
  const [outcome] = useState<GithubConnectOutcome | null>(() =>
    githubConnectOutcome(window.location.search),
  );

  useEffect(() => {
    if (outcome === null) return;
    window.history.replaceState(null, "", withoutConnectOutcome(window.location.href));
    refresh();
  }, [outcome, refresh]);

  const credential = useMemo(() => githubCredential(data), [data]);
  const canConnect = canConnectGithubApp(data);
  const connectLabel = githubConnectLabel(data);

  const disconnect = useMoatlessCommand<void, GitHubProviderTokenStatusResponse>(
    () => deleteGithubConfig(),
    { invalidates: ["account/github"] },
  );
  const removeOverride = useMoatlessCommand<void, GitHubProviderTokenStatusResponse>(
    () => deleteGithubPatOverride(),
    { invalidates: ["account/github"] },
  );
  const savePat = useMoatlessCommand<string, GitHubProviderTokenStatusResponse>(
    (token) => saveGithubPat({ token }),
    { invalidates: ["account/github"] },
  );

  function connect() {
    // Absolute: the OAuth callback lands on the backend's host, which need not
    // be this one. The backend refuses an origin it does not trust.
    const returnTo = `${window.location.origin}${withoutConnectOutcome(window.location.href)}`;
    window.location.assign(githubConnectUrl(returnTo));
  }

  return (
    <SettingsSection
      {...searchableSetting("account-github")}
      icon={<GithubIcon className="size-4" />}
    >
      {outcome ? (
        <p
          className={cn(
            "px-3 text-[13px] sm:px-4",
            outcome.tone === "error" ? "text-destructive-foreground" : "text-muted-foreground",
          )}
        >
          {outcome.message}
        </p>
      ) : null}

      {error ? (
        <SectionError error={error} label="GitHub access" onRetry={refresh} />
      ) : isPending && data === null ? (
        <SectionPending label="GitHub access" />
      ) : (
        <>
          <CredentialRow
            title={credential.label}
            description={credential.description}
            badge={
              credential.login ? (
                <Badge variant="secondary" className="font-mono">
                  {credential.login}
                </Badge>
              ) : null
            }
            actions={
              <>
                {connectLabel !== null ? (
                  <Button
                    size="xs"
                    variant={credential.kind === "none" ? "default" : "ghost"}
                    onClick={connect}
                  >
                    {credential.kind === "app" ? <RefreshCwIcon /> : null}
                    {connectLabel}
                  </Button>
                ) : null}
                {data?.hasPatOverride === true ? (
                  <Button
                    size="xs"
                    variant="ghost"
                    disabled={removeOverride.isRunning}
                    onClick={() => void removeOverride.run(undefined)}
                  >
                    Use the app instead
                  </Button>
                ) : null}
                {credential.kind !== "none" ? (
                  <Button
                    size="xs"
                    variant="ghost"
                    disabled={disconnect.isRunning}
                    onClick={() => void disconnect.run(undefined)}
                  >
                    <Trash2Icon />
                    Disconnect
                  </Button>
                ) : null}
              </>
            }
          />
          <ErrorText error={disconnect.error ?? removeOverride.error} />

          {credential.kind === "none" && !canConnect ? (
            <p className="px-3 text-[13px] text-muted-foreground/80 sm:px-4">
              This deployment has no GitHub App configured, so a personal access token is the way
              in.
            </p>
          ) : null}

          {/* Offered beside an app credential rather than instead of one: a
              token overrides the app, and removing it hands control back. */}
          <TokenField
            id="account-github-pat"
            label={credential.kind === "pat" ? "Replace your token" : "Use a personal access token"}
            placeholder="ghp_…"
            hint="Checked against GitHub before it is stored, and never shown again."
            isSaving={savePat.isRunning}
            onSave={async (token) => (await savePat.run(token)) !== null}
          />
          <ErrorText error={savePat.error} />
        </>
      )}
    </SettingsSection>
  );
}

// --------------------------------------------------------------- Forgejo ----

/**
 * Forgejo access, one instance at a time.
 *
 * Unlike GitHub there is no account to read until the page is told which
 * instance to ask about: Forgejo is self-hosted, the deployment registers each
 * host separately, and only an administrator may list them. So the viewer names
 * the host, and everything below it is scoped to that one.
 */
function ForgejoSection() {
  // The connect flow ends by loading this page again with its result — and with
  // the instance it ran for, which the callback carries no other way. Read once
  // at mount, because the effect below then strips both from the URL.
  const [returned] = useState<{
    readonly outcome: ForgejoConnectOutcome | null;
    readonly host: string;
  }>(() => ({
    outcome: forgejoConnectOutcome(window.location.search),
    host: forgejoConnectHost(window.location.search),
  }));
  const [draft, setDraft] = useState(returned.host);
  const [host, setHost] = useState(returned.host);

  useEffect(() => {
    if (returned.outcome === null && returned.host === "") return;
    window.history.replaceState(null, "", withoutConnectOutcome(window.location.href));
  }, [returned]);

  return (
    <SettingsSection
      {...searchableSetting("account-forgejo")}
      icon={<ServerIcon className="size-4" />}
    >
      {returned.outcome ? (
        <p
          className={cn(
            "px-3 text-[13px] sm:px-4",
            returned.outcome.tone === "error"
              ? "text-destructive-foreground"
              : "text-muted-foreground",
          )}
        >
          {returned.outcome.message}
        </p>
      ) : null}

      <div className={ITEM_ROW_CLASSNAME}>
        <label
          htmlFor="account-forgejo-host"
          className="mb-1.5 block font-medium text-foreground text-xs"
        >
          Instance
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            id="account-forgejo-host"
            value={draft}
            autoComplete="off"
            placeholder="git.example.com"
            onChange={(event) => setDraft(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") setHost(forgejoHost(draft));
            }}
            className="min-w-56 flex-1 font-mono text-[13px]"
          />
          <Button
            size="sm"
            disabled={forgejoHost(draft) === ""}
            onClick={() => setHost(forgejoHost(draft))}
          >
            Check
          </Button>
        </div>
        <p className="mt-1 text-[13px] text-muted-foreground/80">
          Each instance is connected on its own. A full URL works too — only its host is kept.
        </p>
      </div>

      {/* Remounted per host, so switching instances cannot show one host's
          credential under another's name while the read is in flight. */}
      {host === "" ? null : <ForgejoInstance key={host} host={host} />}
    </SettingsSection>
  );
}

function ForgejoInstance({ host }: { readonly host: string }) {
  const query = useMemo(() => forgejoAccessQuery(host), [host]);
  const { data, error, isPending, refresh } = useMoatlessQuery(query);
  const credential = useMemo(() => forgejoCredential(data), [data]);
  const connectLabel = forgejoConnectLabel(data);
  const label = `Forgejo access for ${host}`;

  const disconnect = useMoatlessCommand<void, ForgejoProviderTokenStatusResponse>(
    () => deleteForgejoConfig({ host }),
    { invalidates: ["account/forgejo"] },
  );
  const removeOverride = useMoatlessCommand<void, ForgejoProviderTokenStatusResponse>(
    () => deleteForgejoPatOverride({ host }),
    { invalidates: ["account/forgejo"] },
  );
  const savePat = useMoatlessCommand<string, ForgejoProviderTokenStatusResponse>(
    (token) => saveForgejoPat({ baseUrl: host, token }),
    { invalidates: ["account/forgejo"] },
  );

  function connect() {
    // Absolute: the OAuth callback lands on the backend's host, which need not
    // be this one. The backend refuses an origin it does not trust.
    const returnTo = new URL(
      `${window.location.origin}${withoutConnectOutcome(window.location.href)}`,
    );
    returnTo.searchParams.set(FORGEJO_HOST_PARAM, host);
    window.location.assign(forgejoConnectUrl(host, returnTo.toString()));
  }

  if (error) return <SectionError error={error} label={label} onRetry={refresh} />;
  if (isPending && data === null) return <SectionPending label={label} />;

  return (
    <>
      <CredentialRow
        title={credential.label}
        description={credential.description}
        badge={
          <Badge variant="secondary" className="font-mono">
            {host}
          </Badge>
        }
        actions={
          <>
            {connectLabel !== null ? (
              <Button
                size="xs"
                variant={credential.kind === "none" ? "default" : "ghost"}
                onClick={connect}
              >
                {credential.kind === "oauth" ? <RefreshCwIcon /> : null}
                {connectLabel}
              </Button>
            ) : null}
            {data?.hasPatOverride === true ? (
              <Button
                size="xs"
                variant="ghost"
                disabled={removeOverride.isRunning}
                onClick={() => void removeOverride.run(undefined)}
              >
                Use the authorization instead
              </Button>
            ) : null}
            {credential.kind !== "none" ? (
              <Button
                size="xs"
                variant="ghost"
                disabled={disconnect.isRunning}
                onClick={() => void disconnect.run(undefined)}
              >
                <Trash2Icon />
                Disconnect
              </Button>
            ) : null}
          </>
        }
      />
      <ErrorText error={disconnect.error ?? removeOverride.error} />

      {!canConnectForgejoOauth(data) ? (
        <p className="px-3 text-[13px] text-muted-foreground/80 sm:px-4">
          No OAuth application is registered for {host}, so a personal access token is the way in.
        </p>
      ) : null}

      <TokenField
        id="account-forgejo-pat"
        label={credential.kind === "pat" ? "Replace your token" : "Use a personal access token"}
        placeholder="Forgejo personal access token"
        hint={
          <>
            Needs <code className="font-mono">read:repository</code> to clone and{" "}
            <code className="font-mono">write:repository</code> to push. Checked against the
            instance before it is stored, and never shown again.
          </>
        }
        isSaving={savePat.isRunning}
        onSave={async (token) => (await savePat.run(token)) !== null}
      />
      <ErrorText error={savePat.error} />
    </>
  );
}

// ---------------------------------------------------------------- Claude ----

function ClaudeSection() {
  const query = useMemo(() => secretsQuery("user"), []);
  const { data, error, isPending, refresh } = useMoatlessQuery(query);
  const stored = useMemo(() => claudeTokenSecret(data), [data]);

  const save = useMoatlessCommand<string, SecretMutationResponse>(
    (value) => putSecret({ scope: "user", key: CLAUDE_TOKEN_SECRET_KEY, kind: "env", value }),
    { invalidates: ["secrets"] },
  );
  const remove = useMoatlessCommand<string, SecretMutationResponse>((id) => deleteSecret(id), {
    invalidates: ["secrets"],
  });

  return (
    <SettingsSection
      {...searchableSetting("account-claude")}
      icon={<SparklesIcon className="size-4" />}
    >
      {error ? (
        <SectionError error={error} label="Claude Code token" onRetry={refresh} />
      ) : isPending && data === null ? (
        <SectionPending label="Claude Code token" />
      ) : (
        <>
          <CredentialRow
            title={stored ? "Token stored" : "No token"}
            description={
              stored
                ? "Delivered to every task you run."
                : "Your tasks fall back to whatever the deployment provides, if anything."
            }
            badge={
              stored ? (
                <Badge variant="success">
                  <CheckIcon />
                  Active
                </Badge>
              ) : null
            }
            actions={
              stored ? (
                <Button
                  size="xs"
                  variant="ghost"
                  disabled={remove.isRunning}
                  onClick={() => void remove.run(stored.id)}
                >
                  <Trash2Icon />
                  Remove
                </Button>
              ) : null
            }
          />
          <TokenField
            id="account-claude-token"
            label={stored ? "Replace your token" : "Add a token"}
            placeholder="sk-ant-oat…"
            hint={
              <>
                Run <code className="font-mono">claude setup-token</code> to get one. Stored as your{" "}
                <code className="font-mono">{CLAUDE_TOKEN_SECRET_KEY}</code> secret.
              </>
            }
            isSaving={save.isRunning}
            onSave={async (token) => (await save.run(token)) !== null}
          />
          <ErrorText error={save.error ?? remove.error} />
        </>
      )}
    </SettingsSection>
  );
}

// ----------------------------------------------------------------- Codex ----

function CodexSection() {
  const { data, error, isPending, refresh } = useMoatlessQuery(codexAccessQuery);
  const state = useMemo(() => codexState(data), [data]);
  const disconnect = useMoatlessCommand<void, unknown>(() => deleteCodexConfig(), {
    invalidates: ["account/codex"],
  });

  return (
    <SettingsSection
      {...searchableSetting("account-codex")}
      icon={<KeyRoundIcon className="size-4" />}
    >
      {error ? (
        <SectionError error={error} label="Codex" onRetry={refresh} />
      ) : isPending && data === null ? (
        <SectionPending label="Codex" />
      ) : (
        <>
          <CredentialRow
            title={state.label}
            description={
              state.needsReconnect
                ? "The stored credential stopped refreshing. Sign in again to repair it."
                : state.connected
                  ? "Delivered to every task you run."
                  : "Your tasks fall back to whatever the deployment provides, if anything."
            }
            badge={
              state.needsReconnect ? (
                <Badge variant="warning">
                  <TriangleAlertIcon />
                  Expired
                </Badge>
              ) : state.detail ? (
                <Badge variant="secondary">{state.detail}</Badge>
              ) : null
            }
            actions={
              state.connected ? (
                <Button
                  size="xs"
                  variant="ghost"
                  disabled={disconnect.isRunning}
                  onClick={() => void disconnect.run(undefined)}
                >
                  <Trash2Icon />
                  Disconnect
                </Button>
              ) : null
            }
          />
          <ErrorText error={disconnect.error} />
          <CodexDeviceLogin />
          <CodexAuthJsonForm />
        </>
      )}
    </SettingsSection>
  );
}

/**
 * The ChatGPT device-code flow: ask for a code, show it, poll until it is
 * entered or expires.
 *
 * Polling runs at the interval the backend reports rather than one chosen here,
 * because how often ChatGPT tolerates being asked is theirs to decide.
 */
function CodexDeviceLogin() {
  const [started, setStarted] = useState<CodexDeviceCodeStartResponse | null>(null);
  const [expired, setExpired] = useState(false);
  const start = useMoatlessCommand<void, CodexDeviceCodeStartResponse>(() =>
    startCodexDeviceLogin(),
  );
  const poll = useMoatlessCommand<
    { deviceAuthId: string; userCode: string },
    CodexDeviceCodePollResponse
  >((input) => pollCodexDeviceLogin(input), { invalidates: ["account/codex"] });

  // Held in a ref because `run` is a new function every render: as a dependency
  // of the interval effect below it would tear the timer down and restack it on
  // every render. Declared first, so it is current before that effect reads it.
  const pollRef = useRef(poll.run);
  useEffect(() => {
    pollRef.current = poll.run;
  });

  useEffect(() => {
    if (started === null) return;
    let cancelled = false;
    const timer = setInterval(() => {
      void (async () => {
        const result = await pollRef.current({
          deviceAuthId: started.deviceAuthId,
          userCode: started.userCode,
        });
        if (cancelled || result === null || result.status === "pending") return;
        if (result.status === "expired") setExpired(true);
        setStarted(null);
      })();
    }, started.intervalSecs * 1000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [started]);

  async function begin() {
    setExpired(false);
    const result = await start.run(undefined);
    if (result !== null) setStarted(result);
  }

  if (started === null) {
    return (
      <div className={ITEM_ROW_CLASSNAME}>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" disabled={start.isRunning} onClick={() => void begin()}>
            {start.isRunning ? <LoaderIcon className="animate-spin" /> : null}
            Sign in with ChatGPT
          </Button>
          {expired ? (
            <span className="text-[13px] text-muted-foreground/80">
              That code expired before it was entered.
            </span>
          ) : null}
        </div>
        <ErrorText error={start.error} />
      </div>
    );
  }

  return (
    <div className={ITEM_ROW_CLASSNAME}>
      <p className="text-[13px] text-muted-foreground/80">
        Enter this code at ChatGPT. This page updates itself once you have.
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <code className="rounded-md bg-muted px-2 py-1 font-mono text-foreground text-sm tracking-[0.2em]">
          {started.userCode}
        </code>
        <Button
          size="sm"
          variant="outline"
          render={<a href={started.verificationUrl} target="_blank" rel="noreferrer" />}
        >
          <ExternalLinkIcon />
          Open ChatGPT
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setStarted(null)}>
          Cancel
        </Button>
      </div>
      <ErrorText error={poll.error} />
    </div>
  );
}

/** The way in for someone who already has a signed-in Codex CLI elsewhere. */
function CodexAuthJsonForm() {
  const [authJson, setAuthJson] = useState("");
  const save = useMoatlessCommand<string, unknown>((value) => saveCodexAuth({ authJson: value }), {
    invalidates: ["account/codex"],
  });

  async function submit() {
    if ((await save.run(authJson)) !== null) setAuthJson("");
  }

  return (
    <div className={ITEM_ROW_CLASSNAME}>
      <label
        htmlFor="account-codex-auth-json"
        className="mb-1.5 block font-medium text-foreground text-xs"
      >
        Or paste auth.json
      </label>
      <Textarea
        id="account-codex-auth-json"
        value={authJson}
        rows={4}
        placeholder='{"tokens":{…}}'
        onChange={(event) => setAuthJson(event.currentTarget.value)}
        className="font-mono text-[13px]"
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          disabled={!isCodexAuthJson(authJson) || save.isRunning}
          onClick={() => void submit()}
        >
          Save
        </Button>
        <span className="text-[13px] text-muted-foreground/80">
          From <code className="font-mono">~/.codex/auth.json</code> on a machine you have signed in
          on.
        </span>
      </div>
      <ErrorText error={save.error} />
    </div>
  );
}
