#!/usr/bin/env node
/**
 * The whole verification pass, as one command.
 *
 *   node .agents/skills/fork-upstream-merge/scripts/verify.mjs
 *   node .agents/skills/fork-upstream-merge/scripts/verify.mjs --only typecheck,test
 *
 * Three things this does that `a && b && c && d` does not.
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
 *
 * It retries a failing test package alone before reporting it. The packages
 * `pnpm test` runs share one machine's CPU and memory, and a merge on a loaded
 * sandbox reliably turns up a perf-budget miss or a timeout that has nothing to
 * do with the merge — the previous version of this script made a human re-run
 * each one by hand to tell a real regression from machine noise. A package that
 * fails in the full run and passes alone is reported as flaky, not fixed
 * silently: the run is still worth a second look if the same package keeps
 * turning up.
 */
import * as NodeChildProcess from "node:child_process";

import { REPO_ROOT, Report, bold, cyan, dim, green, red, runMain, yellow } from "./lib.mjs";

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
  {
    name: "test",
    // Same as `pnpm test` (`"test": "vp run -r test"`), called directly so
    // `--log labeled` can prefix every line with the package it came from —
    // that prefix is what makes a failure attributable to a package to retry.
    argv: ["vp", "run", "-r", "--log", "labeled", "test"],
    what: "every workspace test suite",
    retryPackagesOnFailure: true,
  },
];

/** The web suite exceeds node's default heap; see the header. */
const HEAP_MB = 12288;

function heapEnv() {
  return {
    ...process.env,
    NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ""} --max-old-space-size=${HEAP_MB}`.trim(),
  };
}

function run(step) {
  const started = process.hrtime.bigint();
  process.stdout.write(`\n${bold(cyan(`── ${step.name}`))} ${dim(step.what)}\n`);

  const [command, ...args] = step.argv;
  const result = NodeChildProcess.spawnSync(command, args, {
    cwd: REPO_ROOT,
    stdio: "inherit",
    env: heapEnv(),
  });

  const seconds = Number(process.hrtime.bigint() - started) / 1e9;
  return { ...step, status: result.status ?? 1, signal: result.signal, seconds };
}

/**
 * Runs a command with its output streamed live (same as `stdio: "inherit"`)
 * while also collecting it, so the labeled prefixes can be parsed once the
 * process exits without making the run itself silent.
 */
function runCapturing(command, args) {
  return new Promise((resolve) => {
    const child = NodeChildProcess.spawn(command, args, { cwd: REPO_ROOT, env: heapEnv() });
    let buffer = "";
    const onData = (chunk) => {
      buffer += chunk;
      process.stdout.write(chunk);
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.on("close", (status, signal) => resolve({ status, signal, output: buffer }));
  });
}

/** `[@scope/pkg#test] rest of the line` under `--log labeled`. */
const LABEL_LINE = /^\[([^\]]+)#test\]\s?(.*)$/;

/**
 * Which packages vitest's own summary says failed. Keyed off `Test Files  N
 * failed` rather than individual `FAIL` lines: it is the one line every
 * failing package prints exactly once, so it cannot double count a package
 * with several failing files or miss one whose failure has no `FAIL` line of
 * its own (an unhandled rejection during setup, for instance).
 */
function failedPackagesFromOutput(output) {
  const failed = new Set();
  for (const line of output.split("\n")) {
    const match = LABEL_LINE.exec(line);
    if (!match) continue;
    const [, pkg, rest] = match;
    if (/Test Files\s+\d+\s+failed/.test(rest)) failed.add(pkg);
  }
  return failed;
}

/** Re-runs one package's test task alone, away from the other packages' load. */
function retryPackageAlone(pkg) {
  const result = NodeChildProcess.spawnSync("vp", ["run", "--filter", pkg, "test"], {
    cwd: REPO_ROOT,
    stdio: "inherit",
    env: heapEnv(),
  });
  return (result.status ?? 1) === 0;
}

async function runTestStep(step) {
  const started = process.hrtime.bigint();
  process.stdout.write(`\n${bold(cyan(`── ${step.name}`))} ${dim(step.what)}\n`);

  const [command, ...args] = step.argv;
  const { status, signal, output } = await runCapturing(command, args);
  const seconds = Number(process.hrtime.bigint() - started) / 1e9;

  if ((status ?? 1) === 0 || status === 137 || signal === "SIGKILL") {
    return { ...step, status: status ?? 1, signal, seconds };
  }

  const failedPackages = failedPackagesFromOutput(output);
  if (failedPackages.size === 0) {
    // Output didn't match the expected shape — do not guess. Report the
    // plain failure the way every other step does.
    return { ...step, status, signal, seconds };
  }

  process.stdout.write(
    `\n${dim(`retrying ${failedPackages.size} failing package(s) alone: ${[...failedPackages].join(", ")}`)}\n`,
  );
  const retried = [];
  for (const pkg of failedPackages) {
    process.stdout.write(`\n${bold(cyan(`── retry ${pkg}`))}\n`);
    retried.push({ pkg, passedAlone: retryPackageAlone(pkg) });
  }

  const stillFailing = retried.filter((entry) => !entry.passedAlone);
  return {
    ...step,
    // Flaky packages that pass alone no longer fail the step; a package that
    // fails alone too is a real finding and keeps the step red.
    status: stillFailing.length > 0 ? status : 0,
    signal,
    seconds,
    retried,
  };
}

function summarize(results) {
  const report = new Report();
  const section = report.section("Verification");

  for (const result of results) {
    const took = `${result.seconds.toFixed(0)}s`;
    if (result.retried?.length > 0) {
      const stillFailing = result.retried.filter((entry) => !entry.passedAlone);
      const flaky = result.retried.filter((entry) => entry.passedAlone);
      if (stillFailing.length === 0) {
        section.warn(`${result.name} ${dim(took)} — flaky, passed alone`, [
          `${flaky.map((entry) => entry.pkg).join(", ")} failed in the full run, passed in isolation.`,
          "Not a merge regression, but worth a second look if it keeps recurring.",
        ]);
      } else {
        section.fail(`${result.name} exited ${result.status} ${dim(took)}`, [
          `Confirmed failing alone, not machine noise: ${stillFailing.map((entry) => entry.pkg).join(", ")}`,
          ...(flaky.length > 0
            ? [`Flaky (passed alone): ${flaky.map((entry) => entry.pkg).join(", ")}`]
            : []),
        ]);
      }
      continue;
    }
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
  for (const step of steps) {
    results.push(step.retryPackagesOnFailure ? await runTestStep(step) : run(step));
  }

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
  const flakyNote = results.some((result) => result.retried?.some((entry) => entry.passedAlone))
    ? ` ${yellow("(some packages were flaky under load and passed on retry)")}`
    : "";
  process.stdout.write(`${bold(green(`All ${results.length} checks passed.`))}${flakyNote}\n\n`);
  return 0;
});
