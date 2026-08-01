import { createFileRoute } from "@tanstack/react-router";

import { DiagnosticsSettingsPanel } from "../components/settings/DiagnosticsSettings";
import { SettingsFeatureSection } from "../components/settings/SettingsFeatureSection";

export const Route = createFileRoute("/settings/diagnostics")({
  component: () => (
    <SettingsFeatureSection feature="diagnostics">
      <DiagnosticsSettingsPanel />
    </SettingsFeatureSection>
  ),
});
