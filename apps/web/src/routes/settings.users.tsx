import { createFileRoute } from "@tanstack/react-router";

import { NotInT3Yet } from "../components/settings/moatless/NotInT3Yet";

function SettingsUsersRoute() {
  return <NotInT3Yet title="Users" sectionId="users" describe="user accounts and roles" />;
}

export const Route = createFileRoute("/settings/users")({
  component: SettingsUsersRoute,
});
