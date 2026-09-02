/**
 * Subtasks — the threads a thread spawned.
 *
 * Fork-only. Upstream has one kind of child: a subagent, folded out of a
 * thread's own activities, living and dying inside that conversation. A
 * Moatless backend has a second — a task another task created, or a fork of
 * one — and it is a thread in its own right: its own transcript, its own
 * sandbox, its own status, its own route.
 *
 * That difference is why this is a separate method rather than more members on
 * the orchestration thread stream. A subagent has no `threadId` to open and a
 * subtask has no activity to fold, so a shape that carried both would be a
 * union whose halves share almost nothing, and every reader would branch on the
 * discriminant anyway. The agents panel renders the two as two sections.
 *
 * Reads only. Nothing here creates, retitles, or closes a subtask.
 *
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
 * A subtask's state, deliberately spelled in the agents panel's own status
 * vocabulary so a subtask row and a subagent row read the same.
 *
 * `idle` is the settled-but-resumable state a finished-for-now thread sits in;
 * `completed` means the thread was closed. A backend maps its own lifecycle
 * onto these — it does not send its native status.
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
 * `threadId` is the whole point of the row: it is a real thread, and the client
 * opens it on the same route as any other. Everything else is what the row
 * shows before you click it.
 *
 * `awaitingInput` is separate from `status` rather than a status of its own,
 * because a child parked on a question is still running — the status says what
 * the run is doing and this says who it is waiting for.
 */
export const Subtask = Schema.Struct({
  threadId: ThreadId,
  title: TrimmedNonEmptyString,
  relation: SubtaskRelation,
  status: SubtaskStatus,
  awaitingInput: Schema.Boolean,
  /** The agent runtime the child runs under, for the row's role tag. */
  agentType: Schema.NullOr(TrimmedNonEmptyString),
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
 * Every child thread of the named thread that this viewer may read, in spawn
 * order.
 *
 * Spawn order, not recency: the panel updates rows in place and must not
 * re-sort itself when a child starts working or finishes. A child the viewer
 * cannot read is absent rather than redacted, and a thread with no children
 * answers with an empty list rather than an error.
 */
export const SubtasksListResult = Schema.Struct({
  subtasks: Schema.Array(Subtask),
});
export type SubtasksListResult = typeof SubtasksListResult.Type;
