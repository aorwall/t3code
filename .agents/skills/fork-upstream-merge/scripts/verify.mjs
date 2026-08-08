#!/usr/bin/env node
/**
 * The whole verification pass, as one command.
 *
 *   node .agents/skills/fork-upstream-merge/scripts/verify.mjs
 *   node .agents/skills/fork-upstream-merge/scripts/verify.mjs --only typecheck,test
 *
 * Two things this does that `a && b && c && d` does not.
 *
 * It keeps going after a failure. Chained with `&&`, a formatting nit hides the
 * type errors behind it, so the merge learns about its problems one slow
 * round-trip at a time — and `pnpm test` is the slow one. Running everything and
 * reporting at the end turns four sequential discoveries into one.
 *
 * It raises the heap. The web suite needs more than node's default and the
 * failure mode is exit 137 from the OOM killer, which reads as a real test
 * failure and sends you looking for a bug that is not there. That is named
 * explicitly in the summary rather than left to be rediscovered.
 */
import * as NodeChildProcess from "node:child_process";

import { REPO_ROOT, Report, bold, cyan, dim, green, red, runMain } from "./lib.mjs";

const SCRIPTS = ".agents/skills/fork-upstream-merge/scripts";

/**
 * Cheapest first, so the findings that need no waiting arrive first. The fork
 * checks lead: they are seconds, and they are the ones that catch a merge that
 * resolved a conflict the wrong way — which typecheck and test cannot see,
 * because dropping a fork delta leaves code that compiles and passes.
 */
const STEPS = [
  {
    name: "tripwires",
    argv: ["node", `${SCRIPTS}/tripwires.mjs`],
    what: "deleted surfaces, re-deletions, and workflow state on GitHub",
  },
  {
    name: "unsupported-methods",
    argv: ["node", `${SCRIPTS}/unsupported-methods.mjs`],
    what: "contract union entries against the Moatless dispatch arms",
  },
  { name: "fmt:check", argv: ["pnpm", "fmt:check"], what: "formatting" },
  { name: "lint", argv: ["pnpm", "lint"], what: "lint rules" },
  { name: "typecheck", argv: ["pnpm", "typecheck"], what: "types across every workspace" },
  { name: "test", argv: ["pnpm", "test"], what: "every workspace test suite" },
];

/** The web suite exceeds node's default heap; see the header. */
const HEAP_MB = 12288;

function run(step) {
  const started = process.hrtime.bigint();
  process.stdout.write(`\n${bold(cyan(`── ${step.name}`))} ${dim(step.what)}\n`);

  const [command, ...args] = step.argv;
  const result = NodeChildProcess.spawnSync(command, args, {
    cwd: REPO_ROOT,
    stdio: "inherit",
    env: {
      ...process.env,
      NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ""} --max-old-space-size=${HEAP_MB}`.trim(),
    },
  });

  const seconds = Number(process.hrtime.bigint() - started) / 1e9;
  return { ...step, status: result.status ?? 1, signal: result.signal, seconds };
}

function summarize(results) {
  const report = new Report();
  const section = report.section("Verification");

  for (const result of results) {
    const took = `${result.seconds.toFixed(0)}s`;
    if (result.status === 0) {
      section.ok(`${result.name} ${dim(took)}`);
      continue;
    }
    // 137 is SIGKILL, which here means the OOM killer rather than a failing
    // assertion. Chasing it as a test failure is a long detour.
    if (result.status === 137 || result.signal === "SIGKILL") {
      section.fail(`${result.name} was killed — out of memory, not a failing check`, [
        `Already retried at --max-old-space-size=${HEAP_MB}. Raise it, or run the`,
        "workspaces one at a time to find which suite is the heavy one.",
      ]);
      continue;
    }
    section.fail(`${result.name} exited ${result.status} ${dim(took)}`, [
      `Re-run just this one: node ${SCRIPTS}/verify.mjs --only ${result.name}`,
    ]);
  }
  return report;
}

runMain(async () => {
  const onlyFlag = process.argv.indexOf("--only");
  const only = onlyFlag === -1 ? null : new Set((process.argv[onlyFlag + 1] ?? "").split(","));

  const steps = only ? STEPS.filter((step) => only.has(step.name)) : STEPS;
  if (steps.length === 0) {
    throw new Error(`--only matched no steps. Known: ${STEPS.map((s) => s.name).join(", ")}`);
  }

  const results = [];
  for (const step of steps) results.push(run(step));

  const report = summarize(results);
  report.print();

  const failed = results.filter((result) => result.status !== 0);
  if (failed.length > 0) {
    process.stdout.write(
      `${bold(red(`${failed.length} of ${results.length} checks failed.`))} ` +
        `Fix them together, then re-run this command.\n\n`,
    );
    return 1;
  }
  process.stdout.write(`${bold(green(`All ${results.length} checks passed.`))}\n\n`);
  return 0;
});
