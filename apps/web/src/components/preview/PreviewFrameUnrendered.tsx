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
 * A guess, offered as one. A page that refuses embedding and the preview host's own 401 look
 * identical from outside a cross-origin frame (`onload` fires for both, `onerror` for neither),
 * so this strip appears on time, and its wording must not claim to know which happened.
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
export function useFrameUnrenderedHint(url: string): boolean {
  // Tracked alongside the url it was timed for, and reset during render when
  // it moves on, so a stale "elapsed" from the previous page never flashes
  // before the effect below gets a chance to restart the timer.
  const [state, setState] = useState({ url, elapsed: false });
  if (state.url !== url) {
    setState({ url, elapsed: false });
  }

  // oxlint-disable-next-line t3code/react-effect-budget -- Fork: a timer that flips the hint on after a delay.
  useEffect(() => {
    if (url === "") return;
    const timer = window.setTimeout(
      () => setState({ url, elapsed: true }),
      FRAME_UNRENDERED_HINT_DELAY_MS,
    );
    return () => window.clearTimeout(timer);
  }, [url]);

  return state.elapsed;
}
