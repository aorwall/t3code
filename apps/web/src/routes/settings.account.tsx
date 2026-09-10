/** Fork-only. The viewer's own Moatless agent credentials: Claude Code, Codex. */

import { createFileRoute } from "@tanstack/react-router";

import { AccountPanel } from "../components/settings/moatless/AccountPanel";

function SettingsAccountRoute() {
  return <AccountPanel />;
}

export const Route = createFileRoute("/settings/account")({
  component: SettingsAccountRoute,
});
