import { createFileRoute } from "@tanstack/react-router";

import { WorkspacesPanel } from "../components/settings/moatless/WorkspacesPanel";

function SettingsWorkspacesRoute() {
  return <WorkspacesPanel />;
}

export const Route = createFileRoute("/settings/workspaces")({
  component: SettingsWorkspacesRoute,
});
