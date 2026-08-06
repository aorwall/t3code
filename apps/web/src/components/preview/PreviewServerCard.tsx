import type { ThreadServer } from "@t3tools/contracts";
import { LoaderCircleIcon } from "lucide-react";

import { cn } from "~/lib/utils";

import { BrowserMockup } from "./BrowserMockup";

const STATUS_LABEL: Record<ThreadServer["status"], string> = {
  stopped: "Stopped",
  installing: "Installing",
  starting: "Starting",
  started: "Started",
  failed: "Failed",
};

interface Props {
  server: ThreadServer;
  onOpen: () => void;
}

/**
 * One row in the preview-server picker.
 *
 * Fork-only: it renders a `ThreadServer`, a Moatless concept upstream does not
 * have.
 */
export function PreviewServerCard({ server, onOpen }: Props) {
  const canOpen = server.url !== null;
  return (
    <button
      type="button"
      disabled={!canOpen}
      onClick={onOpen}
      className="group flex w-full items-center gap-3 px-3 py-3 text-left hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:bg-transparent"
    >
      <BrowserMockup className="size-7 shrink-0" />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium text-foreground">
          {server.label}
          {server.default ? (
            <span className="ml-1.5 text-xs font-normal text-muted-foreground">default</span>
          ) : null}
        </span>
        <span className="truncate text-xs text-muted-foreground">
          {server.name} · port {server.port}
          {server.error === null ? "" : ` · ${server.error}`}
        </span>
      </div>
      <ServerStatusIndicator status={server.status} />
    </button>
  );
}

/**
 * What the row says about the server's state.
 *
 * A server on its way up is the one worth telling apart: it is the only status
 * that resolves on its own, and it is the whole answer to why the page behind
 * it is blank. A dot cannot say that, so the coming-up states spin and every
 * state that isn't `started` carries its word — which also keeps the row from
 * being colour-only, the reading of it that fails first.
 */
function ServerStatusIndicator({ status }: { readonly status: ThreadServer["status"] }) {
  if (status === "started") return <PulsingDot />;

  const comingUp = status === "installing" || status === "starting";
  return (
    <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
      {comingUp ? (
        <LoaderCircleIcon className="size-3.5 shrink-0 animate-spin" />
      ) : (
        <span
          aria-hidden
          className={cn(
            "size-2 shrink-0 rounded-full",
            status === "failed" ? "bg-destructive" : "bg-muted-foreground/40",
          )}
        />
      )}
      {STATUS_LABEL[status]}
    </span>
  );
}

function PulsingDot() {
  return (
    <span aria-label="Started" className="relative inline-flex size-2 shrink-0">
      <span className="absolute inset-0 animate-status-ping rounded-full bg-success opacity-60" />
      <span className="relative inline-flex size-2 rounded-full bg-success" />
    </span>
  );
}
