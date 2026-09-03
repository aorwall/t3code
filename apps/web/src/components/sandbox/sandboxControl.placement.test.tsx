/**
 * Fork-only: where the right panel puts the sandbox status control.
 *
 * The control is a fork element inside an upstream component, and its home is a
 * placement rather than a symbol — nothing type-checks that it renders in the
 * panel body instead of the tab bar, where it used to sit and where upstream's
 * layout toggles now live. A merge that carries the fork's `sandboxControl`
 * hunk back into the tab bar row compiles and passes every other test, and the
 * terminal-drawer button quietly loses its corner again.
 */
import type { PreviewSessionSnapshot } from "@t3tools/contracts";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";

import type { RightPanelSurface } from "~/rightPanelStore";
import { RightPanelTabs } from "../RightPanelTabs";

const NO_SESSIONS: Readonly<Record<string, PreviewSessionSnapshot>> = {};
const CONTROL_MARKER = "data-sandbox-control-marker";

const BODY_BOUNDARY = "data-right-panel-surface-content";

// A surface that lives inside the workspace, so a stopped sandbox empties it.
const DIFF_SURFACE: RightPanelSurface = { id: "diff", kind: "diff" };

function render(options: {
  surfaceDisabled: boolean;
  surfaces?: readonly RightPanelSurface[];
  activeSurfaceId?: string | null;
}) {
  return renderToStaticMarkup(
    <RightPanelTabs
      mode="inline"
      surfaces={options.surfaces ?? []}
      activeSurfaceId={options.activeSurfaceId ?? null}
      pendingSurfaceIds={new Set()}
      previewSessions={NO_SESSIONS}
      desktopByTabId={{}}
      terminalLabelsById={new Map()}
      onActivate={() => undefined}
      onCloseSurface={() => undefined}
      onCloseOtherSurfaces={() => undefined}
      onCloseSurfacesToRight={() => undefined}
      onCloseAllSurfaces={() => undefined}
      onCopyFilePath={() => undefined}
      onAddBrowser={() => undefined}
      onAddTerminal={() => undefined}
      onAddPullRequest={() => undefined}
      onAddDiff={() => undefined}
      onAddFiles={() => undefined}
      onAddAgents={() => undefined}
      liveAgentCount={0}
      browserAvailable
      terminalAvailable
      diffAvailable
      filesAvailable
      pullRequestAvailable
      agentsAvailable
      surfaceDisabled={options.surfaceDisabled}
      surfaceDisabledReason="Start the sandbox to use right-panel surfaces."
      sandboxControl={<span {...{ [CONTROL_MARKER]: "" }} />}
    >
      <div>content</div>
    </RightPanelTabs>,
  );
}

/** Where the marker sits relative to the div that opens the panel body. */
function region(markup: string): "tab-bar" | "body" | "absent" {
  const marker = markup.indexOf(CONTROL_MARKER);
  if (marker === -1) return "absent";
  return marker > markup.indexOf(BODY_BOUNDARY) ? "body" : "tab-bar";
}

describe("the sandbox status control", () => {
  it("sits with the launcher's surface cards, not in the tab bar", () => {
    const markup = render({ surfaceDisabled: false });
    expect(markup).toContain("Open a surface");
    expect(region(markup)).toBe("body");
  });

  it("follows the disabled state, which is the only way back to a sandbox", () => {
    // A stopped sandbox stands the disabled state up only in front of a surface
    // that needs the workspace; the diff tab is one, so this is where it shows.
    const markup = render({
      surfaceDisabled: true,
      surfaces: [DIFF_SURFACE],
      activeSurfaceId: DIFF_SURFACE.id,
    });
    expect(markup).toContain("Sandbox required");
    expect(region(markup)).toBe("body");
  });

  it("keeps the launcher open when the sandbox is down and nothing is active", () => {
    // The point of the change: a stopped sandbox no longer curtains the panel,
    // so the surfaces it does not own — Agents — stay one keystroke away.
    const markup = render({ surfaceDisabled: true });
    expect(markup).toContain("Open a surface");
    expect(markup).not.toContain("Sandbox required");
    expect(region(markup)).toBe("body");
  });
});
