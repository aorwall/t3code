#!/usr/bin/env node
/**
 * The whole verification pass, as one command.
 *
 *   node .agents/skills/fork-upstream-merge/scripts/verify.mjs [--fast|--sequential|--only a,b]
 *
 * Keeps going after a failure and raises the heap (exit 137 is OOM, not a test). `--sequential`
 * bounds peak memory. A package fails only if a single file fails by itself on retry.
 */
import * as NodeChildProcess from "node:child_process";
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";

import {
  REPO_ROOT,
  Report,
  bold,
  capNote,
  cyan,
  dim,
  green,
  heapEnv,
  heapMb,
  red,
  runMain,
  yellow,
} from "./lib.mjs";

const SCRIPTS = ".agents/skills/fork-upstream-merge/scripts";

/**
 * Cheapest first, so the findings that need no waiting arrive first. The fork
 * checks lead: they are seconds, and they are the ones that catch a merge that
 * resolved a conflict the wrong way — which typecheck and test cannot see,
 * because dropping a fork delta leaves code that compiles and passes.
 */
const STEPS = [
  {
    name: "duplicate-adds",
    argv: ["node", `${SCRIPTS}/duplicate-adds.mjs`],
    what: "lines both sides added that the merge took twice",
  },
  {
    name: "tripwires",
    argv: ["node", `${SCRIPTS}/tripwires.mjs`],
    what: "deleted surfaces, re-deletions, and workflow state on GitHub",
  },
  {
    name: "resolution-check",
    argv: ["node", `${SCRIPTS}/resolution-check.mjs`],
    what: "resolutions that landed as one side whole",
  },
  {
    name: "unsupported-methods",
    argv: ["node", `${SCRIPTS}/unsupported-methods.mjs`],
    what: "contract union entries against the Moatless dispatch arms",
  },
  {
    // Catches a lockfile that landed as upstream's copy with the fork's dependency edges gone.
    // Nothing else sees it: `pnpm-lock.yaml` is `theirs` and exempt from the byte-identical rule,
    // and other steps run on a re-derived lockfile.
    name: "lockfile",
    argv: ["pnpm", "install", "--frozen-lockfile", "--ignore-scripts", "--lockfile-only"],
    what: "the committed lockfile against every workspace manifest",
  },
  { name: "fmt:check", argv: ["pnpm", "fmt:check"], what: "formatting" },
  { name: "lint", argv: ["pnpm", "lint"], what: "lint rules" },
  { name: "typecheck", argv: ["pnpm", "typecheck"], what: "types across every workspace" },
  {
    // The only step running a real bundler; upstream's `t3code:third-party-licenses` plugin runs in
    // `generateBundle` and hard-fails on any bundled package with an unresolvable license, which
    // every fork-only dependency edge risks. `apps/web` only: the other apps add minutes.
    name: "build",
    argv: ["vp", "run", "--filter", "@t3tools/web", "build"],
    what: "the production web bundle and its license derivation",
  },
  {
    name: "test",
    slow: true,
    // Same as `pnpm test` (`"test": "vp run -r test"`), called directly so
    // `--log labeled` can prefix every line with the package it came from —
    // that prefix is what makes a failure attributable to a package to retry.
    argv: ["vp", "run", "-r", "--log", "labeled", "test"],
    what: "every workspace test suite",
    retryPackagesOnFailure: true,
  },
];

/**
 * The web suite exceeds node's default heap; see the header. The derivation is
 * in `lib.mjs` because the install that has to precede this needs the same
 * number — `install.mjs` is the other caller.
 */
const HEAP_MB = heapMb();

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
 * Which packages vitest's own summary says failed.
 *
 * Keyed off `Test Files  N failed`, printed once per failing package, so it neither double counts
 * nor misses a package with no `FAIL` line (setup rejection).
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

/**
 * Every workspace package name, read out of `pnpm-workspace.yaml`.
 *
 * `--package` takes a name, and a name that matches nothing is a filter that
 * runs no tests — which reads as a passing test step. Checking the name against
 * the workspace turns that into an error naming the packages that do exist.
 */
