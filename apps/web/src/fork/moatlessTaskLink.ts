/**
 * Fork-only. Turns a Moatless `/tasks/<task id>` link into this client's thread route.
 * The link cannot name an environment (its id is only known once the connection reports it),
 * so resolve it at open time rather than baking it into the link.
 */
import type { EnvironmentId, ThreadId } from "@t3tools/contracts";

export type MoatlessTaskLinkResolution =
  | {
      readonly kind: "resolved";
      readonly environmentId: EnvironmentId;
      readonly threadId: ThreadId;
    }
  | { readonly kind: "pending" }
  | { readonly kind: "unresolvable" };

/**
 * A task belongs to the Moatless deployment this client is connected to, which
 * is the primary environment. Until the connection catalog is ready its
 * absence means "not registered yet", not "not there".
 */
export function resolveMoatlessTaskLink(input: {
  readonly taskId: string;
  readonly primaryEnvironmentId: EnvironmentId | null;
  readonly catalogReady: boolean;
}): MoatlessTaskLinkResolution {
  if (input.primaryEnvironmentId === null) {
    return input.catalogReady ? { kind: "unresolvable" } : { kind: "pending" };
  }
  if (input.taskId === "") {
    return { kind: "unresolvable" };
  }
  return {
    kind: "resolved",
    environmentId: input.primaryEnvironmentId,
    threadId: input.taskId as ThreadId,
  };
}
