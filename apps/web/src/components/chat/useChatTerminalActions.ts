import type {
  EnvironmentProject,
  EnvironmentThreadShell,
} from "@t3tools/client-runtime/state/shell";
import type { Dispatch } from "react";
import type { ComposerHandleRef } from "../../composerHandleContext";
import type { selectThreadTerminalUiState } from "../../terminalUiStateStore";
import { useStableCallback } from "../../hooks/useStableCallback";
import { useThreadTerminalActions } from "../terminal/useThreadTerminalActions";
import { getTerminalLabel } from "@t3tools/shared/terminalLabels";
import * as Schema from "effect/Schema";
import {
  AuthTerminalReadScope,
  AuthTerminalOperateScope,
  // Fork: the model a host-created thread is pinned to, and the lifecycle error.
  DEFAULT_MODEL,
  SandboxNotRunningError,
  type EnvironmentId,
  type ProjectScript,
  type ScopedThreadRef,
  type ThreadId,
} from "@t3tools/contracts";
import { projectScriptTerminalInput } from "@t3tools/shared/projectScripts";
// Fork: a draft's script run creates its host thread with the composer's model.
import { createModelSelection } from "@t3tools/shared/model";
import { type SetStateAction } from "react";
import {
  isAtomCommandInterrupted,
  squashAtomCommandFailure,
} from "@t3tools/client-runtime/state/runtime";
import { MAX_TERMINALS_PER_GROUP } from "../../types";
import { type RightPanelSurface, useRightPanelStore } from "../../rightPanelStore";
import { isPreviewSupportedInRuntime } from "../../previewStateStore";
import { openUrlInPreview } from "../../browser/openFileInPreview";
import { addBrowserSurface } from "../preview/addBrowserSurface";
import { resolveDiscoveredServerUrl } from "../../browser/browserTargetResolver";
import { stackedThreadToast, toastManager } from "../ui/toast";
import { confirmTerminalClose } from "../../lib/terminalCloseConfirm";
import { findReusableProjectScriptTerminal } from "../../lib/projectScriptTerminal";
import { type TerminalContextSelection } from "../../lib/terminalContext";
import { useTerminalUiStateStore } from "../../terminalUiStateStore";
import {
  LAST_INVOKED_SCRIPT_BY_PROJECT_KEY,
  LastInvokedScriptByProjectSchema,
  makeThreadErrorSetter,
} from "../ChatView.logic";
import { useLocalStorage } from "~/hooks/useLocalStorage";
import { previewEnvironment } from "../../state/preview";
import { sandboxEnvironment } from "../../state/sandbox";
import { scriptsEnvironment } from "../../state/scripts";
import { threadEnvironment } from "../../state/threads";
import { useOrchestrationCommand } from "../../state/use-orchestration-command";
import { readEnvironmentScope } from "../../state/session";
import { useAtomCommand } from "../../state/use-atom-command";
import type { ChatShortcutCommands } from "./useChatShortcuts";
const SCRIPT_TERMINAL_COLS = 120;
const SCRIPT_TERMINAL_ROWS = 30;
/**
 * Fork: how long to wait for a sandbox started on a script's behalf, and how
 * often to ask. A cold start is tens of seconds — the ceiling is only here so a
 * sandbox that never arrives ends as a sentence rather than a spinner.
 */
const SANDBOX_START_TIMEOUT_MS = 180_000;
const SANDBOX_START_POLL_MS = 2_000;
/**
 * Fork: the schema-aware check, because the value crossed the wire — an
 * `instanceof` would ask whether it came from this bundle's class rather than
 * whether it is the error the environment sent.
 */
const isSandboxNotRunning = Schema.is(SandboxNotRunningError);

export interface TerminalLaunchContext {
  threadId: ThreadId;
  cwd: string;
  worktreePath: string | null;
}

