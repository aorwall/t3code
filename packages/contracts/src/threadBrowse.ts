/**
 * The listing rows a filter names, for threads outside the viewer's listing. Fork-only.
 *
 * A Moatless listing holds only the viewer's follows, so other people's rows were never sent.
 * Reads by access: the read rule is the gate, the client's admin check only offers the control.
 * @module ThreadBrowse
 */
import { Schema } from "effect";
import { OrchestrationV2ThreadShell } from "./orchestrationV2.ts";

/**
 * At least one of `ownerUserId` and `tag` must be set; the server refuses neither-set calls, since
 * unfiltered this is every thread in the deployment. Both together narrow (AND).
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
 * No snapshot sequence: nothing pushes a browsed row, and a position could be mistaken for the
 * listing's. A thread whose project the viewer cannot read is absent, not dangling.
 */
export const ThreadBrowseResult = Schema.Struct({
  threads: Schema.Array(OrchestrationV2ThreadShell),
  /**
   * Whether the filter matched more rows than the server's cap returns. Counting `threads`
   * cannot tell: the drop happens after the cap, so a truncated answer can arrive short.
   * `optionalKey` because servers built before the flag omit it.
   */
  truncated: Schema.optionalKey(Schema.Boolean),
});
export type ThreadBrowseResult = typeof ThreadBrowseResult.Type;
