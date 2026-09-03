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
