import { createFileRoute } from "@tanstack/react-router";

import { IntegrationsPanel } from "../components/settings/moatless/IntegrationsPanel";

function SettingsIntegrationsRoute() {
  return <IntegrationsPanel />;
}

export const Route = createFileRoute("/settings/integrations")({
  component: SettingsIntegrationsRoute,
});
