/**
 * Fork-only. Identity of the page in the file preview's browser frame, keyed on the HTML
 * bytes: upstream's workspace mutation id replaces the page on every command here.
 * Null (PDF never read, failed read) means fall back to the mutation id.
 * Blind spot: a changed sibling stylesheet or script does not reload the page.
 */
import { fileContentRevision } from "~/components/files/fileContentRevision";

export function browserPreviewFrameRevision(
  file: { readonly contents: string; readonly byteLength: number } | null,
): string | null {
  return file === null ? null : `${file.byteLength}:${fileContentRevision(file.contents)}`;
}
