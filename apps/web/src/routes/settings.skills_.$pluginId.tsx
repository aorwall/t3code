import { createFileRoute } from "@tanstack/react-router";

import { PluginDetailPanel } from "../components/settings/moatless/PluginDetailPanel";

function SettingsPluginDetailRoute() {
  const { pluginId } = Route.useParams();
  return <PluginDetailPanel pluginId={pluginId} />;
}

export const Route = createFileRoute("/settings/skills_/$pluginId")({
  component: SettingsPluginDetailRoute,
});