function workspacePackages() {
  const yaml = NodeFS.readFileSync(NodePath.join(REPO_ROOT, "pnpm-workspace.yaml"), "utf8");
  const globs = [];
  for (const line of yaml.split("\n")) {
    if (/^packages:/.test(line)) continue;
    const match = line.match(/^\s+-\s+(\S+)\s*$/);
    if (match) globs.push(match[1]);
    else if (globs.length > 0 && /^\S/.test(line)) break;
  }

  const dirs = globs.flatMap((glob) => {
    if (!glob.endsWith("/*")) return [glob];
    const parent = NodePath.join(REPO_ROOT, glob.slice(0, -2));
    if (!NodeFS.existsSync(parent)) return [];
    return NodeFS.readdirSync(parent).map((name) => `${glob.slice(0, -2)}/${name}`);
  });

  const names = new Set();
  const withTests = new Set();
  for (const dir of dirs) {
    const manifest = NodePath.join(REPO_ROOT, dir, "package.json");
    if (!NodeFS.existsSync(manifest)) continue;
    const { name, scripts } = JSON.parse(NodeFS.readFileSync(manifest, "utf8"));
    if (!name) continue;
    names.add(name);
    if (scripts?.test) withTests.add(name);
  }
  return { names, withTests };
}

/**
 * Every package whose suite ran to the end, passing or failing.
 *
 * Keyed off vitest's closing `Test Files` line: `vp run -r test` kills packages still running
 * after a failure, and counting those as tested is a false green.
 */
const COMPLETION_LINE = /Test Files\s+\d|No test files found/;

function completedPackages(output) {
  const seen = new Set();
  for (const line of output.split("\n")) {
    const match = LABEL_LINE.exec(line);
    if (match && COMPLETION_LINE.test(match[2])) seen.add(match[1]);
  }
  return seen;
}

/**
 * Runs one package's test task alone, away from the other packages' load.
 *
 * Returns raw status and signal, since the summary tells an OOM kill from a failing test by them.
 * `files` narrows the run to those test files.
 */
function runPackageAlone(pkg, files = []) {
  return runCapturing("vp", ["run", "--filter", pkg, "test", ...files]);
}

