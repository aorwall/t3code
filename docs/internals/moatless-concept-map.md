# T3 Code contract → Moatless: concept map

A feature-by-feature walk of every surface in [`client-server-contract.md`](./client-server-contract.md),
against the Moatless Vibe backend. For each T3 feature: is there a Moatless equivalent,
is it _the same thing_ or only shaped like it, and where is the gap.

**Sources.** T3 side: `packages/contracts` on this branch. Moatless side: the
`soaplabs/moatless` checkout — `openapi-specs.json` (126 paths / 164 operations),
`crates/sandbox-proto/proto/sandbox/v1/sandbox.proto` (2 gRPC services),
`crates/events/src/lib.rs` (event taxonomy), `backend/src/sse/routes.rs` (the live
stream), and `CONTEXT.md` (the glossary). Everything below is read off source, not
measured against a live deployment — claims about _behaviour_ under load are marked
`[unverified]`.

**Verdict key.**

|       | Meaning                                                                                                               |
| ----- | --------------------------------------------------------------------------------------------------------------------- |
| **=** | Equivalent. Same concept, mappable field-by-field.                                                                    |
| **≈** | Kind of the same. The concept exists but the shape, granularity, or ownership differs — these are the dangerous ones. |
| **∅** | No analogue in Moatless.                                                                                              |
| **+** | Moatless has it, T3 has no concept for it.                                                                            |

---

## 1. The nouns

The two systems agree on the middle of the model and disagree at both ends.

| T3 Code                          | Moatless                       |     | Note                                                                                                                                                                                                                                                                                    |
| -------------------------------- | ------------------------------ | --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Project                          | **Repository**                 | ≈   | T3 project ≈ one repo checkout. Moatless splits this in two: `Repository` (the git connection) and `Workspace` (repos + run-config). T3 has no `Workspace`.                                                                                                                             |
| —                                | **Workspace**                  | +   | Composition of ≥1 repos plus docker image, setup commands, env, servers, resources. T3's nearest thing is `t3.json`, which is repo-local and not a server-side entity.                                                                                                                  |
| —                                | **WorkspaceRepo**              | +   | A repo's _placement_ in a workspace (branch override, mount subdir, primary flag). T3 is single-repo-per-project; multi-root is not modelled.                                                                                                                                           |
| Thread                           | **Task**                       | =   | The one clean isomorphism. `threadId ↔ task.taskId`, `projectId ↔ task.repositoryId`.                                                                                                                                                                                                   |
| Turn                             | **Turn** / `Run`               | =   | Moatless persists `task_turns`; `turnNumber` is on every message. `Run` is the runtime-internal twin (one `run_id` per idle→running edge).                                                                                                                                              |
| Session                          | _derived_                      | ≈   | T3 has a first-class session with a status machine. Moatless has no session resource — status comes from `GET /api/sandbox/v1/tasks/{id}/live-status` (`AgentStatus = running \| idle \| unknown`) plus the event log.                                                                  |
| Environment / server             | **Sandbox**                    | ≈   | T3's environment is a long-lived server you connect to. A Moatless Sandbox is _per-task_, ephemeral, and has a desired-state lifecycle (`running \| stopped \| removed`) that T3 has no vocabulary for. This is the deepest structural difference.                                      |
| Provider instance (`instanceId`) | `task.agentType`               | ≈   | T3 instances are user-configured records with their own credentials. Moatless `agentType` is an enum-ish tag (`codex`, `claude-code`, `claude-code-cli`, `claude-code-fable`, `claude-code-tui`); credentials live per-user under `/settings/{codex,github,gitness}`, not per instance. |
| `interactionMode`                | `agentMode` (`edit` \| `plan`) | =   | Direct: `edit → default`, `plan → plan`. Settable per task _and_ per message.                                                                                                                                                                                                           |
| `runtimeMode`                    | —                              | ∅   | Everything runs in a sandbox; there is no permission tier to select.                                                                                                                                                                                                                    |
| `repositoryIdentity`             | constructed                    | ≈   | Moatless has `repository.remoteUrl` + `provider`. T3 wants a `{canonicalKey, locator}` struct. Note the merge hazard: two Moatless repositories may share one remote, and T3 groups by `canonicalKey`, so they collapse into one sidebar header.                                        |

---

## 2. HTTP — `EnvironmentHttpApi` (23 endpoints)

### metadata (1)

