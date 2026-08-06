import { createFileRoute } from "@tanstack/react-router";

import { WorkspaceDetailPanel } from "../components/settings/moatless/WorkspaceDetailPanel";

function SettingsWorkspaceDetailRoute() {
  const { workspaceId } = Route.useParams();
  return <WorkspaceDetailPanel workspaceId={workspaceId} />;
}

export const Route = createFileRoute("/settings/workspaces/$workspaceId")({
  component: SettingsWorkspaceDetailRoute,
});
