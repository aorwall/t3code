import type { ScopedThreadRef } from "@t3tools/contracts";
import type { ComponentProps } from "react";

import { SandboxStatusControl } from "./SandboxStatusControl";
import { useSandboxAvailability } from "./sandbox/useSandboxAvailability";
import { RightPanelTabs } from "./RightPanelTabs";

type SandboxedRightPanelTabsProps = Omit<
  ComponentProps<typeof RightPanelTabs>,
  "sandboxControl" | "surfaceDisabled" | "surfaceDisabledReason"
> & {
  readonly threadRef: ScopedThreadRef;
};

export function SandboxedRightPanelTabs({ threadRef, ...props }: SandboxedRightPanelTabsProps) {
  const sandboxAvailability = useSandboxAvailability(threadRef);

  return (
    <RightPanelTabs
      {...props}
      surfaceDisabled={sandboxAvailability.surfaceDisabled}
      surfaceDisabledReason={sandboxAvailability.surfaceDisabledReason}
      sandboxControl={
        <SandboxStatusControl
          threadRef={threadRef}
          status={sandboxAvailability.status}
          // The control follows the panel body: the launcher wants the status
          // spelled out beside its surface cards, while the disabled state has
          // already said what is wrong above it and needs only the way out.
          compact={sandboxAvailability.surfaceDisabled}
        />
      }
    />
  );
}
