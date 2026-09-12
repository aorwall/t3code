import { useMemo } from "react";
import { AuthAccessWriteScope } from "@t3tools/contracts";

import { hasCloudPublicConfig } from "~/cloud/publicConfig";
import { isElectron } from "~/env";
import { desktopWslStateAtom } from "~/state/desktopWslState";
import { useEnvironments } from "~/state/environments";
import { useEnvironmentQuery } from "~/state/query";
import { usePrimarySessionState } from "~/environments/primary";
import { isWslSettingsRowVisible } from "./ConnectionsSettings.logic";
import { isProviderSettingsEnvironmentAvailable } from "./ProviderSettingsPanel.logic";
import { featureFlagsQuery } from "./moatless/queries";
import {
  filterAvailableSettingsSearchItems,
  getThreadAutoSettlementSearchAvailability,
} from "./settingsSearch";
import { useMoatlessQuery } from "~/moatless/query";

export function useAvailableSettingsSearchItems() {
  const { environments } = useEnvironments();
  const primarySessionState = usePrimarySessionState();
  const desktopWsl = useEnvironmentQuery(isElectron ? desktopWslStateAtom : null);
  // Fork: the Version control page lists Forgejo only where the Moatless
  // deployment runs Forgejo. Shared with the panel through one cache entry.
  const { data: moatlessFeatures } = useMoatlessQuery(featureFlagsQuery);
  const canManageLocalBackend =
    isElectron ||
    ((primarySessionState.data?.authenticated &&
      primarySessionState.data.scopes?.includes(AuthAccessWriteScope)) ??
      false);

  return useMemo(
    () =>
      filterAvailableSettingsSearchItems({
        hasCloudPublicConfig: hasCloudPublicConfig(),
        hasEnvironment: environments.some((environment) => environment.serverConfig !== null),
        hasProviderSettingsEnvironment: environments.some((environment) =>
          isProviderSettingsEnvironmentAvailable({
            connectionPhase: environment.connection.phase,
            hasServerConfig: environment.serverConfig !== null,
          }),
        ),
        canManageLocalBackend,
        isWslSettingsRowVisible: isWslSettingsRowVisible({
          state: desktopWsl.data,
          error: desktopWsl.error,
        }),
        hasThreadAutoSettlement:
          getThreadAutoSettlementSearchAvailability(environments).eligibleEnvironmentIds.length > 0,
        // Fork: see the Forgejo read above.
        forgejoEnabled: moatlessFeatures?.forgejo_enabled === true,
      }),
    [canManageLocalBackend, desktopWsl.data, desktopWsl.error, environments, moatlessFeatures],
  );
}
