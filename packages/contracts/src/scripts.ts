/**
 * Scripts - Running a project's declared scripts.
 *
 * `scripts.run` is the host-driven path, advertised by `workspaceScripts`; without it the
 * environment still lists scripts but answers `UnsupportedMethodError`. `scripts.listForThread`
 * is the fork's `taskScripts` path for thread-declared scripts. @module Scripts
 */
import { Schema } from "effect";
import { ThreadId, TrimmedNonEmptyString } from "./baseSchemas.ts";
import { ProjectScript } from "./project.ts";
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
 * `terminalId` names the hosting terminal. `url` is the served port's preview address, or null
 * without a port or external URL; it does not promise the port is answering yet.
 * Fork (Moatless): `previewTabId` says a tab is already open on `url`.
 */
export const ScriptsRunResult = Schema.Struct({
  terminalId: TrimmedNonEmptyString,
  url: Schema.NullOr(TrimmedNonEmptyString),
  /**
   * Fork (Moatless): the browser tab the environment opened on `url` itself.
   * Null when no port is served, absent when the environment opens no tabs. A client given
   * one only opens its own panel; otherwise it opens the tab itself.
   */
  previewTabId: Schema.optional(Schema.NullOr(PreviewTabId)),
});
export type ScriptsRunResult = typeof ScriptsRunResult.Type;

/**
 * Fork (Moatless). Where a script was declared, which decides who may edit it.
 *
 * `workspace` scripts live on the project and are edited via `project.meta.update`. `task`
 * scripts live on one thread, so a client offers no project-level edit for them.
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
 * Every script the named thread can run: its project's, with the thread's own merged over them.
 *
 * A thread script shadows a project script with the same id. If the thread's own scripts
 * cannot be read (stopped sandbox), the answer is the project's alone.
 */
export const ScriptsListForThreadResult = Schema.Struct({
  scripts: Schema.Array(ThreadScript),
});
export type ScriptsListForThreadResult = typeof ScriptsListForThreadResult.Type;
