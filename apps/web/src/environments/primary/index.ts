export {
  createServerPairingCredential,
  consumeMoatlessAuthReturnTo,
  fetchMoatlessAuthMode,
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
  PrimaryEnvironmentProtocolUnsupportedError,
  PrimaryEnvironmentUrlInvalidError,
  readPrimaryEnvironmentTarget,
  resolvePrimaryEnvironmentHttpUrl,
  isLoopbackHostname,
  type PrimaryEnvironmentTarget,
} from "./target";
// Fork: `context.ts` is fork-owned since upstream deleted it; `__root.tsx` reads the descriptor through it.
export {
  resetPrimaryEnvironmentDescriptorForTests,
  resolveInitialPrimaryEnvironmentDescriptor,
} from "./context";
