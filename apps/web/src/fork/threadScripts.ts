/**
 * Fork-only. The scripts one thread can run, its own declarations included.
 *
 * A Moatless thread may declare scripts of its own, stored beside that thread's
 * state rather than on its project: an agent that brings up a dev server
 * registers it as it goes, for that task alone. No project carries those, so
 * the project's script list cannot show them and the header's Run control would
 * offer a thread nothing the agent just made for it.
 *
 * So the control renders this list instead. The backend does the merging — it
 * is the side that knows which declaration shadows which — and the project's
 * list is the answer whenever the read has not come back, failed, or is not
 * served at all. That keeps the header identical to upstream's on an
 * environment without the `taskScripts` capability, and identical to its own
 * previous behaviour while the first read is in flight.
 */
import type { EnvironmentId, ProjectScript, ThreadId, ThreadScript } from "@t3tools/contracts";
import { useMemo } from "react";

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

  return useMemo(() => threadScriptsView(listed, projectScripts), [listed, projectScripts]);
}
