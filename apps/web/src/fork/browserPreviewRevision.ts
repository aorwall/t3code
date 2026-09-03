/**
 * Fork-only. The identity of the page in the file preview's browser frame.
 *
 * Keying it on the workspace mutation id, as upstream does, replaces the page
 * on every command and checkpoint — constant against Moatless. The HTML read
 * already runs for the source view, so key it on the bytes instead;
 * `byteLength` catches a change past the 1 MB read cut.
 *
 * Null means the bytes cannot answer it — a PDF is never read, a failed read
 * has nothing to hash — and the caller falls back to the mutation id.
 *
 * Blind spot: a page that pulls a sibling stylesheet or script does not reload
 * when the sibling does. Closing that needs a directory revision, and nothing
 * on the wire carries one.
 */
import { fileContentRevision } from "~/components/files/fileContentRevision";

export function browserPreviewFrameRevision(
  file: { readonly contents: string; readonly byteLength: number } | null,
): string | null {
  return file === null ? null : `${file.byteLength}:${fileContentRevision(file.contents)}`;
}
