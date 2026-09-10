/** Fork-only. The git hosts the viewer's own tasks clone and push with. */

import { createFileRoute, useNavigate } from "@tanstack/react-router";

import {
  VersionControlPanel,
  type VersionControlEntryId,
} from "../components/settings/moatless/VersionControlPanel";

function SettingsVersionControlRoute() {
  const { entry } = Route.useSearch();
  const navigate = useNavigate();

  return (
    <VersionControlPanel
      entry={entry ?? null}
      // In the URL rather than in state: a Forgejo OAuth connect leaves the app
      // and comes back to this page, and a local selection would not survive it.
      onSelectEntry={(id: VersionControlEntryId) => {
        void navigate({
          to: "/settings/version-control",
          search: id === "forgejo" ? { entry: "forgejo" as const } : {},
          replace: true,
          resetScroll: false,
        });
      }}
    />
  );
}

export const Route = createFileRoute("/settings/version-control")({
  validateSearch: (raw: Record<string, unknown>): { entry?: "forgejo" } =>
    raw.entry === "forgejo" ? { entry: "forgejo" } : {},
  component: SettingsVersionControlRoute,
});
