import type { RepositoryResponse } from "@t3tools/moatless-api/generated/model";

/**
 * Which git host a repository is on, as far as a row needs to know.
 *
 * A name and a URL both answer "which repository is this" slowly — they have to
 * be read. The host is the part a person recognises without reading, so it is
 * what the row leads with, and this works it out away from the component so the
 * cases below can be tested.
 */
export type RepositoryProviderIcon = "github" | "gitlab" | "bitbucket" | "azure-devops" | "git";

/**
 * The declared provider, else the remote's host, else plain git.
 *
 * Both halves are needed. `RepositoryResponse.provider` is nullable and is only
 * stamped where the backend knows the host, so a repository registered by
 * pasting a remote can arrive with `provider: null` and a `remoteUrl` that says
 * `github.com` plainly. Reading the URL when the field is empty is what stops
 * the common case from falling back to the generic mark.
 *
 * The declared value still wins where there is one: it is what the backend
 * authenticates against, and a self-hosted GitLab whose URL says neither
 * `gitlab` nor anything else recognisable is exactly the case the field exists
 * for.
 */
export function repositoryProviderIcon(
  repository: Pick<RepositoryResponse, "provider" | "remoteUrl">,
): RepositoryProviderIcon {
  switch (repository.provider) {
    case "github":
      return "github";
    case "gitlab":
      return "gitlab";
    // Gitness has no mark of its own here, and a wrong host's logo is worse
    // than none: it says something false rather than nothing.
    case "gitness":
      return "git";
  }

  return iconForHost(repository.remoteUrl ?? "");
}

function iconForHost(remoteUrl: string): RepositoryProviderIcon {
  const host = hostOf(remoteUrl);
  if (host === null) return "git";

  // Matched on a label boundary, not anywhere in the string: `github.com`,
  // `github.acme.dev` and `git.acme.dev/github` are three different things, and
  // only the first two are GitHub.
  if (hasLabel(host, "github")) return "github";
  if (hasLabel(host, "gitlab")) return "gitlab";
  if (hasLabel(host, "bitbucket")) return "bitbucket";
  if (hasLabel(host, "dev.azure.com") || hasLabel(host, "visualstudio.com")) return "azure-devops";
  return "git";
}

/**
 * The host of a remote, in either shape git accepts.
 *
 * `git@github.com:acme/api.git` is not a URL, so `new URL` cannot be the only
 * path; SSH remotes are what half of these repositories are registered with.
 */
function hostOf(remoteUrl: string): string | null {
  const trimmed = remoteUrl.trim();
  if (trimmed.length === 0) return null;

  const scp = /^[^/@]+@([^:/]+):/.exec(trimmed);
  if (scp?.[1]) return scp[1].toLocaleLowerCase();

  const scheme = /^[a-z][a-z0-9+.-]*:\/\/(?:[^/@]*@)?([^/:]+)/i.exec(trimmed);
  if (scheme?.[1]) return scheme[1].toLocaleLowerCase();

  return null;
}

/** Whether `host` contains `needle` as whole dot-separated labels. */
function hasLabel(host: string, needle: string): boolean {
  return host === needle || host.startsWith(`${needle}.`) || host.endsWith(`.${needle}`)
    ? true
    : host.includes(`.${needle}.`);
}
