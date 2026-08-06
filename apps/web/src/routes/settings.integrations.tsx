import { createFileRoute } from "@tanstack/react-router";

import { NotInT3Yet } from "../components/settings/moatless/NotInT3Yet";

function SettingsIntegrationsRoute() {
  return (
    <NotInT3Yet
      title="Integrations"
      sectionId="integrations-connections"
      describe="adapter connections, apps and GitHub installations"
    />
  );
}

export const Route = createFileRoute("/settings/integrations")({
  component: SettingsIntegrationsRoute,
});
