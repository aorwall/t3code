/**
 * One thread's listing row, asked for by id.
 *
 * Fork-only. Upstream's client learns a thread exists from the shell listing
 * and nowhere else, which holds when the listing is every thread there is.
 * Against Moatless it is not: the sidebar is the open work you follow, closed
 * work lives in a separate archive snapshot, and a thread can reach the client
 * through a link, a task tree or a search long before it reaches either. Such a
 * thread renders its transcript from `orchestration.subscribeThread` and has no
 * title, no project and no archived badge, because those are the listing's to
 * give.
 *
 * So this is the listings' complement rather than a third listing: it answers
 * about one thread the caller already names, and it answers with the same row
 * `orchestration.subscribeShell` carries — a client must not be able to tell
 * which read a thread arrived through.
 *
 * Reads only, and by access rather than by involvement: a viewer gets a row
 * here exactly when they could have opened the thread.
 *
 * @module ThreadShellLookup
 */
import { Schema } from "effect";
import { ThreadId } from "./baseSchemas.ts";
import { OrchestrationThreadShell } from "./orchestration.ts";

export const ThreadShellGetInput = Schema.Struct({
  threadId: ThreadId,
});
export type ThreadShellGetInput = typeof ThreadShellGetInput.Type;

/**
 * The thread's row, or `null`.
 *
 * `null` is one answer with several causes — no such thread, not readable,
 * filed under a project this viewer's client does not hold — and they are
 * deliberately indistinguishable. The caller is already looking at the thread
 * or already knows it is gone; either way the row it did not get is the whole
 * of what it may learn.
 */
export const ThreadShellGetResult = Schema.Struct({
  thread: Schema.NullOr(OrchestrationThreadShell),
});
export type ThreadShellGetResult = typeof ThreadShellGetResult.Type;
