/**
 * Fork-only. The git hosts the viewer's own tasks clone and push with.
 *
 * A list beside the selected host's settings rather than one section per host:
 * a deployment reaches more hosts over time, and stacking them all makes the
 * page longer without making any one of them easier to find. The agent
 * credentials — Claude Code and Codex — stay on the Account page.
 */

import { GithubIcon, RefreshCwIcon, ServerIcon, Trash2Icon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  deleteForgejoConfig,
  deleteForgejoPatOverride,
  deleteGithubConfig,
  deleteGithubPatOverride,
  saveForgejoPat,
  saveGithubPat,
} from "@t3tools/moatless-api/generated/git-host-access/git-host-access";
import type {
  ForgejoProviderTokenStatusResponse,
  GitHubProviderTokenStatusResponse,
} from "@t3tools/moatless-api/generated/model";

import { useMoatlessCommand, useMoatlessQuery } from "../../../moatless/query";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { SettingsPageContainer, SettingsSection } from "../settingsLayout";
import { searchableSetting } from "../settingsSearch";
import {
  canConnectGithubApp,
  githubConnectLabel,
  githubConnectOutcome,
  githubConnectUrl,
  githubCredential,
  withoutConnectOutcome,
  type GithubConnectOutcome,
} from "./accountRows";
import { CredentialRow, ErrorText, TokenField } from "./credentialRows";
import {
  FORGEJO_HOST_PARAM,
  canConnectForgejoOauth,
  forgejoConnectHost,
  forgejoConnectLabel,
  forgejoConnectOutcome,
  forgejoConnectUrl,
  forgejoCredential,
  type ForgejoConnectOutcome,
} from "./forgejoRows";
import { SectionError, SectionPending } from "./MoatlessSectionState";
import { featureFlagsQuery, forgejoConnectionsQuery, githubAccessQuery } from "./queries";
import { SettingsMasterDetail, type MasterDetailEntry } from "./SettingsMasterDetail";
import { cn } from "~/lib/utils";

export type VersionControlEntryId = "github" | "forgejo";

export function VersionControlPanel({
  entry,
  onSelectEntry,
}: {
  readonly entry: VersionControlEntryId | null;
  readonly onSelectEntry: (id: VersionControlEntryId) => void;
}) {
  const { data: features } = useMoatlessQuery(featureFlagsQuery);

  const entries: MasterDetailEntry<VersionControlEntryId>[] = [
    {
      id: "github",
      label: "GitHub",
      summary: "github.com",
      icon: <GithubIcon className="size-4" />,
      detail: <GithubDetail />,
    },
  ];
  // The flag gates nothing on the backend, which serves these endpoints either
  // way. It is how a deployment says whether it runs Forgejo at all, and this
  // entry is the only thing that turns on it.
  if (features?.forgejo_enabled === true) {
    entries.push({
      id: "forgejo",
      label: "Forgejo",
      summary: "Self-hosted instances",
      icon: <ServerIcon className="size-4" />,
      detail: <ForgejoDetail />,
    });
  }

  return (
    <SettingsPageContainer width="wide">
      <SettingsSection {...searchableSetting("version-control")} hideTitle variant="plain">
        <SettingsMasterDetail entries={entries} selectedId={entry} onSelect={onSelectEntry} />
      </SettingsSection>
    </SettingsPageContainer>
  );
}

function DetailHeader({
  title,
  description,
}: {
  readonly title: string;
  readonly description: string;
}) {
  return (
    <div className="px-3 pt-1 sm:px-4">
      <h3 className="font-medium text-foreground text-sm">{title}</h3>
      <p className="mt-0.5 text-[13px] text-muted-foreground/80">{description}</p>
    </div>
  );
}

// ---------------------------------------------------------------- GitHub ----

function GithubDetail() {
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
    <>
      <DetailHeader
        title="GitHub"
        description="What your tasks clone and push to github.com with."
      />

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
            id="version-control-github-pat"
            label={credential.kind === "pat" ? "Replace your token" : "Use a personal access token"}
            placeholder="ghp_…"
            hint="Checked against GitHub before it is stored, and never shown again."
            isSaving={savePat.isRunning}
            onSave={async (token) => (await savePat.run(token)) !== null}
          />
          <ErrorText error={savePat.error} />
        </>
      )}
    </>
  );
}

