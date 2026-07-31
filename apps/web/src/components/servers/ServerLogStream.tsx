"use client";

import type { ScopedThreadRef } from "@t3tools/contracts";
import { useEffect, useRef, useState } from "react";

import { Button } from "~/components/ui/button";
import { useEnvironmentQuery } from "~/state/query";
import { serversEnvironment } from "~/state/servers";

/**
 * One server's log, live.
 *
 * Nothing is retained on the server, so a subscription that reconnects gets
 * only new lines and the gap is not backfilled. The view says so rather than
 * presenting a partial log as a whole one.
 */
export function ServerLogStream({
  threadRef,
  name,
}: {
  readonly threadRef: ScopedThreadRef;
  readonly name: string;
}) {
  const [previous, setPrevious] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const logs = useEnvironmentQuery(
    serversEnvironment.logs({
      environmentId: threadRef.environmentId,
      input: { threadId: threadRef.threadId, name, previous },
    }),
  );
  const lines = logs.data?.lines ?? [];
  const dropped = logs.data?.dropped ?? 0;

  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [lines.length]);

  return (
    <div className="flex min-h-0 flex-col gap-1.5 border-t border-border/60 bg-muted/20 px-3 py-2">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>{previous ? "Previous instance" : "Running instance"}</span>
        <div className="flex-1" />
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setPrevious((value) => !value)}
        >
          {previous ? "Show current" : "Show previous"}
        </Button>
      </div>
      {logs.error === null ? null : (
        <p className="text-xs text-destructive-foreground">{logs.error}</p>
      )}
      <div
        ref={scrollRef}
        className="max-h-64 overflow-auto rounded-md border border-border/60 bg-background p-2 font-mono text-[11px] leading-relaxed"
      >
        {lines.length === 0 ? (
          <p className="text-muted-foreground">
            {logs.error === null ? "Waiting for output…" : "No output."}
          </p>
        ) : (
          <>
            {dropped > 0 ? (
              <p className="pb-1 text-muted-foreground">
                {dropped.toLocaleString()} earlier lines dropped.
              </p>
            ) : null}
            {lines.map((line, index) => (
              // Log lines repeat and carry no id. Position is the only
              // identity there is, and lines only ever leave from the front.
              // eslint-disable-next-line react/no-array-index-key
              <div key={`${index}:${line}`} className="whitespace-pre-wrap break-all">
                {line}
              </div>
            ))}
          </>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground">
        Lines are not kept. Reconnecting shows only new output.
      </p>
    </div>
  );
}
