/**
 * Fork-only. What a ```mermaid fence in chat shows, and the mermaid render it
 * shows it from.
 *
 * Upstream renders every fence as highlighted source, which is right for source
 * and wrong for a picture. Against Moatless an agent draws a sequence diagram to
 * be looked at, and reading its source is reading the description of a thing
 * instead of the thing. So this is additive to upstream's code block rather than
 * a replacement for it: the source stays the fallback, and there is always a way
 * back to it.
 *
 * Everything here is module state on purpose — one lazily-loaded mermaid, one
 * render at a time, one cache of what came out — and none of it belongs to a
 * component instance:
 *
 * - **Lazy.** Mermaid is around a megabyte of JavaScript. It is imported on
 *   first sight of a mermaid fence and never before, so a person who never sees
 *   one never pays for it.
 * - **Serialized.** `initialize` sets global config, and the theme is part of
 *   it, so two renders in flight across a theme switch would draw one diagram
 *   with the other's colors. One at a time costs nothing here — diagrams are
 *   rare and small — and removes the race outright.
 * - **Cached.** The message list is virtualized, so a diagram scrolled out of
 *   view and back is a fresh mount. Without the cache every one of those is a
 *   re-render of the SVG and a visible flash of source.
 */
import { fnv1a32 } from "~/lib/diffRendering";
import { LRUCache } from "~/lib/lruCache";

/** The fence language this fork draws instead of highlighting. */
export const MERMAID_FENCE_LANGUAGE = "mermaid";

export type MermaidRenderStatus = "pending" | "ready" | "failed";

/** What the code block's body shows. */
export type MermaidBlockView = "diagram" | "source" | "source-with-error";

export interface MermaidBlockPresentation {
  readonly view: MermaidBlockView;
  /** Whether to offer the way to the source, and the way back from it. */
  readonly canToggleSource: boolean;
}

/**
 * The one decision this block makes. Streaming outranks everything: a fence
 * that is still arriving is a half-written diagram, and mermaid would reject
 * most of the prefixes on the way to a valid one, so a message would flicker
 * through a parse error per token before settling. Waiting for the last token
 * costs nothing, because source is what upstream would have shown anyway.
 */
export function resolveMermaidBlockPresentation(input: {
  readonly status: MermaidRenderStatus;
  readonly isStreaming: boolean;
  readonly sourceRequested: boolean;
}): MermaidBlockPresentation {
  if (input.isStreaming) return { view: "source", canToggleSource: false };
  // A diagram that could not be drawn says so; offering "show diagram" would be
  // a button that does nothing.
  if (input.status === "failed") return { view: "source-with-error", canToggleSource: false };
  // Source is the honest placeholder while mermaid loads. A spinner here would
  // hide content that is already on the screen and ready to read.
  if (input.status === "pending") return { view: "source", canToggleSource: false };
  return { view: input.sourceRequested ? "source" : "diagram", canToggleSource: true };
}

type ResolvedTheme = "light" | "dark";

const MAX_DIAGRAM_CACHE_ENTRIES = 120;
const MAX_DIAGRAM_CACHE_MEMORY_BYTES = 8 * 1024 * 1024;

const renderedDiagramCache = new LRUCache<string>(
  MAX_DIAGRAM_CACHE_ENTRIES,
  MAX_DIAGRAM_CACHE_MEMORY_BYTES,
);

/** Keyed on the theme too: the colors are baked into the SVG mermaid returns. */
export function mermaidCacheKey(code: string, theme: ResolvedTheme): string {
  return `${fnv1a32(code).toString(36)}:${code.length}:${theme}`;
}

export function readCachedMermaidSvg(cacheKey: string): string | null {
  return renderedDiagramCache.get(cacheKey);
}

type MermaidApi = (typeof import("mermaid"))["default"];

let mermaidPromise: Promise<MermaidApi> | null = null;

function loadMermaid(): Promise<MermaidApi> {
  mermaidPromise ??= import("mermaid").then((module) => module.default);
  return mermaidPromise;
}

let initializedTheme: ResolvedTheme | null = null;
let renderQueue: Promise<unknown> = Promise.resolve();
let renderSequence = 0;

/**
 * Draw `code`, or reject. Resolves from cache without touching mermaid when the
 * same source has already been drawn for the same theme.
 */
export function renderMermaidSvg(code: string, theme: ResolvedTheme): Promise<string> {
  const cacheKey = mermaidCacheKey(code, theme);
  const cached = renderedDiagramCache.get(cacheKey);
  if (cached !== null) return Promise.resolve(cached);

  const draw = () => drawDiagram(code, theme, cacheKey);
  // Both arms, so one rejected diagram does not stop the queue behind it.
  const rendered = renderQueue.then(draw, draw);
  renderQueue = rendered.then(
    () => undefined,
    () => undefined,
  );
  return rendered;
}

async function drawDiagram(
  code: string,
  theme: ResolvedTheme,
  cacheKey: string,
): Promise<string> {
  const mermaid = await loadMermaid();

  if (initializedTheme !== theme) {
    mermaid.initialize({
      startOnLoad: false,
      // The source is model-written and arrives over the wire, so mermaid
      // sanitizes what it draws and no label may carry a script or a handler.
      securityLevel: "strict",
      theme: theme === "dark" ? "dark" : "default",
    });
    initializedTheme = theme;
  }

  // Ask before drawing. `render` reports a bad diagram by drawing an error card
  // into the document, which is mermaid's answer for a page that mounted it
  // itself and the wrong one here — a rejected promise is all this needs, and
  // the code block behind it is a better error message than the card.
  if ((await mermaid.parse(code, { suppressErrors: true })) === false) {
    throw new Error("mermaid could not parse the diagram source");
  }

  renderSequence += 1;
  const { svg } = await mermaid.render(`chat-mermaid-${renderSequence}`, code);
  renderedDiagramCache.set(cacheKey, svg, svg.length * 2);
  return svg;
}
