/**
 * Which product surfaces the environment behind a thread can serve.
 *
 * Fork-only. A hosted backend implements part of the client contract, and a
 * surface it cannot serve has to be left out rather than offered — an
 * unimplemented method comes back as a defect, so a button that calls one shows
 * the person a server error instead of doing nothing. The server says what it
 * cannot do in its descriptor; this is where the client reads that.
 *
 * Every accessor here answers with a whole `EnvironmentFeatures`, never an
 * optional one, and every one of them reads subscribed state. Two absences
 * collapse into the same answer: a server that sends no `features` at all, and
 * an environment whose config has not arrived yet. Both mean *every feature
 * on*, in line with the contract's rule that absence points that way — so a
 * gated surface shows briefly before the config lands, which is why the read
 * has to be a subscription and not a snapshot.
 */
import {
  ALL_ENVIRONMENT_FEATURES,
  type EnvironmentFeatureName,
  type EnvironmentFeatures,
  type EnvironmentId,
  resolveEnvironmentFeatures,
  type ServerConfig,
} from "@t3tools/contracts";
import { useMemo } from "react";

import { useServerConfigs } from "./entities";

/**
 * What one already-held config declares. Callers that already hold configs —
 * because they read another capability from the same map — gate through this,
 * so a config arriving later re-renders them along with everything else it
 * feeds.
 */
export function serverConfigFeatures(config: ServerConfig | null | undefined): EnvironmentFeatures {
  return config
    ? resolveEnvironmentFeatures(config.environment.capabilities.features)
    : ALL_ENVIRONMENT_FEATURES;
}

/** What one environment declares, as a subscription. */
export function useEnvironmentFeatures(environmentId: EnvironmentId | null): EnvironmentFeatures {
  const configs = useServerConfigs();
  return useMemo(
    () =>
      environmentId === null
        ? ALL_ENVIRONMENT_FEATURES
        : serverConfigFeatures(configs.get(environmentId)),
    [configs, environmentId],
  );
}

/** Whether one environment can serve one surface, as a subscription. */
export function useEnvironmentFeature(
  environmentId: EnvironmentId | null,
  feature: EnvironmentFeatureName,
): boolean {
  return useEnvironmentFeatures(environmentId)[feature];
}
