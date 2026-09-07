export {
  getPrimaryKnownEnvironment,
  resetPrimaryEnvironmentDescriptorForTests,
  resolveInitialPrimaryEnvironmentDescriptor,
  writePrimaryEnvironmentDescriptor,
} from "./context";

export {
  createServerPairingCredential,
  consumeMoatlessAuthReturnTo,
  fetchMoatlessAuthMode,
  isPrimaryEnvironmentPairingCredentialRejectedError,
  peekPairingTokenFromUrl,
  PrimaryEnvironmentPairingCredentialRejectedError,
  PrimaryEnvironmentRequestError,
  rememberMoatlessAuthReturnTo,
  resolveInitialServerAuthGateState,
  resolveMoatlessOAuthLoginUrl,
  revokeOtherServerClientSessions,
  revokeServerClientSession,
  revokeServerPairingLink,
  stripPairingTokenFromUrl,
  submitMoatlessPasswordLogin,
  submitServerAuthCredential,
  takePairingTokenFromUrl,
  type MoatlessAuthModeState,
  type ServerClientSessionRecord,
  type ServerPairingLinkRecord,
  __resetServerAuthBootstrapForTests,
} from "./auth";

export { usePrimarySessionState } from "./sessionState";

export {
  DesktopEnvironmentBootstrapIncompleteError,
  isDesktopEnvironmentBootstrapIncompleteError,
  isPrimaryEnvironmentProtocolUnsupportedError,
  isPrimaryEnvironmentUrlInvalidError,
  PrimaryEnvironmentProtocolUnsupportedError,
  PrimaryEnvironmentUrlInvalidError,
  readPrimaryEnvironmentTarget,
  resolvePrimaryEnvironmentHttpUrl,
  isLoopbackHostname,
  type PrimaryEnvironmentTarget,
} from "./target";
