/**
 * One thread's listing row, asked for by id. Fork-only.
 *
 * A thread reached by link or task tree has a transcript but no row from the listing. This
 * returns the same row `orchestration.subscribeShell` carries, for threads the viewer may open.
 * @module ThreadShellLookup
 */
import { Schema } from "effect";
import { ThreadId } from "./baseSchemas.ts";
import { OrchestrationV2ThreadShell } from "./orchestrationV2.ts";

export const ThreadShellGetInput = Schema.Struct({
  threadId: ThreadId,
});
export type ThreadShellGetInput = typeof ThreadShellGetInput.Type;

/**
 * The thread's row, or `null`.
 *
 * `null` deliberately covers no such thread, unreadable, and unfiled under a held project;
 * the caller may learn no more than that it got no row.
 */
export const ThreadShellGetResult = Schema.Struct({
  thread: Schema.NullOr(OrchestrationV2ThreadShell),
});
export type ThreadShellGetResult = typeof ThreadShellGetResult.Type;
