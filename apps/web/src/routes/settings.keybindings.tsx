import { createFileRoute } from "@tanstack/react-router";

import { KeybindingsSettingsPanel } from "../components/settings/KeybindingsSettings";
import { SettingsFeatureSection } from "../components/settings/SettingsFeatureSection";

export const Route = createFileRoute("/settings/keybindings")({
  component: () => (
    <SettingsFeatureSection feature="serverAdministration">
      <KeybindingsSettingsPanel />
    </SettingsFeatureSection>
  ),
});
