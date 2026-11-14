/**
 * Fork-only. Reads the turn a fork cuts after off the hovered message's wire `TurnId`.
 * Moatless encodes it as `"{taskId}:{turnNumber}"` (`crates/t3code/src/projection.rs`);
 * anything else parses to `null`, which keeps upstream behaviour.
 */
import type { RunId, TurnId } from "@t3tools/contracts";

/** The trailing turn number, or `null` when `turnId` does not carry one. */
export function parseMoatlessTurnNumber(turnId: TurnId | RunId): number | null {
  const raw = turnId.split(":").at(-1);
  if (raw === undefined || raw.length === 0) {
    return null;
  }
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

/**
 * How long a fork waits for its new thread once the request itself failed. Moatless
 * keeps forking after the socket drops, and a long source has taken 28 s.
 */
export const FORK_ARRIVAL_TIMEOUT_MS = 90_000;

/**
 * Whether a failed `thread.fork` means no fork exists. Only the server's own refusal
 * says so; a dropped socket interrupts the request while the server may still finish.
 */
export function isForkRefusal(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "_tag" in error &&
    error._tag === "OrchestrationV2DispatchCommandError"
  );
}
