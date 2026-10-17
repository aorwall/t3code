import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import {
  EnvironmentId,
  ForwardCompatibleOptional,
  ProjectId,
  ThreadId,
  TrimmedNonEmptyString,
} from "./baseSchemas.ts";

export const ORCHESTRATION_PROTOCOL_VERSION = 2;
export const ORCHESTRATION_PROTOCOL_VERSION_TEXT = "2";
export const ORCHESTRATION_PROTOCOL_QUERY_PARAM = "orchestrationProtocol";
export const ORCHESTRATION_PROTOCOL_HEADER = "x-t3-orchestration-protocol";

export const ExecutionEnvironmentPlatformOs = Schema.Literals([
  "darwin",
  "linux",
  "windows",
  "unknown",
]);
export type ExecutionEnvironmentPlatformOs = typeof ExecutionEnvironmentPlatformOs.Type;

export const ExecutionEnvironmentPlatformArch = Schema.Literals(["arm64", "x64", "other"]);
export type ExecutionEnvironmentPlatformArch = typeof ExecutionEnvironmentPlatformArch.Type;

export const ENVIRONMENT_MACHINE_KINDS = [
  "server",
  "cloud",
  "linux",
  "desktop",
  "laptop",
  "mac-mini",
  "mac-studio",
] as const;
export const EnvironmentMachineKind = Schema.Literals(ENVIRONMENT_MACHINE_KINDS);
export type EnvironmentMachineKind = typeof EnvironmentMachineKind.Type;
export const isEnvironmentMachineKind = Schema.is(EnvironmentMachineKind);

export const ExecutionEnvironmentPlatform = Schema.Struct({
  os: ExecutionEnvironmentPlatformOs,
  arch: ExecutionEnvironmentPlatformArch,
  machine: ForwardCompatibleOptional(EnvironmentMachineKind),
});

/**
 * Lives here (not settings.ts) so orchestration contracts can reference it
 * without an import cycle.
 */
export const ThreadEnvMode = Schema.Literals(["local", "worktree"]);
export type ThreadEnvMode = typeof ThreadEnvMode.Type;

export const WorktreeSubmodules = Schema.Literals(["recursive", "top-level", "none"]);
export type WorktreeSubmodules = typeof WorktreeSubmodules.Type;
export type ExecutionEnvironmentPlatform = typeof ExecutionEnvironmentPlatform.Type;

export const ServerSelfUpdateMethod = Schema.Literals(["boot-service", "respawn", "desktop-app"]);
export type ServerSelfUpdateMethod = typeof ServerSelfUpdateMethod.Type;

export const ServerInstallation = Schema.Union([
  Schema.Struct({ kind: Schema.Literals(["npx", "pnpm-dlx", "bunx"]) }),
  Schema.Struct({ kind: Schema.Literal("npm-global"), prefix: TrimmedNonEmptyString }),
]);
export type ServerInstallation = typeof ServerInstallation.Type;

export const ServerSelfUpdateCapability = Schema.Literals([
  "boot-service",
  "respawn",
  "desktop-managed",
]);
export type ServerSelfUpdateCapability = typeof ServerSelfUpdateCapability.Type;

