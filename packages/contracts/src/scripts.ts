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
 * @module Scripts
 */
import { Schema } from "effect";
import { ThreadId, TrimmedNonEmptyString } from "./baseSchemas.ts";

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
 */
export const ScriptsRunResult = Schema.Struct({
  terminalId: TrimmedNonEmptyString,
  url: Schema.NullOr(TrimmedNonEmptyString),
});
export type ScriptsRunResult = typeof ScriptsRunResult.Type;
