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

  // Draft threads have no sandbox to control yet, so the sandbox status
  // buttons don't belong in their header.
  const isDraft = props.draftId !== undefined;

  return (
    <ChatHeader
      {...props}
      actionsPrefix={
        !isDraft && sandboxAvailability.ready ? (
          <SandboxStatusControl threadRef={threadRef} status={sandboxAvailability.status} />
        ) : undefined
      }
      actionsOverride={
        isDraft || sandboxAvailability.ready ? undefined : (
          <SandboxStatusControl threadRef={threadRef} status={sandboxAvailability.status} />
        )
      }
    />
  );
}
