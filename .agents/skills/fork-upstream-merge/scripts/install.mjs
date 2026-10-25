#!/usr/bin/env node
/**
 * `vp install`, with the heap node will not give itself.
 *
 *   node .agents/skills/fork-upstream-merge/scripts/install.mjs [--frozen-lockfile]
 *
 * pnpm resolution exceeds node's default heap and dies with `Ineffective mark-compacts` and a
 * bare exit 1. Runs under the cgroup-derived `heapMb` ceiling and names which failure it was.
 */
import * as NodeChildProcess from "node:child_process";

import {
  OUT_OF_MEMORY,
  REPO_ROOT,
  bold,
  capNote,
  dim,
  green,
  heapEnv,
  heapMb,
  red,
  runMain,
  yellow,
} from "./lib.mjs";

const HEAP_MB = heapMb();

runMain(async () => {
  const args = ["install", ...process.argv.slice(2)];
  process.stdout.write(
    `${bold("vp")} ${args.join(" ")} ${dim(`--max-old-space-size=${HEAP_MB}${capNote()}`)}\n`,
  );

  // Streamed and collected: the caller still watches the install live, and the
  // failure path needs the text to tell an OOM from a resolution error.
  const output = await new Promise((resolve) => {
    const child = NodeChildProcess.spawn("vp", args, { cwd: REPO_ROOT, env: heapEnv(HEAP_MB) });
    let buffer = "";
    const onData = (chunk) => {
      buffer += chunk;
      process.stdout.write(chunk);
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.on("close", (status, signal) => resolve({ status, signal, text: buffer }));
  });

  if ((output.status ?? 1) === 0) {
    process.stdout.write(`${green("install ok")}\n`);
    return 0;
  }

  if (OUT_OF_MEMORY.test(output.text) || output.status === 137 || output.signal === "SIGKILL") {
    process.stdout.write(
      `\n${red("install ran out of memory")} — not a broken manifest or a bad lockfile.\n` +
        `Already retried at --max-old-space-size=${HEAP_MB}${capNote()}.\n` +
        `${dim("Raising it past the pod's cap trades an OOM-killed process for an evicted pod,")}\n` +
        `${dim("which loses the whole checkout. Check /sys/fs/cgroup/memory.max — `free` reports")}\n` +
        `${dim("the host, not this pod, and will not show you the number that matters.")}\n`,
    );
    return 1;
  }

  process.stdout.write(
    `\n${red(`install exited ${output.signal ?? output.status}`)} ` +
      `${yellow("with no out-of-memory marker in its output")} — read the log above.\n`,
  );
  return output.status ?? 1;
});
