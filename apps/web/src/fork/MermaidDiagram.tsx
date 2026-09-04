/**
 * Fork-only. The body of a ```mermaid code block in chat.
 *
 * It sits inside upstream's `MarkdownCodeBlock`, so the header, the language
 * label and the copy button are upstream's and behave the same as on every
 * other fence — copy still copies the mermaid source, which is what someone
 * reaching for it wants. The only thing this replaces is what fills the block
 * below that header.
 *
 * `children` is the fence's highlighted source, passed in rather than rebuilt,
 * and it is what shows whenever the diagram does not: while the message
 * streams, while mermaid loads, when the source will not parse, and when
 * someone asks for it. A mermaid fence therefore never renders worse than it
 * did before this existed — the failure mode is upstream's code block.
 *
 * The way in needs a way out, so a diagram always carries the toggle back to
 * its source. It is a plain always-visible button, not a hover affordance: this
 * fork's client is used from a phone browser, where there is no hover.
 */
import { useEffect, useState, type ReactNode } from "react";

import { Button } from "~/components/ui/button";

import {
  mermaidCacheKey,
  readCachedMermaidSvg,
  renderMermaidSvg,
  resolveMermaidBlockPresentation,
} from "./mermaidDiagram";

interface MermaidDiagramProps {
  readonly code: string;
  readonly theme: "light" | "dark";
  readonly isStreaming: boolean;
  /** The fence's highlighted source, shown whenever the diagram is not. */
  readonly children: ReactNode;
}

type RenderState =
  | { readonly status: "pending" | "failed" }
  | { readonly status: "ready"; readonly svg: string };

/** A cached diagram is state the first render already has, and reading it here
 *  rather than in an effect is what keeps a virtualized row that scrolls back
 *  into view from flashing its source. */
function initialRenderState(cacheKey: string): RenderState {
  const cached = readCachedMermaidSvg(cacheKey);
  return cached === null ? { status: "pending" } : { status: "ready", svg: cached };
}

export function MermaidDiagram({ code, theme, isStreaming, children }: MermaidDiagramProps) {
  const cacheKey = mermaidCacheKey(code, theme);
  const [render, setRender] = useState<RenderState>(() => initialRenderState(cacheKey));
  const [sourceRequested, setSourceRequested] = useState(false);

  useEffect(() => {
    if (isStreaming) return;

    let cancelled = false;
    renderMermaidSvg(code, theme).then(
      (svg) => {
        if (!cancelled) setRender({ status: "ready", svg });
      },
      (cause: unknown) => {
        if (cancelled) return;
        console.warn("[chat-markdown] mermaid diagram failed to render", cause);
        setRender({ status: "failed" });
      },
    );

    return () => {
      cancelled = true;
    };
  }, [code, isStreaming, theme]);

  const { view, canToggleSource } = resolveMermaidBlockPresentation({
    status: render.status,
    isStreaming,
    sourceRequested,
  });

  return (
    <>
      {view === "diagram" && render.status === "ready" ? (
        // Mermaid sanitizes what it draws under `securityLevel: "strict"`, so
        // this is SVG it produced, not markup that came off the wire.
        <div
          className="chat-markdown-mermaid overflow-x-auto px-3 py-3 [&_svg]:mx-auto [&_svg]:h-auto [&_svg]:max-w-full"
          dangerouslySetInnerHTML={{ __html: render.svg }}
        />
      ) : (
        children
      )}
      {view === "source-with-error" ? (
        <p className="chat-markdown-codeblock-header px-3 pt-1 pb-2 [font-size:0.6875rem]">
          This diagram could not be drawn, so its source is shown instead.
        </p>
      ) : null}
      {canToggleSource ? (
        <div className="flex px-1.5 pb-1.5">
          <Button
            type="button"
            variant="ghost"
            size="micro"
            className="chat-markdown-chrome-action"
            aria-pressed={view === "source"}
            onClick={() => setSourceRequested((requested) => !requested)}
          >
            {view === "source" ? "Show diagram" : "Show source"}
          </Button>
        </div>
      ) : null}
    </>
  );
}
