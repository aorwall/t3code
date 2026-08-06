import { createFileRoute } from "@tanstack/react-router";

import { LoopsPanel } from "../components/settings/moatless/LoopsPanel";

function SettingsLoopsRoute() {
  return <LoopsPanel />;
}

export const Route = createFileRoute("/settings/loops")({
  component: SettingsLoopsRoute,
});
