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
