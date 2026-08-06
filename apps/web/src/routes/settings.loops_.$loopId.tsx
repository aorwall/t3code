import { createFileRoute } from "@tanstack/react-router";

import { LoopDetailPanel } from "../components/settings/moatless/LoopDetailPanel";

function SettingsLoopDetailRoute() {
  const { loopId } = Route.useParams();
  return <LoopDetailPanel loopId={loopId} />;
}

export const Route = createFileRoute("/settings/loops_/$loopId")({
  component: SettingsLoopDetailRoute,
});
