import type { ProjectScript, ResolvedKeybindingsConfig } from "@t3tools/contracts";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";

import ProjectScriptsControl from "./ProjectScriptsControl";

const EMPTY_KEYBINDINGS: ResolvedKeybindingsConfig = [];
const PRIMARY_SCRIPT: ProjectScript = {
  id: "dev",
  name: "Dev",
  command: "vp dev",
  icon: "play",
  runOnWorktreeCreate: false,
};

function renderControl(scripts: ReadonlyArray<ProjectScript>, editable = false) {
  return renderToStaticMarkup(
    <ProjectScriptsControl
      scripts={scripts}
      keybindings={EMPTY_KEYBINDINGS}
      editable={editable}
      onRunScript={() => {}}
      onAddScript={async () => undefined as never}
      onUpdateScript={async () => undefined as never}
      onDeleteScript={async () => undefined as never}
    />,
  );
}

function buttonTag(html: string, ariaLabel: string) {
  return html.match(new RegExp(`<button[^>]*aria-label="${ariaLabel}"[^>]*>`))?.[0];
}

function expectResponsiveXsControl(markup: string | undefined) {
  expect(markup).toBeDefined();
  expect(markup).toContain("h-7");
  expect(markup).toContain("gap-1");
  expect(markup).toContain("text-sm");
  expect(markup).toContain("sm:h-6");
  expect(markup).toContain("sm:text-xs");
  expect(markup).toContain("w-7");
  expect(markup).toContain("px-0");
  expect(markup).toContain("sm:w-6");
  expect(markup).toContain("@3xl/header-actions:w-auto!");
  expect(markup).toContain("@3xl/header-actions:px-[calc(--spacing(2)-1px)]");
}

describe("ProjectScriptsControl compact controls", () => {
  it("keeps the primary Run control compact and expands it with its label", () => {
    const html = renderControl([PRIMARY_SCRIPT]);

    expectResponsiveXsControl(buttonTag(html, "Run Dev"));
    expect(html).toContain(
      'class="sr-only @3xl/header-actions:not-sr-only @3xl/header-actions:ml-0.5"',
    );
  });

  // Fork: on a read-only (git-synced) workspace the viewer cannot add a script,
  // so with none to run either the control leaves the header entirely rather
  // than rendering an empty shell.
  it("renders nothing when there is no script to run and editing is off", () => {
    expect(renderControl([], false)).toBe("");
  });

  // Fork: an editable (manual/overridden) workspace can add a script even when
  // none is declared yet, so the standalone Add control takes the header.
  it("offers a standalone Add control when editable with no script to run", () => {
    const html = renderControl([], true);

    expect(html).not.toBe("");
    expect(buttonTag(html, "Add action")).toBeDefined();
  });

  // Fork: a read-only workspace still runs a declared script; the per-script
  // Edit affordance lives inside the (closed) actions menu, gated on `editable`.
  it("keeps the Run control for a declared script regardless of editability", () => {
    expect(buttonTag(renderControl([PRIMARY_SCRIPT], false), "Run Dev")).toBeDefined();
    expect(buttonTag(renderControl([PRIMARY_SCRIPT], true), "Run Dev")).toBeDefined();
  });
});
