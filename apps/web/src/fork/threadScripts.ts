/**
 * Fork-only. The scripts one thread can run, including ones declared for that thread alone
 * (stored with its state, not its project). The backend merges them and knows which shadows
 * which; the project's list stays the answer when the read is pending, failed or unserved,
 * keeping the header identical to upstream's without the `taskScripts` capability.
 */
import type { EnvironmentId, ProjectScript, ThreadId, ThreadScript } from "@t3tools/contracts";

import { useEnvironment } from "~/state/environments";
import { useEnvironmentQuery } from "~/state/query";
import { scriptsEnvironment } from "~/state/scripts";

const NO_TASK_SCRIPT_IDS: ReadonlySet<string> = new Set<string>();

export interface ThreadScriptsView {
  /** What the Run control lists: the thread's own scripts over its project's,
      or the project's alone when the thread's could not be read. */
  readonly scripts: ReadonlyArray<ProjectScript>;
  /** Which of `scripts` the thread declared for itself. Those are not in the
      project's list, so writing that list back would neither change nor delete
      one, and the control offers no edit for them. */
  readonly taskScopedIds: ReadonlySet<string>;
}

/**
 * What the control renders, given what `scripts.listForThread` answered.
 *
 * `listed` is null when the read is absent, in flight or failed, and the
 * project's own scripts are the answer then — they are still true, and a
 * stopped sandbox is the ordinary case.
 */
export function threadScriptsView(
  listed: ReadonlyArray<ThreadScript> | null,
  projectScripts: ReadonlyArray<ProjectScript>,
): ThreadScriptsView {
  if (listed === null) {
    return { scripts: projectScripts, taskScopedIds: NO_TASK_SCRIPT_IDS };
  }
  return {
    scripts: listed.map(({ scope: _scope, ...script }) => script),
    taskScopedIds: new Set(
      listed.filter((script) => script.scope === "task").map((script) => script.id),
    ),
  };
}

/** Read every script this thread can run. */
export function useThreadScripts({
  environmentId,
  threadId,
  projectScripts,
}: {
  environmentId: EnvironmentId | null;
  threadId: ThreadId | null;
  projectScripts: ReadonlyArray<ProjectScript>;
}): ThreadScriptsView {
  const environment = useEnvironment(environmentId);
  const supported = environment?.serverConfig?.environment.capabilities.taskScripts === true;
  const { data } = useEnvironmentQuery(
    environmentId === null || threadId === null || !supported
      ? null
      : scriptsEnvironment.listForThread({ environmentId, input: { threadId } }),
  );
  const listed = data?.scripts ?? null;

  return threadScriptsView(listed, projectScripts);
}
