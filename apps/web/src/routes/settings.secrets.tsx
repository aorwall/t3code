import { createFileRoute } from "@tanstack/react-router";

import { SecretsPanel } from "../components/settings/moatless/SecretsPanel";

function SettingsSecretsRoute() {
  return <SecretsPanel />;
}

export const Route = createFileRoute("/settings/secrets")({
  component: SettingsSecretsRoute,
});
