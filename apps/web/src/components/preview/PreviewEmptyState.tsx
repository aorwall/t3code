import type { ScopedThreadRef } from "@t3tools/contracts";
import { Globe, RadioTower } from "lucide-react";

import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "~/components/ui/empty";

import { PreviewServerCard } from "./PreviewServerCard";
import { useThreadPreviewServers } from "./useThreadPreviewServers";

interface Props {
  threadRef: ScopedThreadRef;
  onOpenUrl: (url: string) => void;
}

const SANDBOX_EXPLANATION: Record<string, string> = {
  not_created: "This environment has not been created yet.",
  initializing: "This environment is starting up.",
  stopped: "This environment is stopped.",
  removing: "This environment is being removed.",
  removed: "This environment has been removed.",
  error: "This environment is in an error state.",
};

export function PreviewEmptyState({ threadRef, onOpenUrl }: Props) {
  const { servers, sandboxStatus, isPending, error } = useThreadPreviewServers(threadRef);
  const sandboxNote =
    sandboxStatus === null || sandboxStatus === "ready"
      ? null
      : (SANDBOX_EXPLANATION[sandboxStatus] ?? null);

  if (servers.length === 0) {
    return (
      <Empty>
        <EmptyMedia variant="icon">
          <Globe className="size-4.5 text-muted-foreground" />
        </EmptyMedia>
        <EmptyTitle>No preview yet</EmptyTitle>
        <EmptyDescription>
          {isPending
            ? "Loading preview servers..."
            : (error ?? sandboxNote ?? "Type a URL above, or wait for preview servers to appear.")}
        </EmptyDescription>
      </Empty>
    );
  }

  return (
    <div className="flex h-full min-h-0 overflow-y-auto px-5 py-8">
      <div className="m-auto flex w-full max-w-xl flex-col gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <RadioTower className="size-4 shrink-0" />
          <h2 className="font-medium">Preview Servers</h2>
        </div>
        {error === null && sandboxNote === null ? null : (
          <p className="px-1 text-xs text-muted-foreground">{error ?? sandboxNote}</p>
        )}
        <div className="flex flex-col divide-y divide-border/60 overflow-hidden rounded-xl border border-border/70 bg-background">
          {servers.map((server) => (
            <PreviewServerCard
              key={server.name}
              server={server}
              onOpen={() => {
                if (server.url !== null) onOpenUrl(server.url);
              }}
            />
          ))}
        </div>
        <p className="px-1 text-xs text-muted-foreground">
          Select a server to open it in this browser tab.
        </p>
      </div>
    </div>
  );
}
