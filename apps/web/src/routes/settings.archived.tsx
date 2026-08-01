import { createFileRoute } from "@tanstack/react-router";

import { SettingsFeatureSection } from "../components/settings/SettingsFeatureSection";
import { ArchivedThreadsPanel } from "../components/settings/SettingsPanels";

export const Route = createFileRoute("/settings/archived")({
  component: () => (
    <SettingsFeatureSection feature="threadArchival">
      <ArchivedThreadsPanel />
    </SettingsFeatureSection>
  ),
});
