"use client";

import { useEffect, useState } from "react";

import { Button } from "~/components/ui/button";

/**
 * How long a running server's page is given before the panel offers a way out.
 *
 * Not measured against a cold-start dev server, and deliberately generous: too
 * low and the strip appears on every first load, which would teach people to
 * ignore it.
 */
export const FRAME_UNRENDERED_HINT_DELAY_MS = 12_000;

/**
 * A guess, offered as one.
 *
 * Two things look identical from outside a cross-origin frame: a page that
 * refuses to be embedded, and the preview host's own 401 rendered in place of
 * one. Neither is detectable — `onload` fires for both and `onerror` fires for
 * neither — so this strip appears on time rather than on evidence, and its
 * wording must not claim to know which happened.
 */
export function PreviewFrameUnrendered({
  onOpenInBrowser,
}: {
  readonly onOpenInBrowser: () => void;
}) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  return (
    <div className="pointer-events-auto absolute inset-x-0 bottom-0 z-20 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border/70 bg-background/95 px-3 py-2 text-xs backdrop-blur">
      <span className="text-muted-foreground">
        Still blank? Some pages won&rsquo;t render inside the panel.
      </span>
      <div className="flex-1" />
      <Button type="button" size="sm" variant="outline" onClick={onOpenInBrowser}>
        Open in a browser tab
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={() => setDismissed(true)}>
        Dismiss
      </Button>
    </div>
  );
}

/**
 * Whether enough time has passed on this URL to offer the hint.
 *
 * The timer restarts on every navigation, so following a link inside the frame
 * does not carry a stale verdict forward.
 */
export function useFrameUnrenderedHint(url: string, serverStarted: boolean): boolean {
  const [elapsed, setElapsed] = useState(false);
  useEffect(() => {
    setElapsed(false);
    if (url === "" || !serverStarted) return;
    const timer = window.setTimeout(() => setElapsed(true), FRAME_UNRENDERED_HINT_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [serverStarted, url]);
  return elapsed;
}
