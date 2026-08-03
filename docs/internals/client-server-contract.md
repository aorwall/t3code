# Client ↔ Server Contract

Every byte exchanged between a T3 Code client (web, mobile, desktop renderer) and a T3
Code server is defined by schemas in [`packages/contracts`][contracts]. This document is
an index into that package: what the surfaces are, which file defines each type, and
which rules a second implementation has to honour.

The contract is TypeScript, not a generated spec. There is no OpenAPI document, no JSON
Schema dump, and no build step — `packages/contracts` exports `./src/*.ts` directly, so
server, web, mobile, and any adapter compile the same source. Conformance is checked by
`tsgo --noEmit`, not by validating against a document.

## Summary

|     | Surface                                          | Size                         | Defined in                       | Served by                            |
| --- | ------------------------------------------------ | ---------------------------- | -------------------------------- | ------------------------------------ |
| 1   | **`WsRpcGroup`** — Effect RPC over one WebSocket | **70 methods**, 14 streaming | [`rpc.ts:701`][rpc]              | [`apps/server/src/ws.ts:405`][ws]    |
| 2   | **`EnvironmentHttpApi`** — REST-ish HTTP         | **23 endpoints**, 4 groups   | [`environmentHttp.ts:553`][http] | [`server.ts:352`][routes]            |
| 3   | **Raw HTTP routes** — outside the typed API      | 4 routes                     | _(no schema)_                    | [`apps/server/src/http.ts`][rawhttp] |

Both typed surfaces are **exhaustively enforced**: `RpcGroup.toLayer` will not compile
unless the server implements all 70 methods, and `HttpApiBuilder.group` requires every
endpoint. A client cannot call a method the contract does not declare, and a server
cannot silently omit one.

Transport facts that are not negotiable, because the client hardcodes them
([`rpc/session.ts`][session]):

- Path `/ws`, one socket per environment, default port `3773`.
- `RpcSerialization.layerJson` — JSON framing, on both ends.
- The session is only `connected` after the socket opens **and** `server.getConfig`
  returns. A socket that opens but never answers is not a connection.

## 1. WebSocket — `WsRpcGroup`

Method names live in two constant objects; the wire uses the string values.

- [`WS_METHODS`][ws_methods] (`rpc.ts:150`) — 63 methods
- [`ORCHESTRATION_WS_METHODS`][orch_methods] (`orchestration.ts:25`) — 7 methods

Each method declares `payload`, `success`, `error`, and optionally `stream: true`. Errors
are part of the contract: every method can fail with
[`EnvironmentAuthorizationError`][autherr] on top of its domain errors. Streaming methods
return an Effect `Stream`; unary methods return an `Effect`.

**Fork addition.** Methods no environment in this deployment serves also declare
[`UnsupportedMethodError`][unsupportederr] — 47 of them today. It is not on every method,
deliberately: the list is a statement about the surface, so adding a method to it says
nobody answers it and removing one says somebody now does. Without a declared error an
absent method can only answer with a defect, and a defect does not decode into anything
the client can read a message off — the person gets "unexpected server error", which is
also what a genuine crash looks like. See §8 and
`docs/fork/upstream-merge-inventory.md`.

Every method also carries a required authorization scope, enforced server-side by
`RPC_REQUIRED_SCOPE` ([`ws.ts:288`][scopemap]) — a `Map` the server throws on if a method
is missing, so a new RPC cannot ship unscoped. Scopes are defined in
[`auth.ts:84`][scopes]; `read` is `orchestration:read`, `operate` is
`orchestration:operate`, and the rest are named in full below.

### Server meta — 14 methods