interface ChatTerminalActionsInput {
  readonly environmentId: EnvironmentId;
  readonly composerRef: ComposerHandleRef;
  readonly terminalUiState: ReturnType<typeof selectThreadTerminalUiState>;
  readonly activeThread: EnvironmentThreadShell | undefined;
  readonly activeThreadId: ThreadId | null;
  readonly activeThreadRef: ScopedThreadRef | null;
  readonly activeProject: EnvironmentProject | null;
  readonly activeRightPanelSurface: RightPanelSurface | null;
  readonly runningTerminalIds: ReadonlyArray<string>;
  readonly activeServerOrderedTerminalIds: ReadonlyArray<string>;
  readonly activeTerminalLabelsById: ReadonlyMap<string, string>;
  readonly panelTerminalIds: ReadonlySet<string>;
  readonly canReuseTerminal: boolean;
  readonly gitCwd: string | null;
  readonly setTerminalFocusRequestId: Dispatch<SetStateAction<number>>;
  readonly setTerminalUiLaunchContext: Dispatch<SetStateAction<TerminalLaunchContext | null>>;
  readonly setThreadError: ReturnType<typeof makeThreadErrorSetter>;
  // Fork: the host-run script path.
  readonly isLocalDraftThread: boolean;
  readonly supportsWorkspaceScripts: boolean;
}

/**
 * The thread's terminals: the drawer's and the right panel's, and project scripts and chat
 * code blocks, which run in a reused or new drawer terminal.
 */
