/**
 * Fork-only. Recognises a link to a Moatless Artifact — the HTML page an agent
 * publishes with `moat artifact publish` — and looks up the title it was
 * published under.
 *
 * An Artifact is served from the backend's own origin, so only a URL on the
 * primary environment's origin counts: the same path on another host is some
 * other server's page and stays an ordinary link.
 */
import { resolvePrimaryEnvironmentHttpUrl } from "~/environments/primary/target";

export interface MoatlessArtifactLink {
  readonly artifactId: string;
  /** `null` for the URL that redirects to whichever version is latest. */
  readonly version: number | null;
}

const ARTIFACT_PATH = /^\/api\/v1\/artifacts\/([0-9a-f-]{36})(?:\/v([1-9]\d*))?\/?$/iu;

export function parseMoatlessArtifactHref(
  href: string,
  origin: string | null = primaryEnvironmentOrigin(),
): MoatlessArtifactLink | null {
  if (origin === null) return null;
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  if (url.origin !== origin) return null;
  const match = ARTIFACT_PATH.exec(url.pathname);
  if (!match?.[1]) return null;
  return {
    artifactId: match[1].toLowerCase(),
    version: match[2] === undefined ? null : Number(match[2]),
  };
}

function primaryEnvironmentOrigin(): string | null {
  try {
    return new URL(resolvePrimaryEnvironmentHttpUrl("/")).origin;
  } catch {
    return null;
  }
}

/** Artifact id → title, for every Artifact a Task has published. */
type ArtifactTitles = ReadonlyMap<string, string>;

const titlesByTask = new Map<string, Promise<ArtifactTitles>>();
/** `taskId/artifactId` pairs already refetched for, so a foreign id refetches once. */
const refetchedMisses = new Set<string>();

/**
 * The title of an Artifact the Task published, or `null` when the Task's list
 * does not name it — another Task's Artifact, or a request that failed.
 *
 * Lists are cached per Task, and a miss refetches once per id: an Artifact
 * published after the list was read is the usual reason an id is missing.
 */
export async function fetchMoatlessArtifactTitle(
  taskId: string,
  artifactId: string,
): Promise<string | null> {
  const cached = titlesByTask.get(taskId);
  const title = (await (cached ?? loadTitles(taskId))).get(artifactId);
  const missKey = `${taskId}/${artifactId}`;
  if (title !== undefined || cached === undefined || refetchedMisses.has(missKey)) {
    return title ?? null;
  }
  refetchedMisses.add(missKey);
  return (await loadTitles(taskId)).get(artifactId) ?? null;
}

function loadTitles(taskId: string): Promise<ArtifactTitles> {
  const titles: Promise<ArtifactTitles> = fetchTitles(taskId).catch(() => {
    // Forget a failed read so the next chip retries it.
    if (titlesByTask.get(taskId) === titles) titlesByTask.delete(taskId);
    return new Map<string, string>();
  });
  titlesByTask.set(taskId, titles);
  return titles;
}

async function fetchTitles(taskId: string): Promise<ArtifactTitles> {
  const response = await fetch(
    resolvePrimaryEnvironmentHttpUrl(`/api/v1/tasks/${encodeURIComponent(taskId)}/artifacts`),
    { credentials: "include", headers: { accept: "application/json" } },
  );
  if (!response.ok) throw new Error(`Artifact list request failed: ${response.status}`);
  return parseArtifactTitles(await response.json());
}

export function parseArtifactTitles(raw: unknown): ArtifactTitles {
  const titles = new Map<string, string>();
  const items = (raw as { items?: unknown } | null)?.items;
  if (!Array.isArray(items)) return titles;
  for (const item of items) {
    const { artifactId, title } = (item ?? {}) as { artifactId?: unknown; title?: unknown };
    if (typeof artifactId === "string" && typeof title === "string" && title.trim() !== "") {
      titles.set(artifactId.toLowerCase(), title);
    }
  }
  return titles;
}