export const ExecutionEnvironmentCapabilities = Schema.Struct({
  repositoryIdentity: Schema.Boolean.pipe(Schema.withDecodingDefault(Effect.succeed(false))),
  connectionProbe: Schema.optionalKey(Schema.Boolean),
  attachmentUploads: Schema.optionalKey(Schema.Boolean),
  questionAttachments: Schema.optionalKey(Schema.Boolean),
  fileAttachments: Schema.optionalKey(
    Schema.Struct({
      maxUploadBytes: Schema.Int.check(Schema.isGreaterThanOrEqualTo(1)),
    }),
  ),
  pullRequests: Schema.optionalKey(Schema.Boolean),
  pullRequestChecks: Schema.optionalKey(Schema.Boolean),
  /** Absent on servers from before inline context shipped, which drop the records and forward
      the links as literal text -- so a client must serialize context the legacy way for them. */
  inlineMessageContext: Schema.optionalKey(Schema.Boolean),
  requiredWorktreeBootstrap: Schema.optionalKey(Schema.Boolean),
  threadSettlement: Schema.optionalKey(Schema.Boolean),
  threadAutoSettlement: Schema.optionalKey(Schema.Boolean),
  storageCleanup: Schema.optionalKey(Schema.Boolean),
  storageCleanupRun: Schema.optionalKey(Schema.Boolean),
  /** Server streams database size and reclaimable space for the Storage settings notice. */
  databaseStorage: Schema.optionalKey(Schema.Boolean),
  /** Server checks OTLP endpoints for the telemetry export settings. */
  otlpEndpointCheck: Schema.optionalKey(Schema.Boolean),
  projectWorktreeCleanup: Schema.optionalKey(Schema.Boolean),
  settledWorktreeCleanup: Schema.optionalKey(Schema.Boolean),
  worktreesDirectory: Schema.optionalKey(Schema.Boolean),
  threadAutoSettlementScope: Schema.optionalKey(Schema.Boolean),
  threadRestartContinuation: Schema.optionalKey(Schema.Boolean),
  projectSettingsOverrides: Schema.optionalKey(Schema.Boolean),
  /**
   * Older
      servers decode the key away (unknown fields are stripped, not
      rejected), so the per-project provider switch would silently do
      nothing; clients hide it instead of sending a patch that goes nowhere.
   */
  projectProviderInstanceOverrides: Schema.optionalKey(Schema.Boolean),
  threadSnooze: Schema.optionalKey(Schema.Boolean),
  /** Absent on servers from
      before environment themes shipped, which never emit the events -- so a
      client reconnecting to one must drop published themes rather than keep
      showing a set nothing will ever update. */
  environmentThemes: Schema.optionalKey(Schema.Boolean),
  usageLimitSources: Schema.optionalKey(Schema.Boolean),
  usagePriceOverrides: Schema.optionalKey(Schema.Boolean),
  usageModelAliases: Schema.optionalKey(Schema.Boolean),
  threadPinning: Schema.optionalKey(Schema.Boolean),
  threadPinReorder: Schema.optionalKey(Schema.Boolean),
  /** Fork: server understands thread.visibility.set, and its thread rows carry
      `visibility`. One flag for the pair — a client that cannot read the
      current level has nothing to label the control with. Same version-skew
      contract as threadSettlement. */
  threadVisibility: Schema.optionalKey(Schema.Boolean),
  /** Fork: server understands thread.follow / thread.unfollow, and its shell
      listing carries only the threads the viewer follows. Same version-skew
      contract as threadSettlement. */
  threadFollow: Schema.optionalKey(Schema.Boolean),
  /** Fork: server understands threads.browse — it can answer with listing rows
      for threads outside the viewer's own listing, narrowed by owner or tag.
      Absent on servers whose listing is every thread there is, where filtering
      is something a client does over the rows it already holds. */
  threadBrowse: Schema.optionalKey(Schema.Boolean),
  /** Fork: server switches a started thread to another provider when a turn
      names that provider's instance, so the client leaves the picker unlocked.
      Absent, a started thread keeps its provider. */
  threadProviderSwitch: Schema.optionalKey(Schema.Boolean),
  threadActiveReorder: Schema.optionalKey(Schema.Boolean),
  threadAutoSettleOptOut: Schema.optionalKey(Schema.Boolean),
  threadTitleRegeneration: Schema.optionalKey(Schema.Boolean),
  threadVisitedTracking: Schema.optionalKey(Schema.Boolean),
  threadPullRequestLinking: Schema.optionalKey(Schema.Boolean),
  serverResolvedCommandContext: Schema.optionalKey(Schema.Boolean),
  threadPullRequests: Schema.optionalKey(Schema.Boolean),
  threadPullRequestWatch: Schema.optionalKey(Schema.Boolean),
  pullRequestStackActions: Schema.optionalKey(Schema.Boolean),
  serverSelfUpdate: Schema.optionalKey(ServerSelfUpdateCapability),
  /** Manual commands must update this install, not the host's default global prefix. */
  serverInstallation: ForwardCompatibleOptional(ServerInstallation),
  serverSelfUpdateProgress: Schema.optionalKey(Schema.Boolean),
  /** Server understands scripts.run — it can run a project's scripts itself,
      hosting each in a terminal and publishing a port when one is served.
      Absent on servers that only *list* a project's scripts (every T3-hosted
      one today), so clients show the scripts but not the control that runs
      them, and never send scripts.run under version skew. */
  workspaceScripts: Schema.optionalKey(Schema.Boolean),
  /** Fork: server understands scripts.listForThread — a thread may declare
      scripts of its own, on top of its project's. Absent on servers where a
      project's list is every script there is, so clients show that list alone
      and never send scripts.listForThread under version skew. */
  taskScripts: Schema.optionalKey(Schema.Boolean),
  /** Fork: server understands sandbox.subscribeStatus — it pushes a thread's sandbox
      lifecycle status instead of only answering a read. Absent on servers that
      serve `sandbox.status` alone, where a client that wants a live indicator
      has to poll it. */
  sandboxStatusPush: Schema.optionalKey(Schema.Boolean),
  /** Fork: sandbox.status reports agentStatus alongside the lifecycle state.
      Absent on servers that answer with the lifecycle state alone, where a
      client cannot tell "this server does not say" from "this agent is idle"
      and so shows no agent indicator in the sandbox panel. */
  sandboxAgentStatus: Schema.optionalKey(Schema.Boolean),
  /** Fork: sandbox.status reports the commands registered through `moat cmd`.
      The agent reports `idle` while one runs, so absent this key a client
      cannot tell a thread that is mid-build from one with nothing left to do,
      and shows no command rows at all. */
  sandboxCommands: Schema.optionalKey(Schema.Boolean),
  /** Fork: server serves sandbox.detail and the four controls the sandbox
      panel drives — restart, redeploy, cleanup, setIdleTimeout. Absent on
      servers that serve the lifecycle status alone, where the panel would have
      nothing to show and no control to offer, so clients do not open it. */
  sandboxDetail: Schema.optionalKey(Schema.Boolean),
  /** Fork: surfaces this server cannot back, by the web client's `FeatureName`
      (`apps/web/src/fork/features.ts`). Strings rather than a literal union so
      a server naming a surface this client does not know still decodes.
      Absent, every surface is shown. */
  unsupportedSurfaces: Schema.optionalKey(Schema.Array(Schema.String)),
  /** Fork: the same origin also serves the Moatless REST API under `/api/v1`
      with its cookie login. Absent, the client offers T3 pairing instead of
      `/login` and none of the Moatless administration pages. */
  moatlessApi: Schema.optionalKey(Schema.Boolean),
  serverUpdateThreadContinuation: Schema.optionalKey(Schema.Boolean),
  /**
   * Clients skip seeding a Live Activity when
      this is false — no update would ever repaint it. Absent on older
      servers, which may still publish, so only an explicit false skips.
   */
  agentActivityPublishing: Schema.optionalKey(Schema.Boolean),
  projectCloneTracking: Schema.optionalKey(Schema.Boolean),
  environmentIcon: Schema.optionalKey(Schema.Boolean),
  desktopAppUpdate: Schema.optionalKey(Schema.Boolean),
  /** Server answers orchestration.subscribeCommandOutput. Absent on older servers,
      which never send command output, so clients must not subscribe. */
  commandOutputStreaming: Schema.optionalKey(Schema.Boolean),
  /** Server hosts preview tabs in its own headless Chromium (`runtime:
      "server"`) and streams them over `/api/preview-stream`. Clients
      without a local browser runtime open server tabs here. */
  serverBrowser: Schema.optionalKey(Schema.Boolean),
});
export type ExecutionEnvironmentCapabilities = typeof ExecutionEnvironmentCapabilities.Type;

