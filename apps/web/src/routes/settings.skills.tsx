import { createFileRoute } from "@tanstack/react-router";

import { NotInT3Yet } from "../components/settings/moatless/NotInT3Yet";

function SettingsSkillsRoute() {
  return (
    <NotInT3Yet
      title="Skills"
      sectionId="skills"
      describe="the skills delivered to agents, and the plugins that source them"
    />
  );
}

export const Route = createFileRoute("/settings/skills")({
  component: SettingsSkillsRoute,
});
