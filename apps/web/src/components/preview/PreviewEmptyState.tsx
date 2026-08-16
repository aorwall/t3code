import type { ScopedThreadRef } from "@t3tools/contracts";
import { Globe, History, RadioTower } from "lucide-react";

import type { BrowserHistoryEntry } from "~/browserHistoryStore";
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "~/components/ui/empty";

import { PreviewRecentUrlCard } from "./PreviewRecentUrlCard";
import { PreviewServerCard } from "./PreviewServerCard";
import { useThreadPreviewServers } from "./useThreadPreviewServers";

interface Props {
  threadRef: ScopedThreadRef;
  recentEntries: ReadonlyArray<BrowserHistoryEntry>;
  onRemoveRecent: (url: string) => void;
  onOpenUrl: (url: string) => void;
}

export function PreviewEmptyState({ threadRef, recentEntries, onRemoveRecent, onOpenUrl }: Props) {
  // Fork: the servers come from the thread's Moatless sandbox, not from a local
  // port scan — nothing this client can reach is on the user's own machine.
  const { servers, isPending, error } = useThreadPreviewServers(threadRef);
  const recents = recentEntries.filter((entry) => URL.canParse(entry.url)).slice(0, 8);

  if (servers.length === 0 && recents.length === 0) {
    return (
      <Empty>
        <EmptyMedia variant="icon">
          <Globe className="size-4.5 text-muted-foreground" />
        </EmptyMedia>
        <EmptyTitle>No preview yet</EmptyTitle>
        <EmptyDescription>
          {isPending
            ? "Loading preview servers..."
            : (error ?? "Type a URL above, or wait for preview servers to appear.")}
        </EmptyDescription>
      </Empty>
    );
  }

  return (
    <div className="flex h-full min-h-0 overflow-y-auto px-5 py-8">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
        {recents.length > 0 ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <History className="size-4 shrink-0" />
              <h2 className="font-medium">Recently used</h2>
            </div>
            <div className="flex flex-col divide-y divide-border/60 overflow-hidden rounded-xl border border-border/70 bg-background">
              {recents.map((entry) => (
                <PreviewRecentUrlCard
                  key={entry.url}
                  threadRef={threadRef}
                  entry={entry}
                  onOpen={() => onOpenUrl(entry.url)}
                  onRemove={() => onRemoveRecent(entry.url)}
                />
              ))}
            </div>
          </div>
        ) : null}
        {servers.length > 0 ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <RadioTower className="size-4 shrink-0" />
              <h2 className="font-medium">Preview servers</h2>
            </div>
            {error === null ? null : <p className="px-1 text-xs text-muted-foreground">{error}</p>}
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
        ) : null}
      </div>
    </div>
  );
}
