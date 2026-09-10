import type { ScopedThreadRef } from "@t3tools/contracts";
import type { ComponentProps } from "react";

import { useEnvironmentHttpBaseUrl } from "~/state/environments";

import { SandboxStatusControl } from "./SandboxStatusControl";
import { useSandboxAvailability } from "./sandbox/useSandboxAvailability";
import { RightPanelTabs } from "./RightPanelTabs";

type SandboxedRightPanelTabsProps = Omit<
  ComponentProps<typeof RightPanelTabs>,
  "sandboxControl" | "surfaceDisabled" | "surfaceDisabledReason" | "environmentHttpBaseUrl"
> & {
  readonly threadRef: ScopedThreadRef;
};

export function SandboxedRightPanelTabs({ threadRef, ...props }: SandboxedRightPanelTabsProps) {
  const sandboxAvailability = useSandboxAvailability(threadRef);
  const environmentHttpBaseUrl = useEnvironmentHttpBaseUrl(threadRef.environmentId);

  return (
    <RightPanelTabs
      {...props}
      surfaceDisabled={sandboxAvailability.surfaceDisabled}
      surfaceDisabledReason={sandboxAvailability.surfaceDisabledReason}
      environmentHttpBaseUrl={environmentHttpBaseUrl}
      sandboxControl={
        // Compact: both hosts are the entry that opens the sandbox surface, and
        // that entry already carries the word "Sandbox". Only the state is new.
        <SandboxStatusControl status={sandboxAvailability.status} compact />
      }
    />
  );
}
