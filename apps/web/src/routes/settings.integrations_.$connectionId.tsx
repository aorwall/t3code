import { createFileRoute } from "@tanstack/react-router";

import { ConnectionDetailPanel } from "../components/settings/moatless/ConnectionDetailPanel";

function SettingsConnectionDetailRoute() {
  const { connectionId } = Route.useParams();
  return <ConnectionDetailPanel connectionId={connectionId} />;
}

export const Route = createFileRoute("/settings/integrations_/$connectionId")({
  component: SettingsConnectionDetailRoute,
});
