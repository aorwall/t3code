import { createFileRoute } from "@tanstack/react-router";

import { UserDetailPanel } from "../components/settings/moatless/UserDetailPanel";

function SettingsUserDetailRoute() {
  const { login } = Route.useParams();
  return <UserDetailPanel login={login} />;
}

export const Route = createFileRoute("/settings/users_/$login")({
  component: SettingsUserDetailRoute,
});
