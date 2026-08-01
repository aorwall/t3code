import type { ThreadServer } from "@t3tools/contracts";

import { BrowserMockup } from "./BrowserMockup";

interface Props {
  server: ThreadServer;
  onOpen: () => void;
}

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
      {server.status === "started" ? <PulsingDot /> : <DimDot label={server.status} />}
    </button>
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

function DimDot({ label }: { readonly label: ThreadServer["status"] }) {
  return (
    <span aria-label={label} className="size-2 shrink-0 rounded-full bg-muted-foreground/40" />
  );
}