| T3                                | Moatless |     |                                                                                                                                                                                                                                              |
| --------------------------------- | -------- | --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /.well-known/t3/environment` | —        | ∅   | No discovery document. `GET /api/v1/auth/mode` and `GET /api/v1/feature-flags` are the closest — they report deployment shape, but no environment id, version, or capability set. Capability negotiation has no Moatless counterpart at all. |

### auth (10)

Moatless auth is **user-and-deployment** scoped; T3 auth is **device-and-environment**
scoped. They solve different problems, which is why most of this group has no analogue.

| T3                                     | Moatless                                                                           |     |                                                                                                                                                              |
| -------------------------------------- | ---------------------------------------------------------------------------------- | --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET /api/auth/session`                | `GET /api/v1/auth/me`                                                              | =   | Both return the current identity.                                                                                                                            |
| `POST /api/auth/browser-session`       | `POST /api/v1/auth/password/login`, `/auth/api-key/session`, `/auth/token/session` | ≈   | Moatless has three credential→cookie exchanges (password, `mvk_` API key, sandbox JWT). T3 has one.                                                          |
| `POST /oauth/token`                    | —                                                                                  | ∅   | Moatless's OAuth endpoints are _outbound_ (`/settings/github/oauth/*`, `/settings/codex/login/*` device flow) — it is an OAuth client, not a token issuer.   |
| `POST /api/auth/websocket-ticket`      | —                                                                                  | ∅   | No WebSocket, so no upgrade-auth problem. The SSE firehose authenticates by cookie/API key on a normal GET.                                                  |
| `POST /api/auth/pairing-token`         | —                                                                                  | ∅   | **No pairing concept.** T3 pairs a device to a server; Moatless is a hosted multi-user service you log into.                                                 |
| `GET /api/auth/pairing-links`          | —                                                                                  | ∅   | "                                                                                                                                                            |
| `POST /api/auth/pairing-links/revoke`  | —                                                                                  | ∅   | "                                                                                                                                                            |
| `GET /api/auth/clients`                | `GET /api/v1/auth/api-keys`                                                        | ≈   | Same _shape_ (list credentials, revoke one), different subject: T3 lists connected client sessions, Moatless lists long-lived API keys. Not interchangeable. |
| `POST /api/auth/clients/revoke`        | `DELETE /api/v1/auth/api-keys/{key_id}`                                            | ≈   | "                                                                                                                                                            |
| `POST /api/auth/clients/revoke-others` | —                                                                                  | ∅   | No "revoke all but me".                                                                                                                                      |
| —                                      | `GET /api/v1/auth/verify`                                                          | +   | Traefik ForwardAuth endpoint. T3 has no reverse-proxy auth integration.                                                                                      |
| —                                      | `PUT /api/v1/auth/password`, `PATCH /api/v1/auth/me`                               | +   | Self-service profile/password. T3 has no user profile.                                                                                                       |

### orchestration (4)