const ANSI = /\[[0-9;]*m/g;

/**
 * The test files vitest named as failing, read off its `FAIL <path> > ...` lines.
 *
 * A package with no such line (setup crash, unhandled rejection) yields nothing; the caller
 * reports that rather than guessing.
 */
const FAIL_FILE = /(?:^|\s)FAIL\s+(\S+\.(?:test|spec)\.[cm]?[jt]sx?)\b/;

function failedFilesFromOutput(output) {
  const files = new Set();
  for (const line of output.replace(ANSI, "").split("\n")) {
    const match = FAIL_FILE.exec(LABEL_LINE.exec(line)?.[2] ?? line);
    if (match) files.add(match[1]);
  }
  return [...files];
}

/**
 * How far a package's failure survived running alone: `passed`, `confirmed` (one file fails by
 * itself), `load-sensitive` (fails alone, each file passes singly), `unidentified` (failing file
 * unreadable). Only `confirmed` and `unidentified` keep the step red.
 */
async function confirmPackageFailure(pkg) {
  const alone = await runPackageAlone(pkg);
  if ((alone.status ?? 1) === 0) return { pkg, verdict: "passed" };

  const files = failedFilesFromOutput(alone.output);
  if (files.length === 0)
    return { pkg, verdict: "unidentified", status: alone.status, signal: alone.signal };

  const failed = [];
  for (const file of files) {
    process.stdout.write(`\n${bold(cyan(`── retry ${pkg} ${file}`))}\n`);
    const single = await runPackageAlone(pkg, [file]);
    // A filter that matched nothing is not a pass. Vitest says so in one line,
    // and treating it as green would turn a real failure into silence.
    if (/No test files found/.test(single.output.replace(ANSI, ""))) {
      return { pkg, verdict: "unidentified", status: alone.status, signal: alone.signal };
    }
    if ((single.status ?? 1) !== 0) failed.push(file);
  }
  return {
    pkg,
    verdict: failed.length > 0 ? "confirmed" : "load-sensitive",
    files,
    failed,
    status: alone.status,
    signal: alone.signal,
  };
}

const isFinding = (entry) => entry.verdict === "confirmed" || entry.verdict === "unidentified";

/**
 * Every test package, one at a time, with a ledger line as each one lands.
 *
 * A failure gets the same file-level confirmation as the retry path: a package alone still runs
 * its files concurrently. The ledger line is written before the next package starts, so a cut-off
 * log still shows which passed.
 */
async function runPackagesSequentially(packages) {
  const ledger = [];
  for (const [index, pkg] of packages.entries()) {
    process.stdout.write(
      `\n${bold(cyan(`── ${pkg}`))} ${dim(`(${index + 1} of ${packages.length})`)}\n`,
    );
    const at = process.hrtime.bigint();
    const confirmation = await confirmPackageFailure(pkg);
    const seconds = Number(process.hrtime.bigint() - at) / 1e9;
    const mark =
      confirmation.verdict === "passed"
        ? green("PASS")
        : isFinding(confirmation)
          ? red(`FAIL(${confirmation.signal ?? confirmation.status})`)
          : yellow("FAIL-LOAD");
    process.stdout.write(`${bold(`PKG ${pkg}`)} ${mark} ${dim(`${seconds.toFixed(0)}s`)}\n`);
    ledger.push({ ...confirmation, seconds });
  }
  return ledger;
}

/**
 * Draws a line under the parallel pass before anything is re-run.
 *
 * `vp run -r test` kills running packages on a failure, so the log can hold a `FAIL` for a package
 * that was cut off and passes alone. This marks it superseded where the reader scrolls.
 */
function supersededBanner(packages) {
  return (
    `${yellow("── everything above this line is the parallel pass")}\n` +
    `${dim(`Its output for ${packages.join(", ")} is superseded by the runs below: \`vp run -r test\``)}\n` +
    `${dim("stops the packages still running when one fails, so a FAIL up there can belong to a")}\n` +
    `${dim("package that was truncated mid-file. Read the runs below and the summary, not the log above.")}\n`
  );
}

async function runTestStep(step, onlyPackage, sequential) {
  const started = process.hrtime.bigint();
  process.stdout.write(`\n${bold(cyan(`── ${step.name}`))} ${dim(step.what)}\n`);

  // One package is not one run: its own files still run concurrently, so a
  // failure here goes through the same file-level confirmation as a retry.
  if (onlyPackage) {
    const confirmation = await confirmPackageFailure(onlyPackage);
    const seconds = Number(process.hrtime.bigint() - started) / 1e9;
    return {
      ...step,
      what: `${onlyPackage} only`,
      status: isFinding(confirmation) ? (confirmation.status ?? 1) : 0,
      signal: confirmation.signal,
      seconds,
      retried: confirmation.verdict === "passed" ? [] : [confirmation],
    };
  }

  if (sequential) {
    // Sorted so two runs on the same tree list their packages in the same
    // order, which is what makes one run's log diffable against another's.
    const packages = [...workspacePackages().withTests].sort();
    const ledger = await runPackagesSequentially(packages);
    const seconds = Number(process.hrtime.bigint() - started) / 1e9;
    return {
      ...step,
      what: `${packages.length} packages, one at a time`,
      status: ledger.some(isFinding) ? 1 : 0,
      seconds,
      sequential: ledger,
    };
  }

  const [command, ...args] = step.argv;
  const { status, signal, output } = await runCapturing(command, args);

  // `vp run -r test` exits 0 when it skips a package, so a merge can pass without the fork's main
  // surface tested. Packages that finished printed a summary line; run the rest rather than only
  // naming them.
  const skipped = [...workspacePackages().withTests].filter(
    (pkg) => !completedPackages(output).has(pkg),
  );
  const skippedFailed = [];
  if (skipped.length > 0) {
    process.stdout.write(
      `\n${supersededBanner(skipped)}` +
        `\n${yellow(`${skipped.length} package(s) declare a test script and did not finish: ${skipped.join(", ")}`)}\n` +
        `${dim("running each alone — `vp run -r test` skips or truncates them")}\n`,
    );
    for (const pkg of skipped) {
      process.stdout.write(
        `\n${bold(cyan(`── skipped ${pkg}`))} ${dim("supersedes its truncated output in the parallel pass above")}\n`,
      );
      const confirmation = await confirmPackageFailure(pkg);
      if (confirmation.verdict !== "passed") skippedFailed.push(confirmation);
    }
  }
  const skippedFindings = skippedFailed.filter(isFinding);

  const seconds = Number(process.hrtime.bigint() - started) / 1e9;

  if ((status ?? 1) === 0 || status === 137 || signal === "SIGKILL") {
    return {
      ...step,
      status: skippedFindings.length > 0 ? 1 : (status ?? 1),
      signal,
      seconds,
      skipped,
      skippedFailed,
    };
  }

  const failedPackages = failedPackagesFromOutput(output);
  if (failedPackages.size === 0) {
    // Output didn't match the expected shape — do not guess. Report the
    // plain failure the way every other step does.
    return { ...step, status, signal, seconds, skipped, skippedFailed };
  }

  process.stdout.write(
    `\n${supersededBanner([...failedPackages])}` +
      `\n${dim(`retrying ${failedPackages.size} failing package(s) alone: ${[...failedPackages].join(", ")}`)}\n`,
  );
  const retried = [];
  for (const pkg of failedPackages) {
    process.stdout.write(
      `\n${bold(cyan(`── retry ${pkg}`))} ${dim("supersedes its output in the parallel pass above")}\n`,
    );
    retried.push(await confirmPackageFailure(pkg));
  }

  const findings = [...retried, ...skippedFailed].filter(isFinding);
  return {
    ...step,
    skipped,
    skippedFailed,
    // A package that passes alone, and one whose failing file passes as a single
    // file, no longer fail the step: neither is something to fix in the merge.
    // A file that fails on its own keeps it red.
    status: findings.length > 0 ? status || 1 : 0,
    signal,
    seconds,
    retried,
  };
}

const GAPS_PATH = "docs/fork/gaps.md";

/**
 * The package-scoped entries in the gaps register.
 *
 * Two slots in `docs/fork/gaps.md` connect an entry to a failure: `**Package:**` (the workspace
 * package) and `**Open while:**` (a command that exits nonzero while the gap is open). The
 * predicate keeps "known gap" from excusing a real regression after the gap closes.
 */
function knownGaps() {
  let text;
  try {
    text = NodeFS.readFileSync(NodePath.join(REPO_ROOT, GAPS_PATH), "utf8");
  } catch {
    return [];
  }
  const entries = [];
  let current = null;
  for (const line of text.split("\n")) {
    const heading = /^###\s+(.*\S)\s*$/.exec(line);
    if (heading) {
      current = { heading: heading[1], pkg: null, predicate: null };
      entries.push(current);
      continue;
    }
    if (!current) continue;
    const pkg = /^\s*-?\s*\*\*Package:\*\*\s*`?(\S+?)`?\s*$/.exec(line);
    if (pkg) current.pkg = pkg[1];
    const open = /^\s*-?\s*\*\*Open while:\*\*\s*`([^`]+)`/.exec(line);
    if (open) current.predicate = open[1];
  }
  // Fail closed: an entry missing either slot is not consulted, so the backfill
  // is incremental and an un-backfilled failure reads exactly as it does now.
  return entries.filter((entry) => entry.pkg && entry.predicate);
}

let gapsCache = null;

/** The register entry that already explains this package's failure, or `null`. */
function knownGapFor(pkg) {
  gapsCache ??= knownGaps();
  for (const gap of gapsCache) {
    if (gap.pkg !== pkg) continue;
    const probe = NodeChildProcess.spawnSync("sh", ["-c", gap.predicate], {
      cwd: REPO_ROOT,
      stdio: "ignore",
      timeout: 60_000,
    });
    // A predicate that could not be run says nothing either way, and a marker
    // printed on no evidence is the failure mode this design exists to avoid.
    if (probe.error) continue;
    if ((probe.status ?? 1) !== 0) return gap;
  }
  return null;
}

function gapNotes(entries) {
  const notes = [];
  for (const entry of entries) {
    const gap = knownGapFor(entry.pkg);
    if (!gap) continue;
    notes.push(
      `known gap: ${gap.heading}`,
      `  \`${gap.predicate}\` still fails, so ${entry.pkg} is the registered failure` +
        ` rather than a new one. ${GAPS_PATH} has the reasoning.`,
    );
  }
  return notes;
}

/**
 * What each verdict is worth to a reader, in the words they have to be able to
 * trust. Only `confirmed` and `unidentified` are failures; the other two say
 * what was observed and stop there.
 */
function confirmationNotes(entries) {
  const of = (verdict) => entries.filter((entry) => entry.verdict === verdict);
  const names = (group) => group.map((entry) => entry.pkg).join(", ");
  const withFiles = (group) =>
    group.map((entry) => {
      const files = entry.failed?.length > 0 ? entry.failed : (entry.files ?? []);
      return files.length > 0 ? `${entry.pkg} — ${files.join(", ")}` : entry.pkg;
    });

  const notes = [];
  const flaky = of("passed");
  if (flaky.length > 0) {
    notes.push(
      `${names(flaky)} failed in the full run, passed in isolation.`,
      "Not a merge regression, but worth a second look if it keeps recurring.",
    );
  }
  const loadSensitive = of("load-sensitive");
  if (loadSensitive.length > 0) {
    notes.push(
      `Failed the retry, passed as a single file: ${withFiles(loadSensitive).join("; ")}`,
      "The package's own files still run concurrently when it runs alone, so this",
      "is contention inside the package rather than a merge regression.",
    );
  }
  const confirmed = of("confirmed");
  if (confirmed.length > 0) {
    notes.push(`Confirmed failing alone, not machine noise: ${withFiles(confirmed).join("; ")}`);
    notes.push(...gapNotes(confirmed));
  }
  const unidentified = of("unidentified");
  if (unidentified.length > 0) {
    notes.push(
      `Failed the full run and the retry: ${names(unidentified)}`,
      "Which file failed could not be read out of the output, so none was run on",
      "its own — this is not confirmed in isolation. Re-run the package by hand.",
      ...gapNotes(unidentified),
    );
  }
  return notes;
}

function summarize(results) {
  const report = new Report();
  const section = report.section("Verification");

  for (const result of results) {
    const took = `${result.seconds.toFixed(0)}s`;

    // `--sequential` has its own shape: there is no skipped set to reconcile,
    // because every package was run deliberately. The confirmation ladder is the
    // same — running a package away from the others does not stop it contending
    // with itself, which is the question the file-level retry exists to answer.
    if (result.sequential) {
      const ran = `${result.sequential.length} package(s) ran one at a time`;
      const notes = confirmationNotes(
        result.sequential.filter((entry) => entry.verdict !== "passed"),
      );
      if (result.sequential.some(isFinding)) {
        section.fail(`${result.name} exited ${result.status} ${dim(took)}`, [
          ran,
          ...notes,
          `Re-run one: node ${SCRIPTS}/verify.mjs --only test --package <name>`,
        ]);
        continue;
      }
      if (notes.length > 0) {
        section.warn(`${result.name} ${dim(took)} — ${ran}, none confirmed failing`, notes);
        continue;
      }
      section.ok(`${result.name} ${dim(took)} — ${ran}`);
      continue;
    }

    // Said before the pass/fail line below, because "green" from a run that
    // skipped a package is the one result worth distrusting.
    const notes = [];
    if (result.skipped?.length > 0) {
      notes.push(
        `\`vp run -r test\` did not finish: ${result.skipped.join(", ")}`,
        "Each was run alone instead. A green step without this line means every package ran.",
      );
    }

    // Both paths to a failure: a package that failed the full run and failed its
    // retry, and a package that never finished the full run and failed when run
    // alone. Reporting one list and returning hid a confirmed desktop failure
    // behind a skipped-package failure on 2026-09-07.
    const entries = [...(result.retried ?? []), ...(result.skippedFailed ?? [])];
    notes.push(...confirmationNotes(entries));

    if (entries.some(isFinding)) {
      section.fail(`${result.name} exited ${result.status || 1} ${dim(took)}`, notes);
      continue;
    }
    if (notes.length > 0) {
      const headline =
        result.skipped?.length > 0
          ? `${result.skipped.length} package(s) needed a run of their own`
          : "failed under load, not on its own";
      section.warn(`${result.name} ${dim(took)} — ${headline}`, notes);
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
        `Already retried at --max-old-space-size=${HEAP_MB}${capNote()}.`,
        "Raising it past the pod's cap trades an OOM-killed process for an evicted",
        "pod, which loses the whole run and its log. Run --sequential instead to",
        "find which suite is the heavy one.",
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
  const fast = process.argv.includes("--fast");
  const packageFlag = process.argv.indexOf("--package");
  const onlyPackage = packageFlag === -1 ? null : process.argv[packageFlag + 1];
  const sequential = process.argv.includes("--sequential");

  let steps = only ? STEPS.filter((step) => only.has(step.name)) : STEPS;
  if (fast) steps = steps.filter((step) => !step.slow);
  if (steps.length === 0) {
    throw new Error(`--only matched no steps. Known: ${STEPS.map((s) => s.name).join(", ")}`);
  }
  if (packageFlag !== -1 && !onlyPackage) throw new Error("--package needs a package name.");
  if (onlyPackage) {
    const { names } = workspacePackages();
    if (!names.has(onlyPackage)) {
      throw new Error(
        `--package ${onlyPackage} is not a workspace package. One of:\n  ${[...names].sort().join("\n  ")}`,
      );
    }
  }
  if (onlyPackage && !steps.some((step) => step.retryPackagesOnFailure)) {
    throw new Error("--package only applies to the test step; add `--only test`.");
  }
  if (sequential && onlyPackage) {
    throw new Error(
      "--sequential and --package conflict: one package is already a run of its own.",
    );
  }
  if (sequential && fast) {
    throw new Error("--sequential and --fast conflict: --fast drops the test step it applies to.");
  }
  if (sequential && !steps.some((step) => step.retryPackagesOnFailure)) {
    throw new Error(
      "--sequential only applies to the test step; drop --only, or use `--only test`.",
    );
  }
  if (fast) {
    process.stdout.write(
      `${yellow("--fast")} ${dim(
        `skipping: ${STEPS.filter((step) => step.slow)
          .map((step) => step.name)
          .join(", ")}. Run the full pass before writing anything down.`,
      )}\n`,
    );
  }

  const results = [];
  for (const step of steps) {
    results.push(
      step.retryPackagesOnFailure ? await runTestStep(step, onlyPackage, sequential) : run(step),
    );
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
  const loadNoise = results.some((result) =>
    [...(result.retried ?? []), ...(result.skippedFailed ?? []), ...(result.sequential ?? [])].some(
      (entry) => entry.verdict === "passed" || entry.verdict === "load-sensitive",
    ),
  );
  const flakyNote = loadNoise
    ? ` ${yellow("(some packages failed under load and passed when run on their own)")}`
    : "";
  const fastNote = fast
    ? ` ${yellow("Tests did not run — this is not a merge's final verification.")}`
    : "";
  process.stdout.write(
    `${bold(green(`All ${results.length} checks passed.`))}${flakyNote}${fastNote}\n\n`,
  );
  return 0;
});
