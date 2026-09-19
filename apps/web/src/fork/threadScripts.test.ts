import type { ProjectScript, ThreadScript } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { threadScriptsView } from "./threadScripts";

const projectScript = (id: string, name: string): ProjectScript => ({
  id,
  name,
  command: `echo ${id}`,
  icon: "play",
  runOnWorktreeCreate: false,
});

const threadScript = (id: string, scope: ThreadScript["scope"], name?: string): ThreadScript => ({
  ...projectScript(id, name ?? id),
  scope,
});

describe("threadScriptsView", () => {
  it("lists what the backend answered, without its scope field", () => {
    const view = threadScriptsView(
      [threadScript("build", "workspace"), threadScript("dev", "task")],
      [],
    );

    expect(view.scripts).toEqual([projectScript("build", "build"), projectScript("dev", "dev")]);
  });

  it("names only the scripts the thread declared for itself", () => {
    const view = threadScriptsView(
      [threadScript("build", "workspace"), threadScript("dev", "task")],
      [],
    );

    expect([...view.taskScopedIds]).toEqual(["dev"]);
  });

  it("takes the backend's merge whole, so a thread script shadowing a project one appears once", () => {
    const view = threadScriptsView(
      [threadScript("dev", "task", "dev (this task)")],
      [projectScript("dev", "dev")],
    );

    expect(view.scripts.map((script) => script.name)).toEqual(["dev (this task)"]);
  });

  it("falls back to the project's scripts when the thread's could not be read", () => {
    const view = threadScriptsView(null, [projectScript("build", "build")]);

    expect(view.scripts).toEqual([projectScript("build", "build")]);
    expect(view.taskScopedIds.size).toBe(0);
  });
});
