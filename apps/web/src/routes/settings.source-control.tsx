import { createFileRoute } from "@tanstack/react-router";

import { SettingsFeatureSection } from "../components/settings/SettingsFeatureSection";
import { SourceControlSettingsPanel } from "../components/settings/SourceControlSettings";

export const Route = createFileRoute("/settings/source-control")({
  component: () => (
    <SettingsFeatureSection feature="projectManagement">
      <SourceControlSettingsPanel />
    </SettingsFeatureSection>
  ),
});
