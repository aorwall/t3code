/**
 * Subtasks: the threads a thread spawned. Fork-only.
 *
 * Unlike a subagent (folded from activities, no `threadId`), a subtask is a thread with its
 * own transcript, sandbox and route, so it is a separate method, not a union member. Reads only.
 * @module Subtasks
 */
import { Schema } from "effect";
import { ThreadId, TrimmedNonEmptyString } from "./baseSchemas.ts";

/**
 * Which edge makes this thread a child.
 *
 * `createdBy` is work the parent spawned and is usually waiting on.
 * `forkedFrom` is the parent's own history branched at a turn — the same tree,
 * a different reason, and worth telling apart in the row.
 */
export const SubtaskRelation = Schema.Literals(["createdBy", "forkedFrom"]);
export type SubtaskRelation = typeof SubtaskRelation.Type;

/**
 * A subtask's state, spelled in the agents panel's status vocabulary so subtask and
 * subagent rows read the same. `idle` is settled-but-resumable; `completed` means closed.
 * A backend maps its lifecycle onto these and never sends its native status.
 */
export const SubtaskStatus = Schema.Literals([
  "pending",
  "running",
  "idle",
  "completed",
  "failed",
  "interrupted",
]);
export type SubtaskStatus = typeof SubtaskStatus.Type;

/**
 * One child thread.
 *
 * `threadId` is a real thread, opened on the usual route. `awaitingInput` is separate from
 * `status` because a child parked on a question is still running.
 */
export const Subtask = Schema.Struct({
  threadId: ThreadId,
  title: TrimmedNonEmptyString,
  relation: SubtaskRelation,
  status: SubtaskStatus,
  awaitingInput: Schema.Boolean,
  /** The agent runtime the child runs under, for the row's role tag. */
  agentProfile: Schema.NullOr(TrimmedNonEmptyString),
  branch: Schema.NullOr(TrimmedNonEmptyString),
  /** How many turns the child has run. Zero before it starts. */
  turnCount: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  createdAt: Schema.String,
  updatedAt: Schema.String,
  /** When the child was archived, or null while it is open. */
  archivedAt: Schema.NullOr(Schema.String),
});
export type Subtask = typeof Subtask.Type;

export const SubtasksListInput = Schema.Struct({
  threadId: ThreadId,
});
export type SubtasksListInput = typeof SubtasksListInput.Type;

/**
 * Every child thread of the named thread that this viewer may read, in spawn order.
 *
 * Spawn order, not recency: the panel updates in place and must not re-sort. An unreadable
 * child is absent, not redacted; no children is an empty list, not an error.
 */
export const SubtasksListResult = Schema.Struct({
  subtasks: Schema.Array(Subtask),
});
export type SubtasksListResult = typeof SubtasksListResult.Type;
