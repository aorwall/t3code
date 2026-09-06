// Fork: upstream keeps this private and reaches it through the cache-key
// helpers below. The fork's browser-frame revision needs the bare hash, so the
// export stays. See apps/web/src/fork/browserPreviewRevision.ts.
export function fileContentRevision(contents: string): string {
  let hash = 2_166_136_261;
  for (let index = 0; index < contents.length; index += 1) {
    hash ^= contents.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return `${contents.length}:${(hash >>> 0).toString(36)}`;
}

export function projectFileCacheKey(cwd: string, relativePath: string, contents: string): string {
  return `${cwd}:${relativePath}:${fileContentRevision(contents)}`;
}

interface EditorFileIdentity {
  readonly cacheKey?: string;
  readonly contents: string;
}

export function projectFileEditorCacheKey(
  environmentId: string,
  cwd: string,
  relativePath: string,
  contents: string,
  editorFile: EditorFileIdentity | undefined,
): string {
  if (editorFile?.contents === contents && editorFile.cacheKey) {
    return editorFile.cacheKey;
  }
  return `editor:${environmentId}:${projectFileCacheKey(cwd, relativePath, contents)}`;
}