// --------------------------------------------------------------- Forgejo ----

/**
 * Forgejo access, one section per instance.
 *
 * Forgejo is self-hosted, so the deployment registers each host separately and
 * `GET /settings/forgejo/instances` is what names them. That list is the whole
 * page: a host it does not carry is a host this deployment does not run, so
 * there is nothing here to type a hostname into.
 */
function ForgejoDetail() {
  const { data, error, isPending, refresh } = useMoatlessQuery(forgejoConnectionsQuery);
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

  useEffect(() => {
    if (returned.outcome === null && returned.host === "") return;
    window.history.replaceState(null, "", withoutConnectOutcome(window.location.href));
    refresh();
  }, [returned, refresh]);

  const instances = data?.instances ?? [];

  return (
    <>
      <DetailHeader
        title="Forgejo"
        description="Every instance this deployment registered, and where you stand with each."
      />

      {returned.outcome ? (
        <p
          className={cn(
            "px-3 text-[13px] sm:px-4",
            returned.outcome.tone === "error"
              ? "text-destructive-foreground"
              : "text-muted-foreground",
          )}
        >
          {/* Named, because several instances are listed and the message alone
              would report an outcome for none of them. */}
          {returned.host === ""
            ? returned.outcome.message
            : `${returned.host}: ${returned.outcome.message}`}
        </p>
      ) : null}

      {error ? (
        <SectionError error={error} label="Forgejo instances" onRetry={refresh} />
      ) : isPending && data === null ? (
        <SectionPending label="Forgejo instances" />
      ) : instances.length === 0 ? (
        <p className="px-3 text-[13px] text-muted-foreground/80 sm:px-4">
          No instance is registered on this deployment. An administrator registers one before it can
          be connected here.
        </p>
      ) : (
        instances.map((instance) => (
          <ForgejoInstanceSection key={instance.host} status={instance} />
        ))
      )}
    </>
  );
}

/** What the viewer holds for one instance, and everything that changes it. */
function ForgejoInstanceSection({
  status,
}: {
  readonly status: ForgejoProviderTokenStatusResponse;
}) {
  const host = status.host;
  const credential = useMemo(() => forgejoCredential(status), [status]);
  const connectLabel = forgejoConnectLabel(status);
  const [tokenFieldOpen, setTokenFieldOpen] = useState(false);

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

  // Offered on its own line while a credential stands, so the row's own actions
  // stay about that credential. An instance with no application to authorize
  // against opens it outright: there is nothing else to offer.
  const showTokenField = tokenFieldOpen || !canConnectForgejoOauth(status);

  return (
    <section className="space-y-2">
      {/* The host heads its own section rather than sitting on the row, so a
          deployment with several instances reads as several settings groups. */}
      <h4 className="px-3 font-medium font-mono text-foreground text-sm sm:px-4">{host}</h4>

      <CredentialRow
        title={credential.label}
        description={credential.description}
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
            {status.hasPatOverride ? (
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

      {canConnectForgejoOauth(status) ? null : (
        <p className="px-3 text-[13px] text-muted-foreground/80 sm:px-4">
          No OAuth application is registered for this instance, so a personal access token is the
          way in.
        </p>
      )}

      {showTokenField ? (
        <TokenField
          id={`version-control-forgejo-pat-${host}`}
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
          onSave={async (token) => {
            const saved = (await savePat.run(token)) !== null;
            if (saved) setTokenFieldOpen(false);
            return saved;
          }}
        />
      ) : (
        <div className="px-3 sm:px-4">
          <Button
            size="xs"
            variant="ghost"
            className="px-0 text-muted-foreground"
            onClick={() => setTokenFieldOpen(true)}
          >
            {credential.kind === "pat" ? "Replace your token" : "Use a personal access token"}
          </Button>
        </div>
      )}
      <ErrorText error={savePat.error} />
    </section>
  );
}
