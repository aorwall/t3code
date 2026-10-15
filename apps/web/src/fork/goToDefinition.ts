/**
 * Go to definition from the file viewer: Cmd- or Ctrl-click a symbol and the
 * file that declares it opens at the declaration.
 *
 * Fork-only. The answer comes from `projects.goToDefinition`, which a Moatless
 * sandbox serves from a language server it starts for the Workspace's
 * `languageServers`. Upstream's server refuses the method, so against it the
 * click shows a toast and nothing else changes.
 *
 * Pierre renders each line as a `[data-line="N"]` element holding only that
 * line's code, inside an open shadow root; `composedPath()` reaches into it.
 */
import { createEnvironmentRpcQueryAtomFamily } from "@t3tools/client-runtime/state/runtime";
import { WS_METHODS, type EnvironmentId, type ScopedThreadRef } from "@t3tools/contracts";
import { Cause } from "effect";
import { useCallback, type MouseEvent as ReactMouseEvent } from "react";

import { toastManager } from "../components/ui/toast";
import { connectionAtomRuntime } from "../connection/runtime";
import { useRightPanelStore } from "../rightPanelStore";
import { useAtomQueryRunner } from "../state/use-atom-query-runner";

export const projectGoToDefinition = createEnvironmentRpcQueryAtomFamily(connectionAtomRuntime, {
  label: "environment-data:projects:go-to-definition",
  tag: WS_METHODS.projectsGoToDefinition,
  staleTimeMs: 0,
  idleTtlMs: 10_000,
});

export interface SymbolPosition {
  /** 1-based. */
  readonly line: number;
  /** 1-based, in UTF-16 code units — the unit a JS string and LSP both count in. */
  readonly column: number;
}

/**
 * The line and column under a click, or `null` when the click did not land on
 * a character of a rendered code line.
 */
export function symbolPositionFromEvent(event: MouseEvent): SymbolPosition | null {
  const path = event.composedPath();
  const lineElement = path.find(
    (node): node is HTMLElement => node instanceof HTMLElement && node.hasAttribute("data-line"),
  );
  if (!lineElement) return null;
  const line = Number(lineElement.getAttribute("data-line"));
  if (!Number.isInteger(line) || line < 1) return null;
  const target = path[0];
  if (!(target instanceof Node) || !lineElement.contains(target)) return null;
  const hit = characterAtPoint(target, event.clientX, event.clientY);
  if (!hit) return null;
  return { line, column: columnOf(lineElement, hit.node, hit.offset) };
}

/** The text node and offset of the character drawn under `x`/`y`, within `root`. */
function characterAtPoint(root: Node, x: number, y: number): { node: Text; offset: number } | null {
  const ownerDocument = root.ownerDocument;
  if (!ownerDocument) return null;
  const range = ownerDocument.createRange();
  for (const node of textNodes(root)) {
    for (let offset = 0; offset < node.data.length; offset += 1) {
      range.setStart(node, offset);
      range.setEnd(node, offset + 1);
      const rect = range.getBoundingClientRect();
      if (x >= rect.left && x < rect.right && y >= rect.top && y < rect.bottom) {
        return { node, offset };
      }
    }
  }
  return null;
}

/** 1-based column of `offset` in `node`, counting every character of the line before it. */
export function columnOf(lineElement: Node, node: Text, offset: number): number {
  let before = 0;
  for (const text of textNodes(lineElement)) {
    if (text === node) return before + offset + 1;
    before += text.data.length;
  }
  return offset + 1;
}

function* textNodes(root: Node): Generator<Text> {
  if (root instanceof Text) {
    yield root;
    return;
  }
  const ownerDocument = root.ownerDocument;
  if (!ownerDocument) return;
  const walker = ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node instanceof Text) yield node;
  }
}

/**
 * A capture-phase click handler for the file viewer. `relativePath` is `null`
 * for a file outside the workspace, which no language server in the sandbox
 * can see; the handler then lets every click through.
 */
export function useGoToDefinitionClick(options: {
  readonly environmentId: EnvironmentId;
  readonly cwd: string;
  readonly relativePath: string | null;
  readonly threadRef: ScopedThreadRef;
}): (event: ReactMouseEvent) => void {
  const { environmentId, cwd, relativePath, threadRef } = options;
  // `refresh` because the same position can mean a different symbol after an edit.
  const lookUp = useAtomQueryRunner(projectGoToDefinition, {
    reportFailure: false,
    refresh: true,
  });
  return useCallback(
    (event: ReactMouseEvent) => {
      if (relativePath === null || !(event.metaKey || event.ctrlKey) || event.button !== 0) {
        return;
      }
      const position = symbolPositionFromEvent(event.nativeEvent);
      if (!position) return;
      // Claimed so the click does not also select the line or move the caret.
      event.preventDefault();
      event.stopPropagation();
      void (async () => {
        const result = await lookUp({
          environmentId,
          input: { cwd, relativePath, ...position },
        });
        if (result._tag === "Failure") {
          const error = Cause.squash(result.cause);
          toastManager.add({
            type: "error",
            title: "Could not go to definition",
            description: error instanceof Error ? error.message : undefined,
          });
          return;
        }
        const [first] = result.value.locations;
        if (!first) {
          toastManager.add({ type: "info", title: "No definition found in the workspace" });
          return;
        }
        useRightPanelStore.getState().openFile(threadRef, first.relativePath, first.line);
      })();
    },
    [cwd, environmentId, lookUp, relativePath, threadRef],
  );
}
