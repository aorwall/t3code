/**
 * Fork-only. A workspace file with no text to show, offered as a download.
 *
 * Moatless answers `projects.readFile` on a binary file with the contract's
 * `binary_file` failure, and mints a `workspace-file` asset with
 * `disposition: "attachment"` for any file type.
 */
import type { EnvironmentId, ScopedThreadRef } from "@t3tools/contracts";
import { DownloadIcon } from "lucide-react";
import { useMemo, useState } from "react";

import { useAssetUrlRefresh } from "~/assets/assetUrls";
import { Button } from "~/components/ui/button";
import { toastManager } from "~/components/ui/toast";

export function WorkspaceBinaryFile(props: {
  readonly environmentId: EnvironmentId;
  readonly threadRef: ScopedThreadRef;
  readonly absolutePath: string;
}) {
  const resource = useMemo(
    () => ({
      _tag: "workspace-file" as const,
      threadId: props.threadRef.threadId,
      path: props.absolutePath,
      disposition: "attachment" as const,
    }),
    [props.threadRef.threadId, props.absolutePath],
  );
  const prepareDownload = useAssetUrlRefresh(props.environmentId, resource);
  const [saving, setSaving] = useState(false);
  const name = props.absolutePath.split("/").pop() || props.absolutePath;

  const download = () => {
    setSaving(true);
    void (async () => {
      try {
        const url = await prepareDownload();
        if (!url) throw new Error("Reconnect to the environment and try again.");
        const response = await fetch(url);
        if (!response.ok) throw new Error("The file could not be loaded. Try again.");
        // A Blob keeps the download inside the desktop client instead of
        // navigating its custom app scheme to an external browser.
        const blobUrl = URL.createObjectURL(await response.blob());
        try {
          const anchor = document.createElement("a");
          anchor.href = blobUrl;
          anchor.download = name;
          anchor.click();
        } finally {
          setTimeout(() => URL.revokeObjectURL(blobUrl), 30_000);
        }
      } catch (cause) {
        toastManager.add({
          type: "error",
          title: "Could not download file",
          description: cause instanceof Error ? cause.message : "Please try again.",
        });
      } finally {
        setSaving(false);
      }
    })();
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-6 text-center text-xs leading-relaxed">
      <p className="text-muted-foreground">{name} can't be previewed.</p>
      <Button type="button" variant="outline" size="sm" disabled={saving} onClick={download}>
        <DownloadIcon className="size-3.5" />
        {saving ? "Preparing download…" : "Download"}
      </Button>
    </div>
  );
}
