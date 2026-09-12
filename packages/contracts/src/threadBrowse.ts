/**
 * The listing rows a filter names, for threads outside the viewer's listing.
 *
 * Fork-only. Upstream's shell listing is every thread there is, so a filter
 * over it is a client-side narrowing of rows the client already holds. A
 * Moatless listing is the open work one person follows, so "show me what
 * somebody else is working on" is not a narrowing at all — those rows were
 * never sent, and no filter over what the sidebar holds can reach them.
 *
 * So this is a read beside the listing rather than a parameter of it: the
 * listing subscription stays exactly what it was, and this answers with rows in
 * the same shape for a set the caller described instead of one it follows.
 *
 * Reads only, and by access rather than by involvement — the same rule
 * `threadShellLookup.ts` resolves one thread under. A viewer who is not an
 * administrator browses their own threads and the public ones, which is why the
 * server gates nothing on a role: the read rule is the gate, and the client's
 * admin check only decides whether to offer the control.
 *
 * @module ThreadBrowse
 */
import { Schema } from "effect";
import { OrchestrationThreadShell } from "./orchestration.ts";

/**
 * At least one of `ownerUserId` and `tag` must be set, and the server refuses
 * the call when neither is: unfiltered, this read is every thread an
 * administrator may read — the whole deployment.
 *
 * The two narrow together rather than widening each other, so a call carrying
 * both asks for that person's threads under that tag.
 */
export const ThreadBrowseInput = Schema.Struct({
  /** Whose threads, by Moatless user id. */
  ownerUserId: Schema.optional(Schema.String),
  /** A tag, by name — the handle Moatless tags are chosen by. */
  tag: Schema.optional(Schema.String),
  /**
   * Whether closed threads come back alongside open ones. Closing is what T3
   * calls archiving, so this folds the archived half into the same answer
   * rather than needing a second read for it.
   */
  includeClosed: Schema.optional(Schema.Boolean),
});
export type ThreadBrowseInput = typeof ThreadBrowseInput.Type;

/**
 * The rows, capped server-side and newest first.
 *
 * Rows only, and no snapshot sequence: nothing pushes a browsed row, because
 * the change feed re-reads by follow. A client refreshes by asking again, and a
 * position here is one it could mistake for its listing's and start discarding
 * live events against.
 *
 * A thread whose project the viewer cannot read is absent rather than carried
 * with a dangling `projectId` — the client files every row under a project it
 * already holds and silently drops one it cannot place.
 */
export const ThreadBrowseResult = Schema.Struct({
  threads: Schema.Array(OrchestrationThreadShell),
  /**
   * Whether the filter matched more rows than the server's cap returns, so a
   * client can say a list is partial rather than leaving somebody to read a cut
   * answer as a complete one. Counting `threads` cannot tell them apart: the
   * drop above happens after the cap, so a truncated answer can arrive short.
   *
   * `optionalKey` because a server built before the flag existed omits it, and
   * the browse is otherwise the same answer.
   */
  truncated: Schema.optionalKey(Schema.Boolean),
});
export type ThreadBrowseResult = typeof ThreadBrowseResult.Type;
