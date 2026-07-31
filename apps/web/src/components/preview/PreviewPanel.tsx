"use client";

import type { ScopedThreadRef } from "@t3tools/contracts";

import { previewRuntimeCapability } from "~/previewStateStore";

import { PreviewPanelShell, type PreviewPanelMode } from "./PreviewPanelShell";
import { PreviewView } from "./PreviewView";

interface Props {
  mode: PreviewPanelMode;
  threadRef: ScopedThreadRef;
  tabId?: string | null;
  configuredUrls?: ReadonlyArray<string> | undefined;
  visible: boolean;
}

export function PreviewPanel({ mode, threadRef, tabId, configuredUrls, visible }: Props) {
  // Nothing to draw into: server rendering, where there is no DOM at all.
  if (previewRuntimeCapability() === "none") {
    return (
      <PreviewPanelShell mode={mode}>
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
          <p className="max-w-sm text-sm text-muted-foreground">
            Preview is not available in this runtime.
          </p>
        </div>
      </PreviewPanelShell>
    );
  }

  return (
    <PreviewPanelShell mode={mode}>
      <PreviewView
        threadRef={threadRef}
        {...(tabId !== undefined ? { tabId } : {})}
        configuredUrls={configuredUrls}
        visible={visible}
      />
    </PreviewPanelShell>
  );
}
