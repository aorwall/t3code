import { AzureDevOpsIcon, BitbucketIcon, GitHubIcon, GitIcon, GitLabIcon } from "../../Icons";
import type { RepositoryProviderIcon as ProviderIcon } from "./repositoryProvider";

const ICONS = {
  github: GitHubIcon,
  gitlab: GitLabIcon,
  bitbucket: BitbucketIcon,
  "azure-devops": AzureDevOpsIcon,
  git: GitIcon,
} as const satisfies Record<ProviderIcon, unknown>;

/**
 * The host's mark, from the app's own icon set rather than a set of its own.
 *
 * `aria-hidden` throughout: the repository's name is next to it in every use,
 * so announcing the host twice would be the only thing this added to a screen
 * reader.
 */
export function RepositoryProviderIcon({
  icon,
  className,
}: {
  readonly icon: ProviderIcon;
  readonly className?: string;
}) {
  const Icon = ICONS[icon];
  return <Icon className={className} aria-hidden />;
}
