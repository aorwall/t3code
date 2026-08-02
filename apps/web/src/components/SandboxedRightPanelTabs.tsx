import type { ScopedThreadRef } from "@t3tools/contracts";
import type { ComponentProps } from "react";

import { useSandboxAvailability } from "./sandbox/useSandboxAvailability";
import { RightPanelTabs } from "./RightPanelTabs";

type SandboxedRightPanelTabsProps = ComponentProps<typeof RightPanelTabs> & {
  readonly threadRef: ScopedThreadRef;
};

export function SandboxedRightPanelTabs({ threadRef, ...props }: SandboxedRightPanelTabsProps) {
  const sandboxAvailability = useSandboxAvailability(threadRef);

  return (
    <RightPanelTabs
      {...props}
      surfaceDisabled={sandboxAvailability.surfaceDisabled}
      surfaceDisabledReason={sandboxAvailability.surfaceDisabledReason}
    />
  );
}
