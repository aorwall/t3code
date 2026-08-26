import { createFileRoute } from "@tanstack/react-router";

import { IntegrationsSettingsPanel } from "../components/settings/IntegrationsSettings";

function SettingsBrowserRoute() {
  return <IntegrationsSettingsPanel />;
}

export const Route = createFileRoute("/settings/browser")({
  component: SettingsBrowserRoute,
});
