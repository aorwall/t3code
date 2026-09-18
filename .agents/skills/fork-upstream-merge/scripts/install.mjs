#!/usr/bin/env node
/**
 * `vp install`, with the heap node will not give itself.
 *
 *   node .agents/skills/fork-upstream-merge/scripts/install.mjs
 *
 * A merge installs before it can do anything else — a restart empties
 * `node_modules`, and `regen-route-tree.mjs`, `merge-stats.mjs` and every step
 * of `verify.mjs` need it back. On a capped sandbox that install is also the
 * first thing to run out of memory: pnpm's resolution pass over this workspace
 * exceeds node's default heap and dies with `Ineffective mark-compacts near
 * heap limit`, then exits 1 with nothing in the exit status or the last lines
 * of output that says the word memory. Two merges have paid for that diagnosis.
 *
 * `verify.mjs` has raised the heap for the test step since long before this;
 * the install that has to precede it did not, so this runs `vp install` under
 * the same derived ceiling (`heapMb` in `lib.mjs`, a share of the pod's cgroup
 * cap rather than a hardcoded number) and, when it fails, says which of the two
 * failures it was.
 *
 * Arguments pass through, so `install.mjs --frozen-lockfile` works.
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