export const ExecutionEnvironmentDescriptor = Schema.Struct({
  environmentId: EnvironmentId,
  label: TrimmedNonEmptyString,
  platform: ExecutionEnvironmentPlatform,
  serverVersion: TrimmedNonEmptyString,
  orchestrationProtocolVersion: Schema.optionalKey(Schema.Int),
  capabilities: ExecutionEnvironmentCapabilities,
});
export type ExecutionEnvironmentDescriptor = typeof ExecutionEnvironmentDescriptor.Type;

export const RepositoryIdentityLocator = Schema.Struct({
  source: Schema.Literal("git-remote"),
  remoteName: TrimmedNonEmptyString,
  remoteUrl: TrimmedNonEmptyString,
});
export type RepositoryIdentityLocator = typeof RepositoryIdentityLocator.Type;

export const RepositoryOrigin = Schema.Struct({
  canonicalKey: TrimmedNonEmptyString,
  displayName: Schema.optionalKey(TrimmedNonEmptyString),
});
export type RepositoryOrigin = typeof RepositoryOrigin.Type;

export const RepositoryIdentity = Schema.Struct({
  canonicalKey: TrimmedNonEmptyString,
  locator: RepositoryIdentityLocator,
  webUrl: Schema.optionalKey(TrimmedNonEmptyString),
  rootPath: Schema.optionalKey(TrimmedNonEmptyString),
  displayName: Schema.optionalKey(TrimmedNonEmptyString),
  provider: Schema.optionalKey(TrimmedNonEmptyString),
  owner: Schema.optionalKey(TrimmedNonEmptyString),
  name: Schema.optionalKey(TrimmedNonEmptyString),
  origin: Schema.optionalKey(RepositoryOrigin),
});
export type RepositoryIdentity = typeof RepositoryIdentity.Type;

export function repositoryGroupingKeyOf(identity: RepositoryIdentity): string {
  return identity.origin?.canonicalKey ?? identity.canonicalKey;
}

export function repositoryGroupingDisplayNameOf(identity: RepositoryIdentity): string | undefined {
  return identity.origin
    ? (identity.origin.displayName ?? identity.origin.canonicalKey)
    : identity.displayName;
}

export const ScopedProjectRef = Schema.Struct({
  environmentId: EnvironmentId,
  projectId: ProjectId,
});
export type ScopedProjectRef = typeof ScopedProjectRef.Type;

export const ScopedThreadRef = Schema.Struct({
  environmentId: EnvironmentId,
  threadId: ThreadId,
});
export type ScopedThreadRef = typeof ScopedThreadRef.Type;
