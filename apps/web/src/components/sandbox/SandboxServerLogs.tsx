/**
 * Fork-only: a server's live output, inside the sandbox panel's Servers row.
 *
 * The first consumer of `servers.subscribeLogs`. The environment retains
 * nothing, so a subscription that opens after a server has already failed sees
 * only what it prints next — which is why the row keeps its `error` above this
 * rather than expecting the log to explain itself.
 */
import type { ScopedThreadRef } from "@t3tools/contracts";
import { useEffect, useRef } from "react";

import { useEnvironmentQuery } from "~/state/query";
import { serversEnvironment } from "~/state/servers";

export function SandboxServerLogs({
  threadRef,
  name,
}: {
  readonly threadRef: ScopedThreadRef;
  readonly name: string;
}) {
  const logs = useEnvironmentQuery(
    serversEnvironment.logs({
      environmentId: threadRef.environmentId,
      input: { threadId: threadRef.threadId, name },
    }),
  );
  const viewport = useRef<HTMLPreElement>(null);
  const lines = logs.data?.lines ?? [];

  // Pinned to the bottom unconditionally: the pane is opened to watch a server
  // start, and it is short enough that scrolling back is a scroll, not a hunt.
  useEffect(() => {
    const node = viewport.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [lines.length]);

  return (
    <pre
      ref={viewport}
      className="mt-1.5 max-h-48 overflow-auto rounded-sm bg-muted/40 px-2 py-1.5 font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-words text-muted-foreground"
    >
      {logs.error ??
        (lines.length === 0
          ? "Waiting for output. Nothing printed before now is retained."
          : lines.join("\n"))}
    </pre>
  );
}
