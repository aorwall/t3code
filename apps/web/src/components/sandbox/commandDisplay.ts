/**
 * Fork-only: display helpers for the commands a thread's agent registered
 * through `moat cmd`.
 *
 * Elapsed is computed on the client from `startedAtUnixMs`, never sent by the
 * server — a server-side elapsed would change on every read and turn the status
 * push, which sends only what moved, into one that never falls quiet. Both the
 * pill badge and the composer banner read it from here so they agree.
 */
import type { CommandSummary } from "@t3tools/contracts";

/** The registered commands still running, the only ones either surface shows. */
export function runningCommands(
  commands: readonly CommandSummary[] | undefined,
): readonly CommandSummary[] {
  return (commands ?? []).filter((command) => command.state === "running");
}

/**
 * Whole-unit elapsed since `startedAtUnixMs`, coarsened to what a build-scale
 * wait wants: seconds under a minute, then minutes, then hours. A clock that is
 * behind the start (clock skew, a just-registered command) reads `0s` rather
 * than a negative age.
 */
export function formatElapsed(startedAtUnixMs: number, nowMs: number): string {
  const seconds = Math.max(0, Math.round((nowMs - startedAtUnixMs) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h${minutes % 60 > 0 ? ` ${minutes % 60}m` : ""}`;
}

/**
 * What a settled command's row says under its label.
 *
 * The sandbox panel lists finished commands as well as running ones — a build
 * that exited 1 while nobody was looking is the answer to "why is this thread
 * stuck" — so unlike the badge it has to render the terminal states too.
 */
export function commandStateLabel(command: CommandSummary): string {
  switch (command.state) {
    case "running":
      return "Running";
    case "exited":
      return command.exitCode === null || command.exitCode === 0
        ? "Finished"
        : `Failed with exit ${command.exitCode}`;
    case "timedOut":
      return "Killed at its deadline";
    case "killed":
      return "Killed";
  }
}

/** Whether the command ended in a way someone should look at. */
export function commandEndedBadly(command: CommandSummary): boolean {
  return command.state !== "running" && command.exitCode !== 0;
}