| Method                             | Payload → Success                                                | Scope   | Line                                            |
| ---------------------------------- | ---------------------------------------------------------------- | ------- | ----------------------------------------------- |
| `server.probe`                     | `{}` → `{}`                                                      | read    | [254](../../packages/contracts/src/rpc.ts#L254) |
| `server.getConfig`                 | `{}` → [`ServerConfig`][serverconfig]                            | read    | [260](../../packages/contracts/src/rpc.ts#L260) |
| `server.getSettings`               | `{}` → [`ServerSettings`][settings]                              | read    | [292](../../packages/contracts/src/rpc.ts#L292) |
| `server.updateSettings`            | `{patch: ServerSettingsPatch}` → `ServerSettings`                | operate | [298](../../packages/contracts/src/rpc.ts#L298) |
| `server.refreshProviders`          | `{instanceId?}` → `ServerProviderUpdatedPayload`                 | operate | [266](../../packages/contracts/src/rpc.ts#L266) |
| `server.updateProvider`            | `ServerProviderUpdateInput` → `ServerProviderUpdatedPayload`     | operate | [280](../../packages/contracts/src/rpc.ts#L280) |
| `server.updateServer`              | [`ServerSelfUpdateInput`][selfupdate] → `ServerSelfUpdateResult` | operate | [286](../../packages/contracts/src/rpc.ts#L286) |
| `server.upsertKeybinding`          | `ServerUpsertKeybindingInput` → `ServerUpsertKeybindingResult`   | operate | [242](../../packages/contracts/src/rpc.ts#L242) |
| `server.removeKeybinding`          | `ServerRemoveKeybindingInput` → `ServerRemoveKeybindingResult`   | operate | [248](../../packages/contracts/src/rpc.ts#L248) |
| `server.discoverSourceControl`     | `{}` → `SourceControlDiscoveryResult`                            | read    | [304](../../packages/contracts/src/rpc.ts#L304) |
| `server.getTraceDiagnostics`       | `{}` → `ServerTraceDiagnosticsResult`                            | read    | [310](../../packages/contracts/src/rpc.ts#L310) |
| `server.getProcessDiagnostics`     | `{}` → `ServerProcessDiagnosticsResult`                          | read    | [316](../../packages/contracts/src/rpc.ts#L316) |
| `server.getProcessResourceHistory` | `ServerProcessResourceHistoryInput` → `…Result`                  | read    | [322](../../packages/contracts/src/rpc.ts#L322) |
| `server.signalProcess`             | `ServerSignalProcessInput` → `ServerSignalProcessResult`         | operate | [331](../../packages/contracts/src/rpc.ts#L331) |

Types: [`server.ts`][serverts], [`settings.ts`][settingsts], [`keybindings.ts`][kb].

### Orchestration — 7 methods

The whole session/thread domain. Reads and subscriptions are separate methods; **all
writes go through one method**, `orchestration.dispatchCommand`.

| Method                                   | Payload → Success                                                                   | Scope   | Line                                            |
| ---------------------------------------- | ----------------------------------------------------------------------------------- | ------- | ----------------------------------------------- |
| `orchestration.dispatchCommand`          | [`ClientOrchestrationCommand`][cmds] → [`DispatchResult`][dispatchresult]           | operate | [610](../../packages/contracts/src/rpc.ts#L610) |
| `orchestration.subscribeShell` ◆         | `OrchestrationSubscribeShellInput` → [`OrchestrationShellStreamItem`][shellitem]    | read    | [649](../../packages/contracts/src/rpc.ts#L649) |
| `orchestration.subscribeThread` ◆        | `OrchestrationSubscribeThreadInput` → [`OrchestrationThreadStreamItem`][threaditem] | read    | [656](../../packages/contracts/src/rpc.ts#L656) |
| `orchestration.getArchivedShellSnapshot` | `{}` → [`OrchestrationShellSnapshot`][shellsnap]                                    | read    | [640](../../packages/contracts/src/rpc.ts#L640) |
| `orchestration.getTurnDiff`              | `OrchestrationGetTurnDiffInput` → `…Result`                                         | read    | [619](../../packages/contracts/src/rpc.ts#L619) |
| `orchestration.getFullThreadDiff`        | `OrchestrationGetFullThreadDiffInput` → `…Result`                                   | read    | [625](../../packages/contracts/src/rpc.ts#L625) |
| `orchestration.replayEvents`             | `OrchestrationReplayEventsInput` → `…Result`                                        | read    | [634](../../packages/contracts/src/rpc.ts#L634) |

Input/output pairs are also grouped in one place for convenience:
[`OrchestrationRpcSchemas`][rpcschemas] (`orchestration.ts:1374`).

**Fork addition.** `OrchestrationMessage` and `ThreadMessageSentPayload` each carry an
optional `origin` — where a message came from when it did not come from the composer, as
`OrchestrationMessageOrigin` (`kind`, `label`, `url`, `user`). A Moatless Task takes
messages from Slack, GitHub PRs, Linear, Telegram and other Tasks; a T3 thread has one
source, so upstream has no such field. It is optional rather than nullable, which is what
makes it free for a second implementation: a server that never sets it emits exactly the
payload upstream emits, and a client that does not read it is unaffected. See
`docs/fork/upstream-merge-inventory.md`.

### Terminal — 9 methods

| Method                        | Payload → Success                                                 | Scope            | Line                                            |
| ----------------------------- | ----------------------------------------------------------------- | ---------------- | ----------------------------------------------- |
| `terminal.open`               | `TerminalOpenInput` → [`TerminalSessionSnapshot`][termsnap]       | terminal:operate | [498](../../packages/contracts/src/rpc.ts#L498) |
| `terminal.attach` ◆           | `TerminalAttachInput` → [`TerminalAttachStreamEvent`][termattach] | terminal:operate | [504](../../packages/contracts/src/rpc.ts#L504) |
| `terminal.write`              | `TerminalWriteInput` → void                                       | terminal:operate | [511](../../packages/contracts/src/rpc.ts#L511) |
| `terminal.resize`             | `TerminalResizeInput` → void                                      | terminal:operate | [516](../../packages/contracts/src/rpc.ts#L516) |
| `terminal.clear`              | `TerminalClearInput` → void                                       | terminal:operate | [521](../../packages/contracts/src/rpc.ts#L521) |
| `terminal.restart`            | `TerminalRestartInput` → `TerminalSessionSnapshot`                | terminal:operate | [526](../../packages/contracts/src/rpc.ts#L526) |
| `terminal.close`              | `TerminalCloseInput` → void                                       | terminal:operate | [532](../../packages/contracts/src/rpc.ts#L532) |
| `subscribeTerminalEvents` ◆   | `{}` → [`TerminalEvent`][termevent]                               | terminal:operate | [666](../../packages/contracts/src/rpc.ts#L666) |
| `subscribeTerminalMetadata` ◆ | `{}` → [`TerminalMetadataStreamEvent`][termmeta]                  | terminal:operate | [673](../../packages/contracts/src/rpc.ts#L673) |

Types: [`terminal.ts`][termts].

### Preview and preview automation — 12 methods

| Method                              | Payload → Success                                         | Scope   | Line                                            |
| ----------------------------------- | --------------------------------------------------------- | ------- | ----------------------------------------------- |
| `preview.open`                      | `PreviewOpenInput` → [`PreviewSessionSnapshot`][prevsnap] | operate | [537](../../packages/contracts/src/rpc.ts#L537) |
| `preview.navigate`                  | `PreviewNavigateInput` → `PreviewSessionSnapshot`         | operate | [543](../../packages/contracts/src/rpc.ts#L543) |
| `preview.resize`                    | `PreviewResizeInput` → `PreviewSessionSnapshot`           | operate | [549](../../packages/contracts/src/rpc.ts#L549) |
| `preview.refresh`                   | `PreviewRefreshInput` → void                              | operate | [555](../../packages/contracts/src/rpc.ts#L555) |
| `preview.close`                     | `PreviewCloseInput` → void                                | operate | [560](../../packages/contracts/src/rpc.ts#L560) |
| `preview.list`                      | `PreviewListInput` → `PreviewListResult`                  | read    | [565](../../packages/contracts/src/rpc.ts#L565) |
| `preview.reportStatus`              | `PreviewReportStatusInput` → void                         | operate | [571](../../packages/contracts/src/rpc.ts#L571) |
| `previewAutomation.connect` ◆       | `PreviewAutomationHost` → `PreviewAutomationStreamEvent`  | operate | [576](../../packages/contracts/src/rpc.ts#L576) |
| `previewAutomation.respond`         | `PreviewAutomationResponse` → void                        | operate | [583](../../packages/contracts/src/rpc.ts#L583) |
| `previewAutomation.focusHost`       | `PreviewAutomationHostFocus` → void                       | operate | [588](../../packages/contracts/src/rpc.ts#L588) |
| `subscribePreviewEvents` ◆          | `{}` → [`PreviewEvent`][prevevent]                        | read    | [593](../../packages/contracts/src/rpc.ts#L593) |
| `subscribeDiscoveredLocalServers` ◆ | `{}` → [`DiscoveredLocalServerList`][discovered]          | read    | [600](../../packages/contracts/src/rpc.ts#L600) |

Types: [`preview.ts`][prevts], [`previewAutomation.ts`][prevauto].

### Version control — 12 methods

| Method                         | Payload → Success                                                    | Scope   | Line                                            |
| ------------------------------ | -------------------------------------------------------------------- | ------- | ----------------------------------------------- |
| `subscribeVcsStatus` ◆         | `VcsStatusInput` → [`VcsStatusStreamEvent`][vcsstream]               | read    | [415](../../packages/contracts/src/rpc.ts#L415) |
| `vcs.refreshStatus`            | `VcsStatusInput` → `VcsStatusResult`                                 | read    | [428](../../packages/contracts/src/rpc.ts#L428) |
| `vcs.listRefs`                 | `VcsListRefsInput` → `VcsListRefsResult`                             | read    | [453](../../packages/contracts/src/rpc.ts#L453) |
| `vcs.pull`                     | `VcsPullInput` → `VcsPullResult`                                     | operate | [422](../../packages/contracts/src/rpc.ts#L422) |
| `vcs.init`                     | `VcsInitInput` → void                                                | operate | [482](../../packages/contracts/src/rpc.ts#L482) |
| `vcs.createRef`                | `VcsCreateRefInput` → `VcsCreateRefResult`                           | operate | [470](../../packages/contracts/src/rpc.ts#L470) |
| `vcs.switchRef`                | `VcsSwitchRefInput` → `VcsSwitchRefResult`                           | operate | [476](../../packages/contracts/src/rpc.ts#L476) |
| `vcs.createWorktree`           | `VcsCreateWorktreeInput` → `VcsCreateWorktreeResult`                 | operate | [459](../../packages/contracts/src/rpc.ts#L459) |
| `vcs.removeWorktree`           | `VcsRemoveWorktreeInput` → void                                      | operate | [465](../../packages/contracts/src/rpc.ts#L465) |
| `git.runStackedAction` ◆       | `GitRunStackedActionInput` → [`GitActionProgressEvent`][gitprogress] | operate | [434](../../packages/contracts/src/rpc.ts#L434) |
| `git.resolvePullRequest`       | `GitPullRequestRefInput` → `GitResolvePullRequestResult`             | operate | [441](../../packages/contracts/src/rpc.ts#L441) |
| `git.preparePullRequestThread` | `GitPreparePullRequestThreadInput` → `…Result`                       | operate | [447](../../packages/contracts/src/rpc.ts#L447) |

Types: [`git.ts`][gitts], [`vcs.ts`][vcsts].

### Workspace, files, and hosts — 12 methods

| Method                            | Payload → Success                                                    | Scope        | Line                                            |
| --------------------------------- | -------------------------------------------------------------------- | ------------ | ----------------------------------------------- |
| `projects.listEntries`            | `ProjectListEntriesInput` → `ProjectListEntriesResult`               | read         | [380](../../packages/contracts/src/rpc.ts#L380) |
| `projects.readFile`               | `ProjectReadFileInput` → `ProjectReadFileResult`                     | read         | [386](../../packages/contracts/src/rpc.ts#L386) |
| `projects.searchEntries`          | `ProjectSearchEntriesInput` → `ProjectSearchEntriesResult`           | read         | [374](../../packages/contracts/src/rpc.ts#L374) |
| `projects.writeFile`              | `ProjectWriteFileInput` → `ProjectWriteFileResult`                   | operate      | [392](../../packages/contracts/src/rpc.ts#L392) |
| `filesystem.browse`               | `FilesystemBrowseInput` → `FilesystemBrowseResult`                   | read         | [403](../../packages/contracts/src/rpc.ts#L403) |
| `assets.createUrl`                | `AssetCreateUrlInput` → `AssetCreateUrlResult`                       | read         | [409](../../packages/contracts/src/rpc.ts#L409) |
| `shell.openInEditor`              | `LaunchEditorInput` → void                                           | operate      | [398](../../packages/contracts/src/rpc.ts#L398) |
| `review.getDiffPreview`           | `ReviewDiffPreviewInput` → `ReviewDiffPreviewResult`                 | review:write | [492](../../packages/contracts/src/rpc.ts#L492) |
| `sourceControl.lookupRepository`  | `SourceControlRepositoryLookupInput` → `SourceControlRepositoryInfo` | read         | [350](../../packages/contracts/src/rpc.ts#L350) |
| `sourceControl.cloneRepository`   | `SourceControlCloneRepositoryInput` → `…Result`                      | operate      | [359](../../packages/contracts/src/rpc.ts#L359) |
| `sourceControl.publishRepository` | `SourceControlPublishRepositoryInput` → `…Result`                    | operate      | [365](../../packages/contracts/src/rpc.ts#L365) |
| `subscribeAuthAccess` ◆           | `{}` → [`AuthAccessStreamEvent`][authstream]                         | access:read  | [694](../../packages/contracts/src/rpc.ts#L694) |

Types: [`project.ts`][projectts], [`filesystem.ts`][fsts], [`assets.ts`][assetsts],
[`editor.ts`][editorts], [`review.ts`][reviewts], [`sourceControl.ts`][scts].

### Server state and cloud — 4 methods

| Method                       | Payload → Success                                | Scope       | Line                                            |
| ---------------------------- | ------------------------------------------------ | ----------- | ----------------------------------------------- |
| `subscribeServerConfig` ◆    | `{}` → [`ServerConfigStreamEvent`][configstream] | read        | [680](../../packages/contracts/src/rpc.ts#L680) |
| `subscribeServerLifecycle` ◆ | `{}` → [`ServerLifecycleStreamEvent`][lifecycle] | read        | [687](../../packages/contracts/src/rpc.ts#L687) |
| `cloud.getRelayClientStatus` | `{}` → `RelayClientStatus`                       | relay:write | [337](../../packages/contracts/src/rpc.ts#L337) |
| `cloud.installRelayClient` ◆ | `{}` → `RelayClientInstallProgressEvent`         | relay:write | [343](../../packages/contracts/src/rpc.ts#L343) |

Types: [`server.ts`][serverts], [`relayClient.ts`][relayclientts].

## 2. The command union — writes inside `dispatchCommand`

`orchestration.dispatchCommand` accepts [`ClientOrchestrationCommand`][cmds], a 20-member
tagged union (`orchestration.ts:774`). This is a second contract layer inside the first:
adding a mutation means adding a union member, not an RPC method.

| `type`                        | Schema                            | Line                                                      |
| ----------------------------- | --------------------------------- | --------------------------------------------------------- |
| `project.create`              | `ProjectCreateCommand`            | [516](../../packages/contracts/src/orchestration.ts#L516) |
| `project.meta.update`         | `ProjectMetaUpdateCommand`        | [527](../../packages/contracts/src/orchestration.ts#L527) |
| `project.delete`              | `ProjectDeleteCommand`            | [537](../../packages/contracts/src/orchestration.ts#L537) |
| `thread.create`               | `ThreadCreateCommand`             | [544](../../packages/contracts/src/orchestration.ts#L544) |
| `thread.delete`               | `ThreadDeleteCommand`             | [560](../../packages/contracts/src/orchestration.ts#L560) |
| `thread.archive`              | `ThreadArchiveCommand`            | [566](../../packages/contracts/src/orchestration.ts#L566) |
| `thread.unarchive`            | `ThreadUnarchiveCommand`          | [572](../../packages/contracts/src/orchestration.ts#L572) |
| `thread.settle`               | `ThreadSettleCommand`             | [578](../../packages/contracts/src/orchestration.ts#L578) |
| `thread.unsettle`             | `ThreadUnsettleCommand`           | [584](../../packages/contracts/src/orchestration.ts#L584) |
| `thread.snooze`               | `ThreadSnoozeCommand`             | [594](../../packages/contracts/src/orchestration.ts#L594) |
| `thread.unsnooze`             | `ThreadUnsnoozeCommand`           | [604](../../packages/contracts/src/orchestration.ts#L604) |
| `thread.meta.update`          | `ThreadMetaUpdateCommand`         | [615](../../packages/contracts/src/orchestration.ts#L615) |
| `thread.runtime-mode.set`     | `ThreadRuntimeModeSetCommand`     | [626](../../packages/contracts/src/orchestration.ts#L626) |
| `thread.interaction-mode.set` | `ThreadInteractionModeSetCommand` | [634](../../packages/contracts/src/orchestration.ts#L634) |
| `thread.turn.start`           | `ClientThreadTurnStartCommand`    | [689](../../packages/contracts/src/orchestration.ts#L689) |
| `thread.turn.interrupt`       | `ThreadTurnInterruptCommand`      | [708](../../packages/contracts/src/orchestration.ts#L708) |
| `thread.approval.respond`     | `ThreadApprovalRespondCommand`    | [716](../../packages/contracts/src/orchestration.ts#L716) |
| `thread.user-input.respond`   | `ThreadUserInputRespondCommand`   | [725](../../packages/contracts/src/orchestration.ts#L725) |
| `thread.checkpoint.revert`    | `ThreadCheckpointRevertCommand`   | [734](../../packages/contracts/src/orchestration.ts#L734) |
| `thread.session.stop`         | `ThreadSessionStopCommand`        | [742](../../packages/contracts/src/orchestration.ts#L742) |

Every command carries a client-generated `commandId` (and usually `createdAt`) for
idempotency. The client never hand-builds these; it calls the typed constructors in
[`client-runtime/src/operations/commands.ts`][opscmds], which fill in the metadata.

The server's internal union is wider (e.g. `thread.session.set`,
`thread.activity.append`) — those are server-authored and **not** dispatchable by
clients. `ClientOrchestrationCommand` is the client-facing subset.

## 3. HTTP — `EnvironmentHttpApi`

Four groups, 23 endpoints ([`environmentHttp.ts:553`][http]). Endpoints marked ✓ carry
`.middleware(EnvironmentAuthenticatedAuth)` ([`environmentHttp.ts:318`][authmw]).

### `metadata` — 1 endpoint, unauthenticated

| Endpoint                          | Success                                        | Line                                                        |
| --------------------------------- | ---------------------------------------------- | ----------------------------------------------------------- |
| `GET /.well-known/t3/environment` | [`ExecutionEnvironmentDescriptor`][descriptor] | [375](../../packages/contracts/src/environmentHttp.ts#L375) |

This is the discovery endpoint. A client fetches it before connecting to learn the
environment's id, label, `serverVersion`, and capabilities.

### `auth` — 10 endpoints

| Endpoint                               | Success                               | Auth | Line                                                        |
| -------------------------------------- | ------------------------------------- | ---- | ----------------------------------------------------------- |
| `GET /api/auth/session`                | [`AuthSessionState`][sessionstate]    |      | [382](../../packages/contracts/src/environmentHttp.ts#L382) |
| `POST /api/auth/browser-session`       | `AuthBrowserSessionResult`            |      | [389](../../packages/contracts/src/environmentHttp.ts#L389) |
| `POST /oauth/token`                    | `AuthAccessTokenResult`               |      | [396](../../packages/contracts/src/environmentHttp.ts#L396) |
| `POST /api/auth/websocket-ticket`      | [`AuthWebSocketTicketResult`][ticket] | ✓    | [404](../../packages/contracts/src/environmentHttp.ts#L404) |
| `POST /api/auth/pairing-token`         | `AuthPairingCredentialResult`         | ✓    | [411](../../packages/contracts/src/environmentHttp.ts#L411) |
| `GET /api/auth/pairing-links`          | `AuthPairingLink[]`                   | ✓    | [419](../../packages/contracts/src/environmentHttp.ts#L419) |
| `POST /api/auth/pairing-links/revoke`  | `AuthPairingLinkRevokeResult`         | ✓    | [426](../../packages/contracts/src/environmentHttp.ts#L426) |
| `GET /api/auth/clients`                | `AuthClientSession[]`                 | ✓    | [434](../../packages/contracts/src/environmentHttp.ts#L434) |
| `POST /api/auth/clients/revoke`        | `AuthClientSessionRevokeResult`       | ✓    | [441](../../packages/contracts/src/environmentHttp.ts#L441) |
| `POST /api/auth/clients/revoke-others` | `AuthOtherClientSessionsRevokeResult` | ✓    | [449](../../packages/contracts/src/environmentHttp.ts#L449) |

`/api/auth/websocket-ticket` exists because browsers cannot set headers on a WebSocket
upgrade. The client mints a short-lived ticket over HTTP and passes it as `?wsTicket=`;
the server accepts it at upgrade ([`EnvironmentAuth.ts:936`][wsauth]) and otherwise falls
back to `Authorization: Bearer`/`DPoP`. Per-method scopes are still checked on every RPC.

Types: [`auth.ts`][authts]. Served by [`apps/server/src/auth/http.ts:200`][authimpl].

### `orchestration` — 4 endpoints, all authenticated

| Endpoint                                   | Success                                           | Line                                                        |
| ------------------------------------------ | ------------------------------------------------- | ----------------------------------------------------------- |
| `GET /api/orchestration/shell`             | [`OrchestrationShellSnapshot`][shellsnap]         | [469](../../packages/contracts/src/environmentHttp.ts#L469) |
| `GET /api/orchestration/threads/:threadId` | [`OrchestrationThreadDetailSnapshot`][threadsnap] | [476](../../packages/contracts/src/environmentHttp.ts#L476) |
| `GET /api/orchestration/snapshot`          | [`OrchestrationReadModel`][readmodel]             | [462](../../packages/contracts/src/environmentHttp.ts#L462) |
| `POST /api/orchestration/dispatch`         | [`DispatchResult`][dispatchresult]                | [484](../../packages/contracts/src/environmentHttp.ts#L484) |

These deliberately duplicate WebSocket capability. The shell and thread snapshots are
fetched over HTTP so a large payload is gzipped by the transport instead of framed on the
socket; the client then subscribes with `afterSequence` to resume without a gap. See
[Snapshot resume](#snapshot-resume).

Served by [`apps/server/src/orchestration/http.ts:21`][orchimpl].

### `connect` — 8 endpoints (T3 Connect / relay)

| Endpoint                               | Success                             | Auth | Line                                                        |
| -------------------------------------- | ----------------------------------- | ---- | ----------------------------------------------------------- |
| `POST /api/connect/link-proof`         | `RelayEnvironmentLinkProof`         | ✓    | [494](../../packages/contracts/src/environmentHttp.ts#L494) |
| `POST /api/connect/relay-config`       | `EnvironmentCloudRelayConfigResult` | ✓    | [502](../../packages/contracts/src/environmentHttp.ts#L502) |
| `GET /api/connect/link-state`          | `EnvironmentCloudLinkStateResult`   | ✓    | [510](../../packages/contracts/src/environmentHttp.ts#L510) |
| `POST /api/connect/unlink`             | `EnvironmentCloudRelayConfigResult` | ✓    | [517](../../packages/contracts/src/environmentHttp.ts#L517) |
| `POST /api/connect/preferences`        | `EnvironmentCloudLinkStateResult`   | ✓    | [524](../../packages/contracts/src/environmentHttp.ts#L524) |
| `POST /api/t3-connect/health`          | `RelayEnvironmentHealthResponse`    |      | [532](../../packages/contracts/src/environmentHttp.ts#L532) |
| `POST /api/connect/mint-credential`    | `RelayEnvironmentMintResponse`      |      | [539](../../packages/contracts/src/environmentHttp.ts#L539) |
| `POST /api/t3-connect/mint-credential` | `RelayEnvironmentMintResponse`      |      | [546](../../packages/contracts/src/environmentHttp.ts#L546) |

Served by [`apps/server/src/cloud/http.ts:946`][connectimpl].

### HTTP error model

Six tagged errors with fixed statuses, shared by every group
([`environmentHttp.ts`][http]):

| Error                                | Status | Line                                                        |
| ------------------------------------ | ------ | ----------------------------------------------------------- |
| `EnvironmentRequestInvalidError`     | 400    | [91](../../packages/contracts/src/environmentHttp.ts#L91)   |
| `EnvironmentAuthInvalidError`        | 401    | [105](../../packages/contracts/src/environmentHttp.ts#L105) |
| `EnvironmentScopeRequiredError`      | 403    | [119](../../packages/contracts/src/environmentHttp.ts#L119) |
| `EnvironmentOperationForbiddenError` | 403    | [133](../../packages/contracts/src/environmentHttp.ts#L133) |
| `EnvironmentResourceNotFoundError`   | 404    | [164](../../packages/contracts/src/environmentHttp.ts#L164) |
| `EnvironmentInternalError`           | 500    | [147](../../packages/contracts/src/environmentHttp.ts#L147) |

`EnvironmentHttpCommonError` ([178](../../packages/contracts/src/environmentHttp.ts#L178)) is the union clients match on.

## 4. Handshake and version negotiation

The contract ships separately to browsers and servers, so it is **negotiated, never
assumed**. `server.getConfig` returns [`ServerConfig`][serverconfig] (`server.ts:410`):

```
ServerConfig
├── environment: ExecutionEnvironmentDescriptor   ← environment.ts:57
│   ├── environmentId, label, platform, serverVersion
│   └── capabilities: ExecutionEnvironmentCapabilities   ← environment.ts:40
├── auth: ServerAuthDescriptor
├── providers: ServerProviders                    ← server.ts:196
├── settings: ServerSettings                      ← settings.ts:400
├── keybindings, keybindingsConfigPath, availableEditors, cwd
├── issues: ServerConfigIssues
├── observability
├── shellResumeCompletionMarker?: boolean
└── threadResumeCompletionMarker?: boolean
```

Rules a second implementation must follow:

1. **Absent capability means unsupported.** `connectionProbe`, `threadSettlement`,
   `threadSnooze`, and `serverSelfUpdate` are `optionalKey`, so an old server simply omits
   them; `repositoryIdentity` decodes to `false` when absent. A client talking to a server
   without `threadSettlement` must not send `thread.settle`.
2. **Protocol refinements are flagged, not versioned.**
   `shellResumeCompletionMarker` / `threadResumeCompletionMarker` gate the `synchronized`
   catch-up marker; the client reads the flag before choosing its subscribe input
   ([`state/shell.ts:183`][shellstate]).
3. **Wire legacy is absorbed on decode, not branched in code.** `ModelSelection`
   ([`orchestration.ts:81`][modelsel]) promotes the pre-instance-split `{provider, model}`
   shape to `{instanceId, model}` during decoding.

## 5. Subscription semantics

Beyond types, three behavioural rules are load-bearing. A schema-correct server that
breaks them will put clients into a retry loop.

### Snapshot resume

Shell and thread subscriptions accept `afterSequence`. When present, the server **skips
the initial snapshot frame** and replays events after that sequence before going live.
Stream items are `snapshot | <event> | synchronized`
([`OrchestrationShellStreamItem`][shellitem], `orchestration.ts:462`), and the client
dedupes overlapping events by `sequence`.

A server must attach its live event buffer _before_ querying the snapshot, or an event
published mid-query is lost — past the snapshot's sequence but before the subscription
attached ([`ws.ts:1226`][ws] documents this).

### A subscription must not fail to signal absence

The client retries failed subscriptions on a timer. A server that has no analogue for a
subsystem must return an **idle stream**, not an error — otherwise an absent feature
becomes a permanent reconnect loop. See [`moatless-adapter/src/rpc.ts`][adapterrpc].

### Transport loss is not a domain error

A stream failing with `RpcClientError` is treated as transport loss: the subscription
waits for the next session and re-subscribes, keeping the transport healthy
([`rpc/client.ts:201`][rpcclient]). Domain failures instead set a per-domain sync error.
A healthy socket with a failed shell subscription is shown as _connected with a sync
error_, not as a reconnect.

## 6. What is not in the contract

Genuine exceptions, listed so "fully typed" is not overclaimed.

**Raw HTTP routes** — served by the same port, no schema
([`apps/server/src/http.ts`][rawhttp]):

| Route                               | Purpose                                                               |
| ----------------------------------- | --------------------------------------------------------------------- |
| `GET /ws`                           | The RPC upgrade itself ([`ws.ts:2086`][ws])                           |
| `GET ${ASSET_ROUTE_PREFIX}/*`       | Attachment bytes, authorized by a token minted via `assets.createUrl` |
| `POST /api/observability/v1/traces` | Browser OTLP trace proxy                                              |
| `GET *`                             | Static web app, or redirect to the Vite dev server                    |

**Adjacent contracts** — typed, but different boundaries:

| Contract    | File                                | Boundary                                                            |
| ----------- | ----------------------------------- | ------------------------------------------------------------------- |
| Desktop IPC | [`ipc.ts`][ipcts] (1,288 lines)     | browser ↔ Electron (`window.desktopBridge`)                         |
| Relay       | [`relay.ts`][relayts] (1,040 lines) | client ↔ relay ↔ server; the only module with `OpenApi` annotations |
| MCP         | _(no schema here)_                  | agents ↔ server at `/mcp` ([`McpHttpServer.ts:214`][mcp])           |

**Typed envelopes with untyped cargo** — `Schema.Unknown` where the payload is
provider- or driver-specific: `providerRuntime.ts` (`payload`, `item`, `resume`),
`providerInstance.ts:130` (`config`), `previewAutomation.ts` (`accessibilityTree`, tool
`input`/`result`), `environmentHttp.ts:257` (`endpointRuntimeStatus`).

## 7. File index

31 files, 11,903 lines. The 30 below plus `index.ts` (29 lines), a barrel re-exporting all
of them; `settings` and `relay` also have dedicated subpath exports.

| File                               | Lines | Contents                                                                    |
| ---------------------------------- | ----- | --------------------------------------------------------------------------- |
| [`rpc.ts`][rpc]                    | 772   | `WS_METHODS`, all 70 `Rpc.make`, `WsRpcGroup`                               |
| [`environmentHttp.ts`][http]       | 557   | 4 `HttpApiGroup`s, `EnvironmentHttpApi`, HTTP errors                        |
| [`orchestration.ts`][orch]         | 1,443 | Commands, events, snapshots, stream items, `ModelSelection`                 |
| [`ipc.ts`][ipcts]                  | 1,288 | Desktop bridge (separate boundary)                                          |
| [`providerRuntime.ts`][prts]       | 1,041 | Provider runtime event envelopes                                            |
| [`relay.ts`][relayts]              | 1,040 | T3 Connect relay (separate boundary)                                        |
| [`previewAutomation.ts`][prevauto] | 881   | Browser automation over preview sessions                                    |
| [`server.ts`][serverts]            | 603   | `ServerConfig`, providers, lifecycle, self-update                           |
| [`settings.ts`][settingsts]        | 610   | `ServerSettings`, `ServerSettingsPatch`                                     |
| [`git.ts`][gitts]                  | 446   | Git status, refs, worktrees, stacked actions, PRs                           |
| [`terminal.ts`][termts]            | 352   | Terminal sessions, events, metadata                                         |
| [`auth.ts`][authts]                | 344   | Scopes, sessions, pairing, access stream                                    |
| [`preview.ts`][prevts]             | 298   | Preview sessions, events, discovered servers                                |
| [`vcs.ts`][vcsts]                  | 280   | VCS driver-neutral types                                                    |
| [`project.ts`][projectts]          | 225   | Project file/entry operations                                               |
| [`model.ts`][modelts]              | 224   | Model capabilities, option selections                                       |
| [`assets.ts`][assetsts]            | 198   | Attachment URLs                                                             |
| [`sourceControl.ts`][scts]         | 183   | GitHub/GitLab/Bitbucket/Azure repo operations                               |
| [`keybindings.ts`][kb]             | 171   | Keybinding config                                                           |
| [`providerInstance.ts`][pits]      | 149   | Provider instance ids and config                                            |
| [`provider.ts`][provts]            | 131   | Provider session/turn types                                                 |
| [`editor.ts`][editorts]            | 127   | External editor launch                                                      |
| [`environment.ts`][envts]          | 108   | Descriptor, capabilities, scoped refs                                       |
| [`t3ProjectFile.ts`][t3pf]         | 88    | `t3.json` project file                                                      |
| [`remoteAccess.ts`][rats]          | 68    | Remote access config                                                        |
| [`filesystem.ts`][fsts]            | 67    | Filesystem browse                                                           |
| [`relayClient.ts`][relayclientts]  | 63    | Relay client install/status                                                 |
| [`baseSchemas.ts`][base]           | 60    | Branded ids: `ThreadId`, `ProjectId`, `CommandId`, `EventId`, `IsoDateTime` |
| [`review.ts`][reviewts]            | 36    | Ephemeral diff preview                                                      |
| [`desktopBootstrap.ts`][dbs]       | 21    | Desktop-managed environment bootstrap                                       |

## 8. Implementing this contract

`apps/moatless-adapter` is a second, independent backend written against nothing but this
package — the working proof that the contract is complete and portable.
[`.plans/moatless-adapter.md`][adapterplan] §6 records its endpoint-by-endpoint
disposition, and its handler categories are a good template:

- **implemented** — handshake, shell/thread reads, config/lifecycle
- **quiet** — idle streams for subsystems with no analogue (never failing streams)
- **unsupported** — explicit named errors, so gaps are visible rather than silently
  successful. In this fork that is one shared error, [`UnsupportedMethodError`][unsupportederr],
  declared on the methods nobody here serves; a per-method error would say the same thing
  47 times.

### Known wart

`WS_METHODS.projectsList`, `projectsAdd`, and `projectsRemove` (`rpc.ts:152-154`) have no
corresponding `Rpc.make` and no references anywhere. They are dead constants from before
project mutations moved to `dispatchCommand`; the constant list is otherwise an accurate
index of the group.

<!-- contracts -->

[contracts]: ../../packages/contracts/
[unsupportederr]: ../../packages/contracts/src/auth.ts
[rpc]: ../../packages/contracts/src/rpc.ts
[ws_methods]: ../../packages/contracts/src/rpc.ts
[http]: ../../packages/contracts/src/environmentHttp.ts
[authmw]: ../../packages/contracts/src/environmentHttp.ts
[orch]: ../../packages/contracts/src/orchestration.ts
[orch_methods]: ../../packages/contracts/src/orchestration.ts
[cmds]: ../../packages/contracts/src/orchestration.ts
[rpcschemas]: ../../packages/contracts/src/orchestration.ts
[shellsnap]: ../../packages/contracts/src/orchestration.ts
[shellitem]: ../../packages/contracts/src/orchestration.ts
[threaditem]: ../../packages/contracts/src/orchestration.ts
[threadsnap]: ../../packages/contracts/src/orchestration.ts
[readmodel]: ../../packages/contracts/src/orchestration.ts
[dispatchresult]: ../../packages/contracts/src/orchestration.ts
[modelsel]: ../../packages/contracts/src/orchestration.ts
[serverconfig]: ../../packages/contracts/src/server.ts
[serverts]: ../../packages/contracts/src/server.ts
[configstream]: ../../packages/contracts/src/server.ts
[lifecycle]: ../../packages/contracts/src/server.ts
[selfupdate]: ../../packages/contracts/src/server.ts
[settings]: ../../packages/contracts/src/settings.ts
[settingsts]: ../../packages/contracts/src/settings.ts
[envts]: ../../packages/contracts/src/environment.ts
[descriptor]: ../../packages/contracts/src/environment.ts
[authts]: ../../packages/contracts/src/auth.ts
[scopes]: ../../packages/contracts/src/auth.ts
[sessionstate]: ../../packages/contracts/src/auth.ts
[ticket]: ../../packages/contracts/src/auth.ts
[authstream]: ../../packages/contracts/src/auth.ts
[autherr]: ../../packages/contracts/src/auth.ts
[termts]: ../../packages/contracts/src/terminal.ts
[termsnap]: ../../packages/contracts/src/terminal.ts
[termattach]: ../../packages/contracts/src/terminal.ts
[termevent]: ../../packages/contracts/src/terminal.ts
[termmeta]: ../../packages/contracts/src/terminal.ts
[prevts]: ../../packages/contracts/src/preview.ts
[prevsnap]: ../../packages/contracts/src/preview.ts
[prevevent]: ../../packages/contracts/src/preview.ts
[discovered]: ../../packages/contracts/src/preview.ts
[prevauto]: ../../packages/contracts/src/previewAutomation.ts
[gitts]: ../../packages/contracts/src/git.ts
[vcsstream]: ../../packages/contracts/src/git.ts
[gitprogress]: ../../packages/contracts/src/git.ts
[vcsts]: ../../packages/contracts/src/vcs.ts
[projectts]: ../../packages/contracts/src/project.ts
[fsts]: ../../packages/contracts/src/filesystem.ts
[assetsts]: ../../packages/contracts/src/assets.ts
[editorts]: ../../packages/contracts/src/editor.ts
[reviewts]: ../../packages/contracts/src/review.ts
[scts]: ../../packages/contracts/src/sourceControl.ts
[kb]: ../../packages/contracts/src/keybindings.ts
[pits]: ../../packages/contracts/src/providerInstance.ts
[provts]: ../../packages/contracts/src/provider.ts
[prts]: ../../packages/contracts/src/providerRuntime.ts
[modelts]: ../../packages/contracts/src/model.ts
[ipcts]: ../../packages/contracts/src/ipc.ts
[relayts]: ../../packages/contracts/src/relay.ts
[relayclientts]: ../../packages/contracts/src/relayClient.ts
[base]: ../../packages/contracts/src/baseSchemas.ts
[t3pf]: ../../packages/contracts/src/t3ProjectFile.ts
[rats]: ../../packages/contracts/src/remoteAccess.ts
[dbs]: ../../packages/contracts/src/desktopBootstrap.ts

<!-- implementations -->

[ws]: ../../apps/server/src/ws.ts
[scopemap]: ../../apps/server/src/ws.ts
[routes]: ../../apps/server/src/server.ts
[rawhttp]: ../../apps/server/src/http.ts
[authimpl]: ../../apps/server/src/auth/http.ts
[wsauth]: ../../apps/server/src/auth/EnvironmentAuth.ts
[orchimpl]: ../../apps/server/src/orchestration/http.ts
[connectimpl]: ../../apps/server/src/cloud/http.ts
[mcp]: ../../apps/server/src/mcp/McpHttpServer.ts
[session]: ../../packages/client-runtime/src/rpc/session.ts
[rpcclient]: ../../packages/client-runtime/src/rpc/client.ts
[opscmds]: ../../packages/client-runtime/src/operations/commands.ts
[shellstate]: ../../packages/client-runtime/src/state/shell.ts
[adapterrpc]: ../../apps/moatless-adapter/src/rpc.ts
[adapterplan]: ../../.plans/moatless-adapter.md
