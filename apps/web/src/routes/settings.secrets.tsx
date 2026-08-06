import { createFileRoute } from "@tanstack/react-router";

import { NotInT3Yet } from "../components/settings/moatless/NotInT3Yet";

function SettingsSecretsRoute() {
  return <NotInT3Yet title="Secrets" sectionId="secrets" describe="deployment secrets" />;
}

export const Route = createFileRoute("/settings/secrets")({
  component: SettingsSecretsRoute,
});
