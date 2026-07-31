import type { ThreadServer } from "@t3tools/contracts";

import { Button } from "~/components/ui/button";

const HEADLINE: Record<ThreadServer["status"], string> = {
  stopped: "This server isn't running",
  installing: "This server is installing",
  starting: "This server is starting",
  started: "This server is running",
  failed: "This server failed to start",
};

const EXPLANATION: Record<ThreadServer["status"], string> = {
  stopped: "Start the environment to bring it up.",
  installing: "It's fetching dependencies. The page will load once it's serving.",
  starting: "It hasn't answered on its port yet. The page will load once it does.",
  started: "",
  failed: "Its log is in the Servers view.",
};

/**
 * What the panel can say about a page that isn't there, when the page itself
 * can't be asked.
 *
 * The desktop app renders Chromium's own error page from a reported net error.
 * A frame reports nothing, so this says what the server says about itself
 * instead — which is more useful anyway: "installing" is an answer no net
 * error carries.
 */
export function PreviewServerNotStarted({
  server,
  onOpenInBrowser,
}: {
  readonly server: ThreadServer;
  readonly onOpenInBrowser?: (() => void) | undefined;
}) {
  return (
    <div className="flex h-full min-h-0 w-full items-center justify-center overflow-y-auto bg-background px-8 py-12">
      <div className="flex w-full max-w-md flex-col items-start gap-3">
        <h1 className="text-lg font-semibold leading-tight text-foreground">
          {HEADLINE[server.status]}
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          <span className="font-medium text-foreground">{server.label}</span> on port {server.port}
          {EXPLANATION[server.status] === "" ? "." : `. ${EXPLANATION[server.status]}`}
        </p>
        {server.error === null ? null : (
          <p className="w-full break-words rounded-md border border-border bg-muted/40 p-3 font-mono text-xs text-muted-foreground">
            {server.error}
            {server.detail === null ? null : (
              <>
                {"\n"}
                {server.detail}
              </>
            )}
          </p>
        )}
        {onOpenInBrowser ? (
          <Button type="button" variant="outline" size="sm" onClick={onOpenInBrowser}>
            Open in a browser tab
          </Button>
        ) : null}
      </div>
    </div>
  );
}
