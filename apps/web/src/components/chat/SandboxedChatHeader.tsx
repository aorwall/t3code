import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import { useMemo, type ComponentProps } from "react";

import { SandboxStatusControl } from "../SandboxStatusControl";
import { useSandboxAvailability } from "../sandbox/useSandboxAvailability";
import { ChatHeader } from "./ChatHeader";

type SandboxedChatHeaderProps = ComponentProps<typeof ChatHeader>;

export function SandboxedChatHeader(props: SandboxedChatHeaderProps) {
  const threadRef = useMemo(
    () => scopeThreadRef(props.activeThreadEnvironmentId, props.activeThreadId),
    [props.activeThreadEnvironmentId, props.activeThreadId],
  );
  const sandboxAvailability = useSandboxAvailability(threadRef);

  return (
    <ChatHeader
      {...props}
      actionsOverride={
        sandboxAvailability.ready ? undefined : (
          <SandboxStatusControl threadRef={threadRef} status={sandboxAvailability.status} />
        )
      }
    />
  );
}
