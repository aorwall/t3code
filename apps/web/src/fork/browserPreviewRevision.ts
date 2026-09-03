/**
 * Fork-only. The identity of the page inside the file preview's browser frame.
 *
 * A cross-origin frame cannot be told to reload, only replaced, which React
 * does when its key changes — and replacing it drops scroll position and any
 * state the page holds, and re-runs its scripts. Upstream keys the frame on the
 * workspace mutation id, so every completed command and every checkpoint
 * replaces the page whether or not it changed. Against Moatless an agent
 * produces those constantly, and reading an HTML report it wrote means watching
 * the page jump back to the top every few seconds.
 *
 * The read behind the "Show HTML source" toggle already runs for HTML, so the
 * page's own bytes are on hand and the frame can be keyed on them instead.
 * `byteLength` rides along because the read is cut at 1 MB and reports the
 * file's real size, so two versions that differ only past the cut are still
 * told apart by size.
 *
 * A null answer means the bytes cannot decide it and the caller should fall
 * back to the workspace mutation id: a PDF is never read, and a failed read has
 * nothing to hash.
 *
 * Known blind spot: a page that pulls a sibling stylesheet or script does not
 * change when the sibling does, and nothing here can see that. A file_change
 * activity does carry paths, but capped at 12 and in whatever form the tool
 * wrote them, and a command_execution carries none at all — so the activity
 * stream cannot answer it either. The answer would be a directory revision, and
 * nothing on the wire carries one: `ProjectEntry` is `{path, kind}`.
 */
import { fileContentRevision } from "~/components/files/fileContentRevision";

export function browserPreviewFrameRevision(
  file: { readonly contents: string; readonly byteLength: number } | null,
): string | null {
  return file === null ? null : `${file.byteLength}:${fileContentRevision(file.contents)}`;
}
