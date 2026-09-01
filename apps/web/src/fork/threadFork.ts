/**
 * Fork-only. Reading the turn a fork cuts after off the wire `TurnId` the
 * hovered message already carries, instead of tracking it separately.
 *
 * Moatless encodes `TurnId` as `"{taskId}:{turnNumber}"`
 * (`crates/t3code/src/projection.rs`, `turn_id`). The contract types `TurnId`
 * as an opaque branded string, so this parse is Moatless-specific and lives
 * here rather than in a shared, upstream-owned module.
 */
import type { TurnId } from "@t3tools/contracts";

/** The trailing turn number, or `null` when `turnId` does not carry one. */
export function parseMoatlessTurnNumber(turnId: TurnId): number | null {
  const raw = turnId.split(":").at(-1);
  if (raw === undefined || raw.length === 0) {
    return null;
  }
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}
