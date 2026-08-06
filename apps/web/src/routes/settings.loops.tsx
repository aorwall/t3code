import { createFileRoute } from "@tanstack/react-router";

import { NotInT3Yet } from "../components/settings/moatless/NotInT3Yet";

function SettingsLoopsRoute() {
  return (
    <NotInT3Yet
      title="Loops"
      sectionId="loops"
      describe="loops that start tasks on a schedule or an event"
    />
  );
}

export const Route = createFileRoute("/settings/loops")({
  component: SettingsLoopsRoute,
});
