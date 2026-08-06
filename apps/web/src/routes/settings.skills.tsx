import { createFileRoute } from "@tanstack/react-router";

import { SkillsPanel } from "../components/settings/moatless/SkillsPanel";

export const Route = createFileRoute("/settings/skills")({
  component: SkillsPanel,
});