| T3                                         | Moatless                                                     |     |                                                                                                                                                                                                                   |
| ------------------------------------------ | ------------------------------------------------------------ | --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/orchestration/shell`             | `GET /api/v1/repositories` + `GET /api/v1/tasks?status=open` | ≈   | Two calls, not one. Moatless has no single "everything the sidebar needs" read. `GET /api/v1/tasks` is unfiltered-huge (4,641 rows on the probed deployment), so the filter is load-bearing, not an optimisation. |
| `GET /api/orchestration/threads/:threadId` | `GET /api/v1/tasks/{id}` + `GET /api/v1/tasks/{id}/messages` | ≈   | Detail is split across task metadata and a paginated message page (`nextBeforeId` cursor). T3 wants one snapshot with a `sequence`.                                                                               |
| `GET /api/orchestration/snapshot`          | —                                                            | ∅   | No full read-model dump.                                                                                                                                                                                          |
| `POST /api/orchestration/dispatch`         | _n_ REST routes                                              | ≈   | See §5 — T3 funnels all writes through one command union; Moatless spreads them over ~15 verbs on 4 resources.                                                                                                    |

### connect / relay (8)

| T3                                          | Moatless |     |                                                                                                                                                                                  |
| ------------------------------------------- | -------- | --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| all 8 `/api/connect/*`, `/api/t3-connect/*` | —        | ∅   | T3 Connect exists to reach a server running on someone's laptop. Moatless _is_ the hosted plane — the problem does not arise. Structurally unmappable, not merely unimplemented. |

---

## 3. WebSocket — `WsRpcGroup` (70 methods)

Transport first: **Moatless has no WebSocket and no RPC.** It is REST + one SSE
firehose. So every mapping below is "does the capability exist", not "does the call
exist".

### 3.1 Server meta (14)

| T3 method                          | Moatless                                                                             |     |                                                                                                                                                                                                                        |
| ---------------------------------- | ------------------------------------------------------------------------------------ | --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `server.probe`                     | `/health`, `/healthz` (sandbox)                                                      | ≈   | Health checks exist; nothing probes the _backend_ as a connection liveness check.                                                                                                                                      |
| `server.getConfig`                 | `GET /api/v1/auth/mode` + `/feature-flags` + `/agents`                               | ≈   | The information exists, scattered over three endpoints, and there is no version/capability envelope.                                                                                                                   |
| `server.getSettings`               | `GET /api/v1/settings/{codex,github,gitness}/config`                                 | ≈   | **Kind of the same, and that's the trap.** T3 `ServerSettings` is one 610-line typed blob for the whole server. Moatless settings are per-provider, per-user, credential-shaped. There is no "server settings" object. |
| `server.updateSettings`            | `PUT /api/v1/settings/*/config`                                                      | ≈   | Per-provider writes; no patch semantics over a single document.                                                                                                                                                        |
| `server.refreshProviders`          | `GET /api/v1/agents`                                                                 | ≈   | Lists supported agents with installed/credential status per user. Read-only — no refresh trigger.                                                                                                                      |
| `server.updateProvider`            | `PUT /api/v1/settings/codex/config`, `/settings/github/pat`, `/settings/gitness/pat` | ≈   | Provider config is a credential blob, not a typed provider record. Plus a device-code login flow (`/settings/codex/login/{start,poll}`) T3 has no equivalent for.                                                      |
| `server.updateServer`              | —                                                                                    | ∅   | No self-update; Moatless is deployed, not updated in place. Nearest: `imageUpToDate` / `latestSandboxImage` in `SandboxStatusFullResponse` + `POST .../redeploy`, which updates the _sandbox_, not the server.         |
| `server.upsertKeybinding`          | —                                                                                    | ∅   | No keybindings.                                                                                                                                                                                                        |
| `server.removeKeybinding`          | —                                                                                    | ∅   | "                                                                                                                                                                                                                      |
| `server.discoverSourceControl`     | `GET /api/v1/settings/github/config`, `/settings/gitness/config`                     | ≈   | Reports which git host is connected; does not _discover_ local CLIs/credentials the way T3 does.                                                                                                                       |
| `server.getTraceDiagnostics`       | —                                                                                    | ∅   | No trace diagnostics endpoint.                                                                                                                                                                                         |
| `server.getProcessDiagnostics`     | `GET /api/sandbox/v1/tasks/{id}/status`                                              | ≈   | `SandboxStatusFullResponse` carries `backgroundProcesses`, `containerDiagnostics`, `scheduledJobs`, `runtimeEvents`. Real overlap — but scoped to one task's sandbox, not to the server process tree.                  |
| `server.getProcessResourceHistory` | `resources` field + `Resources` event type                                           | ≈   | Resource samples are emitted as events and carried on the status response. No history query with a window.                                                                                                             |
| `server.signalProcess`             | `POST .../restart`, `.../stop`, `.../servers/{name}/restart`                         | ≈   | Coarse lifecycle verbs instead of signalling a pid.                                                                                                                                                                    |

### 3.2 Orchestration (7)

| T3 method                                | Moatless                                                      |     |                                                                                                                                                                                                                                                                              |
| ---------------------------------------- | ------------------------------------------------------------- | --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `orchestration.dispatchCommand`          | ~15 REST routes                                               | ≈   | §5.                                                                                                                                                                                                                                                                          |
| `orchestration.subscribeShell` ◆         | `GET /api/v1/events/stream`                                   | ≈   | **The single biggest impedance mismatch.** One global NDJSON firehose over _all_ tasks, filterable only by `?types=`. No per-thread stream, no snapshot frame, no `afterSequence`, no `synchronized` marker. A subscriber filters client-side and re-fetches to build state. |
| `orchestration.subscribeThread` ◆        | same firehose, filtered by `taskId`                           | ≈   | " — plus the §6.1 split: the content-carrying `message.upsert` is never persisted, so it streams live but cannot be replayed after a gap.                                                                                                                                    |
| `orchestration.getArchivedShellSnapshot` | `GET /api/v1/tasks?status=closed`                             | =   | Closed tasks are the archive.                                                                                                                                                                                                                                                |
| `orchestration.getTurnDiff`              | —                                                             | ∅   | No per-turn diff. Nearest is the whole-workspace git overlay (§3.5), which is not turn-scoped.                                                                                                                                                                               |
| `orchestration.getFullThreadDiff`        | `GET /api/sandbox/v1/tasks/{id}/files/tree?includeGitChanges` | ≈   | Returns per-file `old_content` + additions/deletions across the workspace — a working-tree diff, which for a fresh task's sandbox is _approximately_ the thread diff. Diverges the moment the agent commits.                                                                 |
| `orchestration.replayEvents`             | `GET /api/v1/tasks/{id}/events/history?limit=`                | ≈   | Persisted events exist and are queryable — but by `limit` (default 500, max 2000), **not by cursor**. No `afterSequence`, so gapless replay is not expressible.                                                                                                              |

### 3.3 Terminal (9)

| T3 method                                                                         | Moatless |     |                                                                                                                                                                                                                                                                      |
| --------------------------------------------------------------------------------- | -------- | --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `terminal.open` / `attach` ◆ / `write` / `resize` / `clear` / `restart` / `close` | —        | ∅   | **No terminal, no PTY, no exec-into-sandbox surface.** The one adjacent thing is `crates/claude-agent-sdk/src/tmux/` — tmux is used _internally_ to host the agent process, and is not exposed on any API. The nearest user-facing analogue is log streaming (§3.4). |
| `subscribeTerminalEvents` ◆                                                       | —        | ∅   | "                                                                                                                                                                                                                                                                    |
| `subscribeTerminalMetadata` ◆                                                     | —        | ∅   | "                                                                                                                                                                                                                                                                    |

This is the largest wholesale gap in the contract: 9 of 70 methods with nothing behind them.

### 3.4 Preview and preview automation (12)

**These are two different things wearing the same word.** T3's `preview.*` is the
**in-app browser tab** — `PreviewSessionSnapshot` is `{threadId, tabId, navStatus,
canGoBack, canGoForward, viewport}`, and `apps/server/src/preview/Manager.ts` drives a
real web contents view. Moatless's "preview server" is the **process serving the app**.

In T3 the process side is a different subsystem entirely: a `ProjectScript` (from
`t3.json`) runs in a **terminal**, and `PortScanner.ts` discovers the resulting
listener — `DiscoveredLocalServer` carries `{host, port, url, processName, pid,
terminal: {threadId, terminalId}}`, linking the port back to the terminal that opened
it. Declared-vs-discovered is the real difference, and it lands on
`subscribeDiscoveredLocalServers`, not on `preview.open`.

| T3 method                           | Moatless                                           |     |                                                                                                                                                                                                                      |
| ----------------------------------- | -------------------------------------------------- | --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `preview.open`                      | —                                                  | ∅   | Opens a browser tab. Moatless's preview panel is client-side over `task.siteUrl`; there is no server-side browser session to open.                                                                                   |
| `preview.navigate`                  | —                                                  | ∅   | "                                                                                                                                                                                                                    |
| `preview.resize`                    | —                                                  | ∅   | "                                                                                                                                                                                                                    |
| `preview.refresh`                   | —                                                  | ∅   | Reloads the page. (`servers/{name}/restart` restarts the _process_ — a different operation, see the row below.)                                                                                                      |
| `preview.close`                     | —                                                  | ∅   | Closes the tab.                                                                                                                                                                                                      |
| `preview.list`                      | —                                                  | ∅   | Lists open tabs, not servers.                                                                                                                                                                                        |
| `preview.reportStatus`              | —                                                  | ∅   | Client→server nav-status report for the tab.                                                                                                                                                                         |
| `previewAutomation.connect` ◆       | —                                                  | ∅   | **No browser automation.** No accessibility tree, no tool-call bridge into the preview page.                                                                                                                         |
| `previewAutomation.respond`         | —                                                  | ∅   | "                                                                                                                                                                                                                    |
| `previewAutomation.focusHost`       | —                                                  | ∅   | "                                                                                                                                                                                                                    |
| `subscribePreviewEvents` ◆          | —                                                  | ∅   | Tab lifecycle events.                                                                                                                                                                                                |
| `subscribeDiscoveredLocalServers` ◆ | `GET .../server/status` + firehose `?types=server` | ≈   | **The one real correspondence in this group.** Both answer "what is serving, and is it up". T3 discovers by port-scanning a machine; Moatless reads a declared list per sandbox. Same answer, opposite epistemology. |
| —                                   | `GET/PATCH/DELETE .../servers[/{name}][/override]` | +   | Per-server start-command/env **override**, persisted to the workspace volume and applied by bumping a generation counter so the sidecar re-execs without recreating the pod. T3 has no equivalent live-reconfigure.  |
| —                                   | `GET .../servers/{name}/logs` (SSE)                | +   | Per-server log streaming. T3 gets this via terminal instead.                                                                                                                                                         |

> **Do not map against `packages/sandbox-api-contract`.** That package declares a
> richer sandbox HTTP surface — `/server/start`, `/server/stop`, `/command`,
> `/git-status`, `/git-changes`, `/git-diff`, `/current-commit-hash`,
> `/read-file-with-changes` — and **nothing imports it**. `grep` finds no source
> reference outside the package itself and `bun.lock`; the live sandbox surface is
> the 13-RPC gRPC `SandboxService` in `crates/sandbox-proto`, which has none of
> those. It is stale from before the gRPC cutover (last touched in the multi-repo
> merge, `29c334f`). Notably `/command` would have been the closest thing to a
> terminal, and `/git-diff` the closest to `getTurnDiff` — both are designed-for
> and not live.

### 3.5 Version control (12)

| T3 method                      | Moatless                                                                              |     |                                                                                                                                                                                   |
| ------------------------------ | ------------------------------------------------------------------------------------- | --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `subscribeVcsStatus` ◆         | —                                                                                     | ∅   | No live VCS status stream.                                                                                                                                                        |
| `vcs.refreshStatus`            | `GET .../files/tree?includeGitChanges`                                                | ≈   | The git overlay on the file tree carries additions/deletions/`old_content` per file — that is a _status-with-diff_, computed on demand, not a status object and not subscribable. |
| `vcs.listRefs`                 | `GET /api/v1/repositories/{id}/branches`                                              | ≈   | Branches only — no tags, no remotes, no worktree refs.                                                                                                                            |
| `vcs.pull`                     | —                                                                                     | ∅   | No pull. The sandbox clones once at provision; `POST .../redeploy` re-clones from scratch.                                                                                        |
| `vcs.init`                     | `POST /api/v1/repositories`                                                           | ≈   | Registers a repository connection; does not `git init` a directory.                                                                                                               |
| `vcs.createRef`                | —                                                                                     | ∅   | Branch is chosen at task creation (`CreateTaskRequest.branch`), never created through the API. The agent does it with the git CLI.                                                |
| `vcs.switchRef`                | —                                                                                     | ∅   | " — a task is pinned to its branch for life.                                                                                                                                      |
| `vcs.createWorktree`           | —                                                                                     | ∅   | **No worktrees.** Isolation is the sandbox, not the worktree — a Moatless task _is_ a disposable checkout, which is arguably the same idea implemented one level up.              |
| `vcs.removeWorktree`           | —                                                                                     | ∅   | "                                                                                                                                                                                 |
| `git.runStackedAction` ◆       | —                                                                                     | ∅   | No stacked-diff support.                                                                                                                                                          |
| `git.resolvePullRequest`       | `GET /api/v1/linear/lookup`; `github_pr` adapter                                      | ≈   | Moatless resolves _inbound_ PR/issue references through its adapter layer (webhook → task), rather than a client asking the server to resolve a PR ref.                           |
| `git.preparePullRequestThread` | `POST /api/v1/github/repos/{owner}/{repo}/pulls` + `POST /api/v1/tasks/{id}/bindings` | ≈   | Same outcome — a PR bound to a conversation — reached from the other direction. Moatless creates the PR _from_ a task and binds it; T3 creates a thread _from_ a PR.              |

### 3.6 Workspace, files, and hosts (12)

The strongest area of overlap in the whole contract.

| T3 method                         | Moatless                                                                  |     |                                                                                                                                                                                                                    |
| --------------------------------- | ------------------------------------------------------------------------- | --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `projects.listEntries`            | `GET /api/sandbox/v1/tasks/{id}/files/list`                               | =   |                                                                                                                                                                                                                    |
| `projects.readFile`               | `GET .../files/read`                                                      | =   |                                                                                                                                                                                                                    |
| `projects.searchEntries`          | `POST .../files/search-by-name`                                           | ≈   | **Name search only.** No content/grep search — T3's `searchEntries` covers both.                                                                                                                                   |
| `projects.writeFile`              | `POST .../files/write`                                                    | =   |                                                                                                                                                                                                                    |
| `filesystem.browse`               | —                                                                         | ∅   | T3 browses the _host_ filesystem to pick a project directory. Moatless has no host — everything is inside a sandbox, addressed by task id. Conceptually inapplicable.                                              |
| `assets.createUrl`                | `POST /api/v1/uploads` → `GET /api/v1/uploads/{file_id}`                  | ≈   | Both give a URL for attachment bytes. T3 mints a short-lived _token_ per asset; Moatless authorizes the download by session. Also flows into messages as `fileIds`, and to the sandbox over gRPC `DownloadUpload`. |
| `shell.openInEditor`              | —                                                                         | ∅   | No local editor to launch.                                                                                                                                                                                         |
| `review.getDiffPreview`           | —                                                                         | ∅   | No ephemeral diff-preview surface.                                                                                                                                                                                 |
| `sourceControl.lookupRepository`  | `POST /api/v1/repositories/{id}/verify-access`                            | ≈   | Verifies a _persisted_ repo's URL with the right credentials. T3 looks up an arbitrary URL before creating anything.                                                                                               |
| `sourceControl.cloneRepository`   | `POST /api/v1/repositories` + `POST /api/sandbox/v1/tasks/{id}/provision` | ≈   | Cloning is a side effect of provisioning a sandbox, not a client-callable operation.                                                                                                                               |
| `sourceControl.publishRepository` | —                                                                         | ∅   | No create-remote-repo. `POST .../convert-to-template` is unrelated.                                                                                                                                                |
| `subscribeAuthAccess` ◆           | —                                                                         | ∅   | No live auth/access stream.                                                                                                                                                                                        |

### 3.7 Server state and cloud (4)

| T3 method                    | Moatless                  |     |                                                                                                                                                                                                         |
| ---------------------------- | ------------------------- | --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `subscribeServerConfig` ◆    | —                         | ∅   | Config is fetched, never pushed.                                                                                                                                                                        |
| `subscribeServerLifecycle` ◆ | firehose `?types=sandbox` | ≈   | `SandboxStatus` (`NotCreated/Initializing/Ready/Stopped/Removing/Removed/Error`) is a real lifecycle stream — but it is the _sandbox's_ lifecycle, not the server's. Nothing streams backend lifecycle. |
| `cloud.getRelayClientStatus` | —                         | ∅   | No relay.                                                                                                                                                                                               |
| `cloud.installRelayClient` ◆ | —                         | ∅   | "                                                                                                                                                                                                       |

### 3.8 Tally

Counted off the tables above, group by group:

| Group                   | Total  | **=** | **≈**  | **∅**  |
| ----------------------- | ------ | ----- | ------ | ------ |
| Server meta             | 14     | 0     | 10     | 4      |
| Orchestration           | 7      | 1     | 5      | 1      |
| Terminal                | 9      | 0     | 0      | 9      |
| Preview + automation    | 12     | 0     | 1      | 11     |
| Version control         | 12     | 0     | 5      | 7      |
| Workspace, files, hosts | 12     | 3     | 4      | 5      |
| Server state and cloud  | 4      | 0     | 1      | 3      |
| **Total**               | **70** | **4** | **26** | **40** |

The 4 equivalents: `projects.listEntries`, `projects.readFile`, `projects.writeFile`,
`orchestration.getArchivedShellSnapshot`.

More than half the surface (40) has nothing behind it, and the largest contiguous
blocks are preview-the-browser (11), terminal (9), and version control (7).

---

## 4. The subscription contract

§5 of the contract doc lists three behavioural rules. Moatless satisfies none of them,
and this — not the missing methods — is the hard part of any second implementation.

| Rule                                                                               | Moatless                                                                                                                                                                                                                                             |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Snapshot resume** (`afterSequence` → skip snapshot, replay, then `synchronized`) | ∅ No sequence numbers on the live stream, no snapshot frame, no catch-up marker. `events/history` pages by `limit`, not by cursor, so a gapless resume cannot be expressed.                                                                          |
| **A subscription must not fail to signal absence**                                 | n/a — one firehose, so there is nothing per-subsystem to signal absence _of_. An adapter must synthesize the idle streams.                                                                                                                           |
| **Transport loss ≠ domain error**                                                  | ≈ SSE reconnection is the client's business; the server logs `SSE client lagged, skipping events` and drops frames. **Lag is silent data loss with no resume token** — an adapter cannot distinguish "nothing happened" from "you missed 40 events". |

The event taxonomy itself is well-formed and maps cleanly at the _type_ level:

| Moatless `EventType`                                                                                                                                           | T3 analogue                                                 |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `Task` (Created/Open/Closed/Updated/MetadataUpdated)                                                                                                           | thread lifecycle events                                     |
| `TaskTurn` (Active/Completed/Error/Stopped/Interrupted)                                                                                                        | turn lifecycle                                              |
| `Agent` (Started/Stopped/Message/Completed/Error/PendingResponse/SessionInit/Retrying/Scheduled/RecoveryStarted/RecoveryExhausted/SessionContextLost/Activity) | session status + activity                                   |
| `Message` (Upsert/SubagentProgress)                                                                                                                            | `message.upsert` — assembled, but never persisted, see §6.1 |
| `Sandbox` (7 statuses)                                                                                                                                         | `subscribeServerLifecycle`, loosely                         |
| `Server` (Installing/Starting/Started/Stopped/Failed)                                                                                                          | `subscribePreviewEvents`                                    |
| `Resources`                                                                                                                                                    | `getProcessResourceHistory`                                 |

Three Moatless agent sub-types have no T3 concept at all: `Retrying`,
`RecoveryStarted`/`RecoveryExhausted`, and `SessionContextLost`. T3 assumes a session
either runs or fails; Moatless models automatic recovery as a first-class state.

---

## 5. The command union (20 members)

| T3 command                    | Moatless                                                       |     |                                                                                                                                                                         |
| ----------------------------- | -------------------------------------------------------------- | --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `project.create`              | `POST /api/v1/repositories`                                    | ≈   | Also `POST /api/v1/workspaces` if the project is multi-repo.                                                                                                            |
| `project.meta.update`         | `PUT /api/v1/repositories/{id}`                                | =   |                                                                                                                                                                         |
| `project.delete`              | `DELETE /api/v1/repositories/{id}`                             | =   | Soft delete.                                                                                                                                                            |
| `thread.create`               | `POST /api/v1/tasks`                                           | =   | Richer: accepts `message`, `model`, `agentType`, `agentMode`, `branch`, `workspaceId`, `parentTaskId`, `fileIds`, `headless`.                                           |
| `thread.delete`               | `DELETE /api/v1/tasks/{id}`                                    | =   |                                                                                                                                                                         |
| `thread.archive`              | `POST /api/v1/tasks/{id}/close`                                | =   | Also stops the sandbox — a side effect T3's archive does not have.                                                                                                      |
| `thread.unarchive`            | `POST /api/v1/tasks/{id}/reopen`                               | =   |                                                                                                                                                                         |
| `thread.settle` / `.unsettle` | —                                                              | ∅   | No settle concept. Suppressible via `ExecutionEnvironmentCapabilities.threadSettlement`.                                                                                |
| `thread.snooze` / `.unsnooze` | —                                                              | ∅   | No snooze. Nearest in spirit: `PUT /api/v1/tasks/{id}/ttl` (idle TTL) — deferral by expiry, not by wake time. Suppressible via `threadSnooze`.                          |
| `thread.meta.update`          | `PATCH /api/v1/tasks/{id}`                                     | ≈   | Name/description. Tags and visibility are _separate_ routes (`PUT .../tags`, `PUT .../visibility`), so one T3 command fans out to three.                                |
| `thread.runtime-mode.set`     | —                                                              | ∅   | No runtime modes.                                                                                                                                                       |
| `thread.interaction-mode.set` | `agentMode` on `POST .../messages`                             | ≈   | Mode is set per-message, not as standalone thread state.                                                                                                                |
| `thread.turn.start`           | `POST /api/v1/tasks/{id}/messages`                             | =   | Carries `model`, `agentMode`, `contexts`, `fileIds`, `resume`, `startFresh`.                                                                                            |
| `thread.turn.interrupt`       | `POST /api/v1/tasks/{id}/stop`                                 | ≈   | Same call as session stop; Moatless does not separate the two.                                                                                                          |
| `thread.session.stop`         | `POST /api/v1/tasks/{id}/stop`                                 | ≈   | "                                                                                                                                                                       |
| `thread.approval.respond`     | —                                                              | ∅   | **No approval/permission-prompt API.** No `can_use_tool` bridge, no permission-request event. Agents run with their sandbox's permissions.                              |
| `thread.user-input.respond`   | `POST .../messages` with `{toolUseId, toolName, toolResponse}` | =   | Real equivalent, and better-signposted than the adapter plan assumed: `UiMessage.hasPendingUserInput` marks the waiting message, `GET .../messages/pending` lists them. |
| `thread.checkpoint.revert`    | —                                                              | ∅   | No checkpoints. `enable_file_checkpointing` exists as a Claude SDK flag in `crates/claude-agent-sdk` but is not surfaced on any API.                                    |

**14 of 20 have a home; 6 do not** (`settle`/`unsettle`, `snooze`/`unsnooze`,
`approval.respond`, `checkpoint.revert`, `runtime-mode.set` — 7 if you count the pair
members separately).

---

## 6. Things that are _kind of_ the same — read these before mapping

The `≈` rows above are not all equal. Five are actively misleading.

### 6.1 There are two message events, and only one carries content

Moatless emits both, and they are easy to confuse:

| Event            | Payload                                                          | Persisted?                              |
| ---------------- | ---------------------------------------------------------------- | --------------------------------------- |
| `agent.message`  | `{message:{role}, uuid, blockCount, toolNames}` — **no content** | yes, to `task_events`                   |
| `message.upsert` | an assembled `UiMessage`                                         | **no** — derived, UI-only, relayed live |

`agent.message` is deliberately content-free: ADR-0003 and migration
`0089_slim_agent_message_events.sql` rewrote historical rows to that skeleton, on the
rule that "a Message's content lives once, in `task_messages`" and the append-only log
must not keep a second copy.

`message.upsert` is T3's `message.upsert` almost exactly — "replaces-or-inserts an
assembled Message by `uuid`" (`crates/events/src/lib.rs:360`), published from
`backend/src/message/hooks.rs:212`. Text blocks arrive intact. What is _not_ intact:
`strip_heavy_fields` reduces each `tool_input` to a first-key preview (~100 chars),
truncates every `tool_result.content` to 200 chars, and drops `typed_result` and
`sdk_metadata`. Interactive tools — `ExitPlanMode`, `AskUserQuestion` — are exempt and
keep their input verbatim, which is what makes the plan/question UIs work without a
fetch.

So: streaming assembled content **is** possible; streaming full tool detail is not, and
a client that wants it must re-fetch. The sharper problem is the one below —
`EventType::Message` is never written to `task_events`, so the only content-carrying
event is also the only one that cannot be replayed.

### 6.2 "Settings" name the same thing and are not

T3 `ServerSettings` is one typed document with patch semantics, owned by the server.
Moatless settings are per-user credential blobs per provider, plus admin-only
instance-wide variants under `/api/v1/admin/settings/*`, plus `feature-flags`, plus
plugin activations. Mapping `getSettings`/`updateSettings` onto them produces a
document that does not exist and cannot be patched atomically.

### 6.3 A sandbox is not an environment

T3 assumes one environment hosting _many_ threads. Moatless gives **one sandbox per
task**, with its own lifecycle, TTL, cost, and stop reason. Anything T3 models as
server-wide — process diagnostics, preview servers, the file tree, VCS status — is in
Moatless _per-thread_. Every such method needs a `taskId` T3's signature does not carry.

### 6.4 Worktrees vs. sandboxes solve the same problem at different layers

T3 isolates parallel work with git worktrees under one server. Moatless isolates it
with a whole container per task. Same intent; `vcs.createWorktree` has no call to make
because the isolation already happened at provision time. Do not report this as a plain
feature gap — it is a different answer to the same question.

### 6.5 `agentType` is not `instanceId`

T3 provider instances are user-created records with per-instance config and credentials
(`providerInstance.ts`). Moatless `agentType` is a tag on a task; credentials are global
per user per provider. There is no per-instance configuration to carry, so a
round-trip through T3's model invents structure Moatless cannot store.

---

## 7. Moatless features with no T3 concept

Mapping in the other direction. These are the parts of Moatless a T3-shaped client
cannot express at all.

| Moatless                                       | What it is                                                                                                                                                              | Nearest T3                                                                        |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| **Loops** (6 endpoints)                        | Recurring/scheduled agent work, defined per repo in `.moatless/loops/`, spawning tasks on a schedule                                                                    | Nothing. Closest is the `/loop` skill, which is client-side.                      |
| **Adapters + task bindings** (9 + 6 endpoints) | Slack, Telegram, Linear, GitHub PR ingress/egress. Webhooks create tasks; `POST /tasks/{id}/reply`, `/messages/{id}/reactions` route replies back to the origin surface | Nothing. T3 threads have exactly one surface — the T3 client.                     |
| **Workspaces** (10 endpoints)                  | Multi-repo composition + run-config, git-declared (`.moatless/workspaces.json`) with manual override / reset-git provenance                                             | `t3.json`, but repo-local and not a server entity. Multi-root is unrepresentable. |
| **Sandbox lifecycle** (18 endpoints)           | provision / stop / restart / redeploy / cleanup, desired-state, TTL, stop reasons, image freshness                                                                      | Nothing — T3's server is always just there.                                       |
| **Teams & users** (17 endpoints)               | Teams, membership, admin user CRUD, per-provider user id mapping, scopes (`global` \| `user`), visibility (`public` \| `private`), follow/read state                    | Nothing. T3 is single-tenant per environment.                                     |
| **Plugins & skills** (9 endpoints)             | Server-side plugin registry with global-default + per-user activation, skills discovered per repository                                                                 | T3 has skills on disk; no registry, no activation model.                          |
| **Secrets** (7 endpoints)                      | Managed secrets, validated, resolved into sandboxes at start                                                                                                            | Env vars only.                                                                    |
| **Cost & statistics**                          | `totalCostUsd` per task; `/statistics` → `tokenTotals`, `messageTokenUsage`, `toolCalls`, `skills`                                                                      | T3 tracks usage per message with no total (contract correction #7).               |
| **Subagent transcripts**                       | `GET /tasks/{id}/tool-calls/{toolUseId}/messages` — the assembled inner transcript of an `Agent` tool call                                                              | T3 renders subagents inline; no addressable sub-transcript.                       |
| **Task relations**                             | `parentTaskId`, `relations[]`, `sourceTaskId` on messages                                                                                                               | No thread graph.                                                                  |
| **Feedback** (2 endpoints)                     | Per-task, per-message feedback rows                                                                                                                                     | Nothing.                                                                          |
| **Tags**                                       | Task tagging + `GET /api/v1/tags`                                                                                                                                       | Nothing.                                                                          |
| **Feature flags**                              | Per-deployment flags                                                                                                                                                    | `ExecutionEnvironmentCapabilities`, but that is negotiation, not toggling.        |
| **Device-code provider login**                 | `/settings/codex/login/{start,poll}`                                                                                                                                    | T3 stores credentials; no interactive flow.                                       |
| **Agent recovery**                             | `Retrying`, `RecoveryStarted/Exhausted`, `SessionContextLost`, `RecoverInterruptedRun` (gRPC)                                                                           | T3 sessions fail; they do not self-heal.                                          |

---

## 8. Corrections to `.plans/moatless-adapter.md`

Two claims in §2 of the adapter plan no longer hold against the current checkout.

1. **Correction #3 says "no `liveStatus` field and no live-status endpoint exists".**
   `GET /api/sandbox/v1/tasks/{task_id}/live-status` exists and returns
   `LiveStatus{agentStatus, sandboxStatus, sandboxError}` with
   `AgentStatus = running | idle | unknown`. Session status does **not** have to be
   derived from the event log.

2. **The §6.3 `notSupported (47)` table conflates "the adapter won't implement it"
   with "Moatless can't do it".** Six of those 47 have working Moatless endpoints
   today: `projects.{listEntries,readFile,writeFile}` (exact),
   `projects.searchEntries` (name-only), `vcs.listRefs` (branches only), and
   `vcs.refreshStatus` (via the file-tree git overlay). Six more are reachable with
   an extra call:
   `server.{getProcessDiagnostics,getProcessResourceHistory,signalProcess}`,
   `sourceControl.{lookupRepository,cloneRepository}`,
   `git.preparePullRequestThread`. Deferring them is a fine milestone decision —
   but the table should not be read as a capability assessment.

Also worth noting for §6.4: `thread.user-input.respond` is listed `[unverified]`.
The mechanism is explicit in the schema — `SendMessageRequest.{toolUseId, toolName,
toolResponse}` paired with `UiMessage.hasPendingUserInput` and
`GET /tasks/{id}/messages/pending` — so it is designed-for, not incidental.

---

## 9. Summary

|                                        |                                                                                                                                                                                                             |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Isomorphic**                         | Thread↔Task, Turn↔Turn, message send, file read/write/list, task lifecycle (create/close/reopen/delete), tool-result response                                                                               |
| **Shaped alike, different underneath** | subscriptions (firehose vs. per-thread resumable streams), settings, provider instances, project↔repository, diffs, PR flows                                                                                |
| **T3 has, Moatless does not**          | terminal, preview automation, checkpoints, worktrees, approvals, settle/snooze, keybindings, relay/T3 Connect, pairing, host filesystem browse, content search, capability negotiation, cursor-based replay |
| **Moatless has, T3 does not**          | loops, external adapters + bindings, workspaces (multi-repo), sandbox lifecycle, teams/users/visibility, plugins & skills registry, secrets, cost accounting, task relations, agent recovery                |

The load-bearing conclusion: the **domain** models line up well (a T3 thread really is
a Moatless task), the **capability** surface is about half-covered, and the
**streaming contract** is where the two designs are furthest apart — Moatless's single
unsequenced single firehose — whose only content-carrying event is unpersisted and
therefore unreplayable — cannot satisfy T3's resumable per-thread subscriptions
without an adapter that holds its own state.
