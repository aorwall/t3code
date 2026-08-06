import { createFileRoute } from "@tanstack/react-router";

import { UsersPanel } from "../components/settings/moatless/UsersPanel";

function SettingsUsersRoute() {
  return <UsersPanel />;
}

export const Route = createFileRoute("/settings/users")({
  component: SettingsUsersRoute,
});
