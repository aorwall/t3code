/**
 * A settings section that only exists where its environment can serve it.
 *
 * Fork-only. Filtering the nav hides a section from the one place it is
 * normally reached; this covers the others — a typed URL, a restored tab, a
 * link from before the server narrowed — by sending the person to a section
 * that does exist rather than rendering a page whose every control fails.
 *
 * A feature that has not loaded yet reads as supported (see
 * `state/environmentFeatures`), so this never bounces a page during connect.
 */
import type { EnvironmentFeatureName } from "@t3tools/contracts";
import { useNavigate } from "@tanstack/react-router";
import { type ReactNode, useEffect } from "react";

import { usePrimaryEnvironmentId } from "../../state/environments";
import { useEnvironmentFeature } from "../../state/environmentFeatures";

export function SettingsFeatureSection(props: {
  feature: EnvironmentFeatureName;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const supported = useEnvironmentFeature(usePrimaryEnvironmentId(), props.feature);

  useEffect(() => {
    if (supported) return;
    void navigate({ to: "/settings/general", replace: true });
  }, [navigate, supported]);

  return supported ? props.children : null;
}
