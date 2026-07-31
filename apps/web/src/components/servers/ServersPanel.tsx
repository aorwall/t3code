"use client";

import { squashAtomCommandFailure } from "@t3tools/client-runtime/state/runtime";
import type { ScopedThreadRef, ThreadServer } from "@t3tools/contracts";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";

import { addBrowserSurface } from "~/components/preview/addBrowserSurface";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { toastManager } from "~/components/ui/toast";
import { previewEnvironment } from "~/state/preview";
import { useAtomCommand } from "~/state/use-atom-command";

import { ServerLogStream } from "./ServerLogStream";
import { useThreadServers } from "./useThreadServers";

const STATUS_VARIANT = {
  stopped: "outline",
  installing: "info",
  starting: "info",
  started: "success",
  failed: "error",
} as const satisfies Record<ThreadServer["status"], string>;

const SANDBOX_EXPLANATION: Record<string, string> = {
  not_created: "This environment has not been created yet.",
  initializing: "This environment is starting up.",
  stopped: "This environment is stopped.",
  removing: "This environment is being removed.",
  removed: "This environment has been removed.",
  error: "This environment is in an error state.",
};

/**
 * The servers a thread declares: what each is, what state it is in, what it is
 * printing, and a way to open one.
 *
 * Everything here is a read. Nothing in this panel starts, stops or restarts a
 * server — a row that says `failed` offers its log and no button.
 */
export function ServersPanel({ threadRef }: { readonly threadRef: ScopedThreadRef }) {
  const { servers, sandboxStatus, isPending, error } = useThreadServers(threadRef);
  const [expanded, setExpanded] = useState<string | null>(null);
  const openPreview = useAtomCommand(previewEnvironment.open, "open server preview");

  const openServer = async (server: ThreadServer) => {
    if (server.url === null) return;
    const result = await addBrowserSurface({ threadRef, openPreview, url: server.url });
    if (result._tag === "Failure") {
      const failure = squashAtomCommandFailure(result);
      toastManager.add({
        type: "error",
        title: `Unable to open ${server.label}`,
        description: failure instanceof Error ? failure.message : "An error occurred.",
      });
    }
  };

  // What a row says and whether anything is running are different facts. A
  // thread whose environment was never created still lists every server it
  // declares, and each of those rows carries the status resolution falls back
  // to rather than one it read — so the environment's own state is stated once,
  // above the list, instead of being inferred from rows that cannot say it.
  const sandboxNote =
    sandboxStatus === null || sandboxStatus === "ready"
      ? null
      : (SANDBOX_EXPLANATION[sandboxStatus] ?? null);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-background">
      {error === null ? null : (
        <p className="border-b border-border/60 px-3 py-2 text-xs text-destructive-foreground">
          {error}
        </p>
      )}
      {sandboxNote === null || servers.length === 0 ? null : (
        <p className="border-b border-border/60 px-3 py-2 text-xs text-muted-foreground">
          {sandboxNote}
        </p>
      )}
      {servers.length === 0 ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
          <p className="max-w-sm text-sm text-muted-foreground">
            {isPending ? "Loading servers…" : (sandboxNote ?? "This thread declares no servers.")}
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border/60">
          {servers.map((server) => {
            const isExpanded = expanded === server.name;
            return (
              <li key={server.name}>
                <div className="flex items-center gap-2 px-3 py-2">
                  <Button
                    type="button"
                    size="icon-xs"
                    variant="ghost"
                    aria-expanded={isExpanded}
                    aria-label={
                      isExpanded ? `Hide ${server.label} log` : `Show ${server.label} log`
                    }
                    onClick={() => setExpanded(isExpanded ? null : server.name)}
                  >
                    {isExpanded ? <ChevronDown /> : <ChevronRight />}
                  </Button>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium text-foreground">
                      {server.label}
                      {server.default ? (
                        <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                          default
                        </span>
                      ) : null}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {server.name} · port {server.port}
                      {server.error === null ? "" : ` · ${server.error}`}
                    </span>
                  </div>
                  <Badge variant={STATUS_VARIANT[server.status]} size="sm">
                    {server.status}
                  </Badge>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={server.url === null}
                    onClick={() => void openServer(server)}
                  >
                    Open
                  </Button>
                </div>
                {isExpanded ? <ServerLogStream threadRef={threadRef} name={server.name} /> : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
