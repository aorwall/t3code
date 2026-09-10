/**
 * Fork-only. The agent credentials the viewer's own tasks run with.
 *
 * One page rather than a section per agent, because the question people arrive
 * with is "can my agent reach my things" and the answer is all of them at once.
 * The git hosts are the other half of that answer, and they live at
 * `/settings/version-control`. Everything here belongs to the viewer; the
 * deployment-wide equivalents live under the Administration pages and are
 * reachable only by an admin.
 */

import {
  CheckIcon,
  ExternalLinkIcon,
  KeyRoundIcon,
  LoaderIcon,
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
import { deleteSecret, putSecret } from "@t3tools/moatless-api/generated/secrets/secrets";
import type {
  CodexDeviceCodePollResponse,
  CodexDeviceCodeStartResponse,
  SecretMutationResponse,
} from "@t3tools/moatless-api/generated/model";

import { useMoatlessCommand, useMoatlessQuery } from "../../../moatless/query";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { Textarea } from "../../ui/textarea";
import { ITEM_ROW_CLASSNAME } from "../itemRows";
import { SettingsPageContainer, SettingsSection } from "../settingsLayout";
import { searchableSetting } from "../settingsSearch";
import { SectionError, SectionPending } from "./MoatlessSectionState";
import {
  CLAUDE_TOKEN_SECRET_KEY,
  claudeTokenSecret,
  codexState,
  isCodexAuthJson,
} from "./accountRows";
import { CredentialRow, ErrorText, TokenField } from "./credentialRows";
import { codexAccessQuery, secretsQuery } from "./queries";

export function AccountPanel() {
  return (
    <SettingsPageContainer>
      <ClaudeSection />
      <CodexSection />
    </SettingsPageContainer>
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
