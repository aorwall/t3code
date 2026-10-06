/**
 * Fork-only. A link to a Moatless Artifact in chat markdown, shown as a chip
 * with the title the agent published it under.
 *
 * A plain click opens the page in the right panel's browser whatever "Open
 * links in" says: an Artifact is something the agent made for this
 * conversation, so it belongs beside it. A modifier click, or a client with no
 * in-app browser, keeps the anchor's own new-tab behaviour.
 */
import type { ScopedThreadRef } from "@t3tools/contracts";
import {
  type AtomCommandResult,
  isAtomCommandInterrupted,
} from "@t3tools/client-runtime/state/runtime";
import { FileTextIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { ContextChip, ContextChipLabel } from "~/components/ContextChip";
import { Tooltip, TooltipPopup, TooltipTrigger } from "~/components/ui/tooltip";
import { readLocalApi } from "~/localApi";
import { isPreviewSupportedInRuntime } from "~/previewStateStore";

import { fetchMoatlessArtifactTitle, type MoatlessArtifactLink } from "./moatlessArtifactLink";

export function MoatlessArtifactChip(props: {
  readonly href: string;
  readonly artifact: MoatlessArtifactLink;
  /** The link's own text, used when the title cannot be looked up. */
  readonly text: string;
  readonly threadRef: ScopedThreadRef | undefined;
  readonly openInPreview: (url: string) => Promise<AtomCommandResult<void, unknown>>;
}) {
  const { href, artifact, threadRef, openInPreview } = props;
  const title = useArtifactTitle(threadRef?.threadId, artifact.artifactId);
  const text = props.text.trim();
  const label = title ?? (text === "" || text === href ? "Artifact" : text);
  const canOpenInPreview = threadRef !== undefined && isPreviewSupportedInRuntime();
  const link = (
    <ContextChip
      kind="file"
      render={<a href={href} target="_blank" rel="noopener noreferrer" />}
      aria-label={`Open artifact ${label}`}
      data-markdown-copy={href}
      data-moatless-artifact-link="true"
      onClick={(event) => {
        if (
          !canOpenInPreview ||
          event.defaultPrevented ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        ) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        void openInPreview(href).then((result) => {
          if (result._tag === "Success" || isAtomCommandInterrupted(result)) return;
          // The panel could not take it; the page is still worth showing.
          void readLocalApi()?.shell.openExternal(href);
        });
      }}
    >
      <FileTextIcon aria-hidden="true" />
      <ContextChipLabel className="max-w-[24em]">{label}</ContextChipLabel>
      {artifact.version === null ? null : (
        <span className="text-muted-foreground tabular-nums">v{artifact.version}</span>
      )}
    </ContextChip>
  );
  return (
    <Tooltip>
      <TooltipTrigger render={link} />
      <TooltipPopup side="top">{href}</TooltipPopup>
    </Tooltip>
  );
}

function useArtifactTitle(taskId: string | undefined, artifactId: string): string | null {
  const [title, setTitle] = useState<{ readonly key: string; readonly value: string } | null>(null);
  const key = `${taskId}/${artifactId}`;
  useEffect(() => {
    if (taskId === undefined) return;
    let current = true;
    void fetchMoatlessArtifactTitle(taskId, artifactId).then((value) => {
      if (current && value !== null) setTitle({ key, value });
    });
    return () => {
      current = false;
    };
  }, [artifactId, key, taskId]);
  return title?.key === key ? title.value : null;
}
