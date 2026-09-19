/**
 * Scripts - Running a project's declared scripts.
 *
 * A project's scripts are the commands a person runs on demand against its
 * checkout — "run the tests", "bring up Storybook". They are declared on the
 * project (`OrchestrationProject.scripts`) and, on a hosted environment, run
 * inside the sandbox rather than on the client machine.
 *
 * `scripts.run` is that host-driven path. The client asks the environment to
 * run one; the environment hosts it in a named terminal and, when the script
 * serves a port, publishes that port and returns its URL. A client attaches to
 * the returned terminal exactly as it does for any other, and opens the URL if
 * one came back.
 *
 * The environment advertises this with the `workspaceScripts` capability. An
 * environment without it still lists a project's scripts — they are read from
 * the project either way — but does not offer to run them, and answers
 * `scripts.run` with `UnsupportedMethodError`.
 *
 * `scripts.listForThread` is the fork's second path, under the `taskScripts`
 * capability. A Moatless thread may declare scripts of its own — an agent
 * registering the dev server it just brought up — which no project carries and
 * so no project listing can show. The method answers with what that one thread
 * can run.
 *
 * @module Scripts
 */
import { Schema } from "effect";
import { ThreadId, TrimmedNonEmptyString } from "./baseSchemas.ts";
import { ProjectScript } from "./orchestration.ts";
// Fork: `previewTabId` on the result below is a preview tab id.
import { PreviewTabId } from "./preview.ts";

/**
 * Run a project's script by its id, in the context of one thread.
 *
 * `scriptId` is the script's stable id from `OrchestrationProject.scripts`. The
 * thread supplies the sandbox the script runs in.
 */
export const ScriptsRunInput = Schema.Struct({
  threadId: ThreadId,
  scriptId: TrimmedNonEmptyString,
});
export type ScriptsRunInput = typeof ScriptsRunInput.Type;

/**
 * Where the script is running, and how to reach what it serves.
 *
 * `terminalId` names the terminal session hosting it — attach to it to see the
 * console. `url` is the preview address of the port the script serves, or null
 * when the script serves no port or the environment publishes no external URL
 * (no proxy domain). It is not a promise the port is answering yet, only where
 * it will answer.
 *
 * Fork (Moatless): `previewTabId` says the environment already opened a tab on
 * that URL.
 */
export const ScriptsRunResult = Schema.Struct({
  terminalId: TrimmedNonEmptyString,
  url: Schema.NullOr(TrimmedNonEmptyString),
  /**
   * Fork (Moatless): the browser tab the environment opened on `url` itself.
   *
   * Null when the script serves no port, absent when the environment does not
   * open tabs at all. A tab belongs to the thread rather than to whoever asked
   * (`preview.*`), which is what lets a run started from outside any client —
   * `moat tasks scripts run` — reach the browser of everyone watching. So a
   * client that is given one has only its own panel left to open; a client that
   * is not opens the tab itself.
   */
  previewTabId: Schema.optional(Schema.NullOr(PreviewTabId)),
});
export type ScriptsRunResult = typeof ScriptsRunResult.Type;

/**
 * Fork (Moatless). Where a script was declared, which decides who may edit it.
 *
 * A `workspace` script is declared on the project and runs for every thread in
 * it; it is edited through `project.meta.update` like any other project field.
 * A `task` script is declared on one thread, stored beside that thread's own
 * state, and runs only there — so a client offers no project-level edit for
 * one, since writing the project's list back would not touch it.
 */
export const ScriptScope = Schema.Literals(["workspace", "task"]);
export type ScriptScope = typeof ScriptScope.Type;

/**
 * Fork (Moatless). One script a thread can run: the same shape a project lists,
 * plus where it came from.
 */
export const ThreadScript = Schema.Struct({
  ...ProjectScript.fields,
  scope: ScriptScope,
});
export type ThreadScript = typeof ThreadScript.Type;

export const ScriptsListForThreadInput = Schema.Struct({
  threadId: ThreadId,
});
export type ScriptsListForThreadInput = typeof ScriptsListForThreadInput.Type;

/**
 * Every script the named thread can run: its project's, with the thread's own
 * merged over them.
 *
 * A thread script shadows a project script sharing its id, so the list is what
 * `scripts.run` will actually run rather than the union of two declarations. A
 * thread whose own scripts could not be read answers with its project's alone,
 * because a stopped sandbox is the ordinary case and the project's scripts are
 * still true.
 */
export const ScriptsListForThreadResult = Schema.Struct({
  scripts: Schema.Array(ThreadScript),
});
export type ScriptsListForThreadResult = typeof ScriptsListForThreadResult.Type;