export function useChatTerminalActions(input: ChatTerminalActionsInput) {
  const {
    environmentId,
    composerRef,
    terminalUiState,
    activeThread,
    activeThreadId,
    activeThreadRef,
    activeProject,
    activeRightPanelSurface,
    runningTerminalIds,
    activeServerOrderedTerminalIds,
    activeTerminalLabelsById,
    panelTerminalIds,
    canReuseTerminal,
    gitCwd,
    setTerminalFocusRequestId,
    setTerminalUiLaunchContext,
    setThreadError,
    isLocalDraftThread,
    supportsWorkspaceScripts,
  } = input;
  const openPreview = useAtomCommand(previewEnvironment.open, { reportFailure: false });
  const runScript = useAtomCommand(scriptsEnvironment.run, { reportFailure: false });
  // Fork: the two reads `startSandboxForScript` needs.
  const startSandbox = useAtomCommand(sandboxEnvironment.start, { reportFailure: false });
  const readSandboxStatus = useAtomCommand(sandboxEnvironment.statusOnce, { reportFailure: false });
  const createThread = useOrchestrationCommand(threadEnvironment.create, { reportFailure: false });

  const hasTerminalWriteAccess = () =>
    readEnvironmentScope(environmentId, AuthTerminalOperateScope);
  const [lastInvokedScriptByProjectId, setLastInvokedScriptByProjectId] = useLocalStorage(
    LAST_INVOKED_SCRIPT_BY_PROJECT_KEY,
    {},
    LastInvokedScriptByProjectSchema,
  );
  const storeSetTerminalOpen = useTerminalUiStateStore((s) => s.setTerminalOpen);
  const storeEnsureTerminal = useTerminalUiStateStore((state) => state.ensureTerminal);
  const storeSplitTerminal = useTerminalUiStateStore((s) => s.splitTerminal);
  const storeSplitTerminalVertical = useTerminalUiStateStore((s) => s.splitTerminalVertical);
  const storeNewTerminal = useTerminalUiStateStore((s) => s.newTerminal);
  // Fork: the hosted script path activates the terminal the environment opened.
  const storeSetActiveTerminal = useTerminalUiStateStore((s) => s.setActiveTerminal);
  const storeCloseTerminal = useTerminalUiStateStore((s) => s.closeTerminal);
  const terminalActions = useThreadTerminalActions(activeThreadRef);

  const activeTerminalGroup =
    terminalUiState.terminalGroups.find(
      (group) => group.id === terminalUiState.activeTerminalGroupId,
    ) ??
    terminalUiState.terminalGroups.find((group) =>
      group.terminalIds.includes(terminalUiState.activeTerminalId),
    ) ??
    null;
  const hasReachedSplitLimit =
    (activeTerminalGroup?.terminalIds.length ?? 0) >= MAX_TERMINALS_PER_GROUP;
  /*__HOOK__*/
  const addTerminalContextToDraft = (selection: TerminalContextSelection) => {
    composerRef.current?.addTerminalContext(selection);
  };
  const addTerminalContextToDraftStable = useStableCallback(addTerminalContextToDraft);
  const setTerminalOpen = (open: boolean) => {
    if (!activeThreadRef) return;
    storeSetTerminalOpen(activeThreadRef, open);
  };
  const setTerminalOpenStable = useStableCallback(setTerminalOpen);
  const toggleTerminalVisibility = () => {
    if (!activeThreadRef) return;
    const nextOpen = !terminalUiState.terminalOpen;
    if (
      nextOpen &&
      !readEnvironmentScope(environmentId, AuthTerminalReadScope) &&
      !hasTerminalWriteAccess()
    )
      return;
    if (nextOpen && hasTerminalWriteAccess() && terminalUiState.terminalIds.length === 0) {
      // Server-created setup terminals exist before this client's drawer mounts.
      // Reuse them before allocating a shell from the still-empty UI state.
      const existingTerminalId =
        runningTerminalIds.find((id) => !panelTerminalIds.has(id)) ??
        activeServerOrderedTerminalIds.find((id) => !panelTerminalIds.has(id));
      if (existingTerminalId !== undefined) {
        storeEnsureTerminal(activeThreadRef, existingTerminalId, { open: true, active: true });
        return;
      }
      void terminalActions.launchTerminal({
        place: (terminalId) => storeEnsureTerminal(activeThreadRef, terminalId, { open: true }),
      })?.result;
      return;
    }
    setTerminalOpen(nextOpen);
  };
  const toggleTerminalVisibilityStable = useStableCallback(toggleTerminalVisibility);
  const splitTerminal = (direction: "horizontal" | "vertical" = "horizontal") => {
    if (!activeThreadRef || hasReachedSplitLimit) return;
    const launched = terminalActions.launchTerminal({
      place: (terminalId) =>
        direction === "vertical"
          ? storeSplitTerminalVertical(activeThreadRef, terminalId)
          : storeSplitTerminal(activeThreadRef, terminalId),
    });
    if (!launched) return;
    setTerminalFocusRequestId((value) => value + 1);
    void launched.result;
  };
  const splitTerminalStable = useStableCallback(splitTerminal);
  const createNewTerminal = () => {
    if (!activeThreadRef) return;
    const launched = terminalActions.launchTerminal({
      place: (terminalId) => storeNewTerminal(activeThreadRef, terminalId),
    });
    if (!launched) return;
    setTerminalFocusRequestId((value) => value + 1);
    void launched.result;
  };
  const createNewTerminalStable = useStableCallback(createNewTerminal);
  const closeTerminal = (terminalId: string) => {
    if (!hasTerminalWriteAccess() || !activeThreadRef) return;
    terminalActions.closeTerminalSession(terminalId);
    storeCloseTerminal(activeThreadRef, terminalId);
    setTerminalFocusRequestId((value) => value + 1);
  };
  /**
   * Fork: bring the thread's sandbox up so a script can run, resolving once it is ready to be asked
   * again. `sandbox.start` only records intent and readiness arrives later, hence the poll.
   * Returns false when it did not get there; the caller has already been told why and should stop.
   */
  const awaitSandboxReady = async (threadId: ThreadId): Promise<boolean> => {
    const startResult = await startSandbox({
      environmentId,
      input: { threadId },
    });
    if (startResult._tag === "Failure") {
      if (isAtomCommandInterrupted(startResult)) return false;
      const error = squashAtomCommandFailure(startResult);
      setThreadError(
        threadId,
        error instanceof Error ? error.message : "Could not start the sandbox.",
      );
      return false;
    }

    const deadline = Date.now() + SANDBOX_START_TIMEOUT_MS;
    for (;;) {
      const statusResult = await readSandboxStatus({
        environmentId,
        input: { threadId },
      });
      if (statusResult._tag === "Failure") {
        if (isAtomCommandInterrupted(statusResult)) return false;
        const error = squashAtomCommandFailure(statusResult);
        setThreadError(
          threadId,
          error instanceof Error ? error.message : "Could not read the sandbox status.",
        );
        return false;
      }
      const status = statusResult.value.sandboxStatus;
      if (status === "ready") return true;
      // Only `initializing` is still on its way. Anything else has settled
      // somewhere that no amount of waiting improves.
      if (status !== "initializing") {
        setThreadError(threadId, `The sandbox stopped starting (${status}).`);
        return false;
      }
      if (Date.now() >= deadline) {
        setThreadError(
          threadId,
          "The sandbox is taking longer than expected to start. Try the script again in a moment.",
        );
        return false;
      }
      await new Promise((resolve) => setTimeout(resolve, SANDBOX_START_POLL_MS));
    }
  };

  // `.finally()` on the promise rather than a `finally` clause: React Compiler
  // skips any component holding a `try/finally`.
  const startSandboxForScript = (threadId: ThreadId): Promise<boolean> => {
    const toastId = toastManager.add({
      type: "info",
      title: "Starting sandbox…",
      description: "The script will run once it is up.",
    });
    return awaitSandboxReady(threadId).finally(() => toastManager.close(toastId));
  };

  const runProjectScript = async (
    script: ProjectScript,
    options?: {
      cwd?: string;
      env?: Record<string, string>;
      worktreePath?: string | null;
      preferNewTerminal?: boolean;
      rememberAsLastInvoked?: boolean;
      shellHistory?: "preserve" | "suppress";
    },
  ) => {
    if (!hasTerminalWriteAccess() || !activeThreadId || !activeProject || !activeThread) return;
    // Fork: a draft has no host thread for the script to run in. Create it
    // under the draft's own id and ask for the environment, because a thread
    // created with no first message gets one only when a turn is sent, and no
    // turn is coming. The draft route navigates to the thread on its own.
    if (isLocalDraftThread) {
      // Fork: a draft carries the project's default selection or the no-provider placeholder, not the
      // composer's pick. Resolve it as the send path does: the host fixes a thread's agent at creation
      // and refuses a later switch, and the placeholder's empty model is rejected outright.
      const sendCtx = composerRef.current?.getSendContext();
      const scriptModelSelection = sendCtx?.providerAvailable
        ? createModelSelection(
            sendCtx.selectedModelSelection.instanceId,
            sendCtx.selectedModel || activeProject.defaultModelSelection?.model || DEFAULT_MODEL,
            sendCtx.selectedModelSelection.options,
          )
        : activeProject.defaultModelSelection;
      if (!scriptModelSelection?.model) {
        setThreadError(
          activeThreadId,
          `Pick a model before running "${script.name}". The thread it runs in needs one.`,
        );
        return;
      }
      const createResult = await createThread({
        environmentId,
        input: {
          threadId: activeThreadId,
          projectId: activeProject.id,
          title: script.name,
          modelSelection: scriptModelSelection,
          runtimeMode: activeThread.runtimeMode,
          interactionMode: activeThread.interactionMode,
          branch: activeThread.branch,
          worktreePath: activeThread.worktreePath,
          createdAt: activeThread.createdAt,
          provision: true,
        },
      });
      if (createResult._tag === "Failure") {
        if (!isAtomCommandInterrupted(createResult)) {
          const error = squashAtomCommandFailure(createResult);
          setThreadError(
            activeThreadId,
            error instanceof Error
              ? error.message
              : `Failed to create a thread to run "${script.name}" in.`,
          );
        }
        return;
      }
    }
    if (options?.rememberAsLastInvoked !== false) {
      setLastInvokedScriptByProjectId((current) => {
        if (current[activeProject.id] === script.id) return current;
        return { ...current, [activeProject.id]: script.id };
      });
    }
    const targetCwd = options?.cwd ?? gitCwd ?? activeProject.workspaceRoot;
    const reusableTerminalId =
      options?.preferNewTerminal ||
      !canReuseTerminal ||
      !readEnvironmentScope(environmentId, AuthTerminalReadScope)
        ? null
        : findReusableProjectScriptTerminal({
            // Server sessions cover drawer terminals this client has not opened yet, such as a
            // worktree setup shell; the helper drops the panel-owned ones.
            drawerTerminalIds: [
              ...new Set([...terminalUiState.terminalIds, ...activeServerOrderedTerminalIds]),
            ],
            activeTerminalId: terminalUiState.activeTerminalId,
            panelTerminalIds,
            runningTerminalIds,
          });
    const targetWorktreePath = options?.worktreePath ?? activeThread.worktreePath ?? null;

    setTerminalUiLaunchContext({
      threadId: activeThreadId,
      cwd: targetCwd,
      worktreePath: targetWorktreePath,
    });
    if (!activeThreadRef) {
      return;
    }
    // Host-driven path: the hosted environment already opened the PTY, hosts it in a named terminal and
    // publishes the port. Only register the returned terminal and open the preview; never open one here.
    if (supportsWorkspaceScripts) {
      const runInput = { threadId: activeThreadId, scriptId: script.id };
      let runResult = await runScript({ environmentId, input: runInput });

      // Fork: the environment declares this one because it is answerable: the
      // sandbox is stopped — idle-reaped, most often, just by leaving the
      // thread alone — and starting it is the whole of what stands between
      // the person and the script they asked for. Start it, then ask again.
      if (
        runResult._tag === "Failure" &&
        isSandboxNotRunning(squashAtomCommandFailure(runResult))
      ) {
        if (!(await startSandboxForScript(activeThreadId))) {
          return;
        }
        runResult = await runScript({ environmentId, input: runInput });
      }

      if (runResult._tag === "Failure") {
        if (!isAtomCommandInterrupted(runResult)) {
          const error = squashAtomCommandFailure(runResult);
          setThreadError(
            activeThreadId,
            error instanceof Error ? error.message : `Failed to run script "${script.name}".`,
          );
        }
        return;
      }
      const { terminalId, url, previewTabId } = runResult.value;
      // Register the environment's terminal *before* opening the panel. Opening first finds no terminal
      // and synthesizes `term-1`, so the panel attaches to a session the environment never opened
      // (TerminalSessionLookupError while the real script terminal is still starting).
      storeNewTerminal(activeThreadRef, terminalId);
      storeSetActiveTerminal(activeThreadRef, terminalId);
      setTerminalOpen(true);
      setTerminalFocusRequestId((value) => value + 1);
      // Fork: an environment that opened the tab itself has already given the
      // thread one, and opening a second here would leave a duplicate behind
      // on every run. Only the panel is this client's to open. An environment
      // that did not (an older Moatless) still needs the tab made for it.
      if (previewTabId) {
        useRightPanelStore.getState().openBrowser(activeThreadRef, previewTabId);
      } else if (url) {
        void addBrowserSurface({ threadRef: activeThreadRef, openPreview, url });
      }
      return;
    }

    setTerminalFocusRequestId((value) => value + 1);

    const launched = terminalActions.launchTerminal({
      // The drawer opens with the target already placed: opening it empty would claim
      // DEFAULT_THREAD_TERMINAL_ID, which a right-panel terminal may already own.
      place: (terminalId) =>
        reusableTerminalId === null
          ? storeNewTerminal(activeThreadRef, terminalId)
          : storeEnsureTerminal(activeThreadRef, terminalId, { open: true }),
      ...(reusableTerminalId === null
        ? { size: { cols: SCRIPT_TERMINAL_COLS, rows: SCRIPT_TERMINAL_ROWS } }
        : { terminalId: reusableTerminalId }),
      location: { cwd: targetCwd, worktreePath: targetWorktreePath },
      ...(options?.env ? { extraEnv: options.env } : {}),
    });
    if (!launched) return;
    const targetTerminalId = launched.terminalId;
    const openResult = await launched.result;
    if (openResult._tag === "Failure") {
      if (!isAtomCommandInterrupted(openResult)) {
        const error = squashAtomCommandFailure(openResult);
        setThreadError(
          activeThreadId,
          error instanceof Error ? error.message : `Failed to run script "${script.name}".`,
        );
      }
      return;
    }

    const writeResult = await terminalActions.writeToTerminal(
      targetTerminalId,
      options?.shellHistory === "preserve"
        ? `${script.command}\r`
        : projectScriptTerminalInput(script.command),
    );
    if (!writeResult) return;
    if (writeResult._tag === "Failure") {
      if (!isAtomCommandInterrupted(writeResult)) {
        const error = squashAtomCommandFailure(writeResult);
        setThreadError(
          activeThreadId,
          error instanceof Error ? error.message : `Failed to run script "${script.name}".`,
        );
      }
      return;
    }
    if (script.autoOpenPreview && script.previewUrl && isPreviewSupportedInRuntime()) {
      const previewResult = await openUrlInPreview({
        threadRef: activeThreadRef,
        url: resolveDiscoveredServerUrl(activeThreadRef.environmentId, script.previewUrl),
        openPreview,
      });
      if (previewResult._tag === "Failure" && !isAtomCommandInterrupted(previewResult)) {
        const error = squashAtomCommandFailure(previewResult);
        toastManager.add(
          stackedThreadToast({
            type: "error",
            title: "Could not open preview",
            description: error instanceof Error ? error.message : "An unexpected error occurred.",
          }),
        );
      }
    }
  };
  const runProjectScriptStable = useStableCallback(runProjectScript);

  const runShellCommand = (command: string) => {
    void runProjectScript(
      {
        id: "chat-code-block",
        name: "Chat code block",
        command,
        icon: "play",
        runOnWorktreeCreate: false,
      },
      { rememberAsLastInvoked: false, shellHistory: "preserve" },
    );
  };
  const runShellCommandStable = useStableCallback(runShellCommand);
  const addTerminalSurface = () => {
    if (!activeThreadRef) return;
    const launched = terminalActions.launchTerminal({
      place: (terminalId) =>
        useRightPanelStore.getState().openTerminal(activeThreadRef, terminalId),
    });
    if (!launched) return;
    setTerminalFocusRequestId((value) => value + 1);
    void launched.result;
  };
  const addTerminalSurfaceStable = useStableCallback(addTerminalSurface);
  const splitPanelTerminal = (direction: "horizontal" | "vertical" = "horizontal") => {
    if (
      !activeThreadRef ||
      activeRightPanelSurface?.kind !== "terminal" ||
      activeRightPanelSurface.terminalIds.length >= MAX_TERMINALS_PER_GROUP
    ) {
      return;
    }
    const surfaceId = activeRightPanelSurface.id;
    const launched = terminalActions.launchTerminal({
      place: (terminalId) =>
        useRightPanelStore
          .getState()
          .splitTerminal(activeThreadRef, surfaceId, terminalId, direction),
    });
    if (!launched) return;
    setTerminalFocusRequestId((value) => value + 1);
    void launched.result;
  };
  const splitPanelTerminalStable = useStableCallback(splitPanelTerminal);
  const splitPanelTerminalVertical = () => {
    splitPanelTerminal("vertical");
  };
  const splitPanelTerminalVerticalStable = useStableCallback(splitPanelTerminalVertical);
  const activatePanelTerminal = (terminalId: string) => {
    if (!activeThreadRef || activeRightPanelSurface?.kind !== "terminal") return;
    useRightPanelStore
      .getState()
      .activateTerminal(activeThreadRef, activeRightPanelSurface.id, terminalId);
    setTerminalFocusRequestId((value) => value + 1);
  };
  const activatePanelTerminalStable = useStableCallback(activatePanelTerminal);
  const closePanelTerminal = (terminalId: string) => {
    if (
      !hasTerminalWriteAccess() ||
      !activeThreadRef ||
      activeRightPanelSurface?.kind !== "terminal"
    )
      return;
    terminalActions.closeTerminalSession(terminalId);
    storeCloseTerminal(activeThreadRef, terminalId);
    useRightPanelStore
      .getState()
      .closeTerminal(activeThreadRef, activeRightPanelSurface.id, terminalId);
    setTerminalFocusRequestId((value) => value + 1);
  };
  const closePanelTerminalStable = useStableCallback(closePanelTerminal);
  const requestCloseTerminal = (terminalId: string) => {
    if (!hasTerminalWriteAccess()) return;
    const label = activeTerminalLabelsById.get(terminalId) ?? getTerminalLabel(terminalId);
    void confirmTerminalClose([label]).then((confirmed) => {
      if (confirmed && readEnvironmentScope(environmentId, AuthTerminalOperateScope)) {
        closeTerminal(terminalId);
      }
    });
  };
  const requestCloseTerminalStable = useStableCallback(requestCloseTerminal);
  const requestClosePanelTerminal = (terminalId: string) => {
    if (!hasTerminalWriteAccess()) return;
    const label = activeTerminalLabelsById.get(terminalId) ?? getTerminalLabel(terminalId);
    void confirmTerminalClose([label]).then((confirmed) => {
      if (confirmed && readEnvironmentScope(environmentId, AuthTerminalOperateScope)) {
        closePanelTerminal(terminalId);
      }
    });
  };
  const requestClosePanelTerminalStable = useStableCallback(requestClosePanelTerminal);
  const openTerminalIfClosed = () => {
    if (!terminalUiState.terminalOpen) setTerminalOpen(true);
  };
  // A focused right-panel terminal takes the split/new/close chords; otherwise they act on the drawer.
  const shortcuts = {
    "terminal.toggle": () => {
      if (
        !terminalUiState.terminalOpen &&
        !readEnvironmentScope(environmentId, AuthTerminalReadScope) &&
        !hasTerminalWriteAccess()
      )
        return false;
      toggleTerminalVisibility();
    },
    "terminal.split": ({ terminalFocusOwner }) => {
      if (!hasTerminalWriteAccess()) return false;
      if (terminalFocusOwner === "right-panel") return void splitPanelTerminal();
      openTerminalIfClosed();
      splitTerminal();
    },
    "terminal.splitVertical": ({ terminalFocusOwner }) => {
      if (!hasTerminalWriteAccess()) return false;
      if (terminalFocusOwner === "right-panel") return void splitPanelTerminal("vertical");
      openTerminalIfClosed();
      splitTerminal("vertical");
    },
    "terminal.close": ({ terminalFocusOwner }) => {
      if (!hasTerminalWriteAccess()) return false;
      if (terminalFocusOwner === "right-panel" && activeRightPanelSurface?.kind === "terminal") {
        requestClosePanelTerminal(activeRightPanelSurface.activeTerminalId);
        return;
      }
      if (terminalUiState.terminalOpen) requestCloseTerminal(terminalUiState.activeTerminalId);
    },
    "terminal.new": ({ terminalFocusOwner }) => {
      if (!hasTerminalWriteAccess()) return false;
      if (terminalFocusOwner === "right-panel") return void addTerminalSurface();
      openTerminalIfClosed();
      createNewTerminal();
    },
  } satisfies ChatShortcutCommands;
  return {
    shortcuts,
    activatePanelTerminalStable,
    addTerminalContextToDraftStable,
    addTerminalSurfaceStable,
    closePanelTerminalStable,
    createNewTerminalStable,
    lastInvokedScriptByProjectId,
    requestClosePanelTerminalStable,
    requestCloseTerminalStable,
    runProjectScriptStable,
    runShellCommandStable,
    setTerminalOpenStable,
    splitPanelTerminalStable,
    splitPanelTerminalVerticalStable,
    splitTerminalStable,
    toggleTerminalVisibilityStable,
  };
}
