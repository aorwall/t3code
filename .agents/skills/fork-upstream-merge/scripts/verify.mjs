#!/usr/bin/env node
/**
 * The whole verification pass, as one command.
 *
 *   node .agents/skills/fork-upstream-merge/scripts/verify.mjs
 *   node .agents/skills/fork-upstream-merge/scripts/verify.mjs --fast
 *   node .agents/skills/fork-upstream-merge/scripts/verify.mjs --only typecheck,test
 *   node .agents/skills/fork-upstream-merge/scripts/verify.mjs --only test --package @t3tools/web
 *   node .agents/skills/fork-upstream-merge/scripts/verify.mjs --sequential
 *
 * `--package` runs the test step for one package. The full pass outruns the
 * ten-minute limit an agent's shell call gets, which turns the last step of
 * every merge into a background job and a polling loop — and a poll that gets
 * interrupted loses the run. One package at a time fits, and the retry path
 * below already had to run them individually anyway.
 *
 * `--sequential` runs every test package one at a time instead of handing the
 * whole workspace to `vp run -r test`. It is slower on a machine that can take
 * the parallel run, and it is the one that finishes on a machine that cannot:
 * the parallel step's peak memory is what gets a loaded sandbox evicted, and an
 * eviction costs the entire pass because the run has no partial result to keep.
 * One package at a time bounds that peak and makes each phase short, so an
 * eviction costs one package. The 2026-09-15 merge lost two full passes to this
 * before finishing sequentially.
 *
 * It also prints a `PKG <name> PASS|FAIL` ledger line as each package lands, so
 * a log that gets truncated is still readable up to the cut — and so nobody has
 * to hand-roll the same loop in bash, where `node verify.mjs … | tail` silently
 * reports the exit code of `tail`.
 *
 * `--fast` drops the test step and keeps everything else. The full pass is about
 * thirteen minutes and the test step is most of it, so a merge with something to
 * fix pays that twice — once to find the problem, once to confirm the fix. The
 * checks `--fast` keeps are the ones that catch a broken merge: a duplicated
 * import shows up in `lint` in seconds, where the tests take minutes to report
 * the same thing. Iterate on `--fast`, then run the whole thing once before
 * writing anything down.
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
 *
 * A package that fails that retry too then has its failing file run on its own,
 * because dropping the other packages does not stop a package contending with
 * itself: `@t3tools/mobile` runs 165 files concurrently either way. On
 * 2026-09-13 a highlighting test failed the full run and the retry, passed in
 * 1.5s as a single file, and the whole package passed on a re-run — and the
 * label said "Confirmed failing alone, not machine noise", which is the one line
 * a reader trusts to tell a regression from sandbox noise. A file that fails on
 * its own is confirmed and keeps the step red; one that passes on its own is
 * reported as having failed the retry and passed as a single file, and does not.
 *
 * A confirmed failure that `docs/fork/gaps.md` already accounts for says so on
 * the failure line — `known gap: <heading>` — but only while the gap's own
 * `**Open while:**` command still fails. See `knownGaps` below.
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
    // Catches a lockfile that landed as upstream's copy whole, with the fork's
    // own dependency edges gone. Nothing else here sees that: `pnpm-lock.yaml`
    // is `theirs`, which `resolution-check.mjs` exempts from its byte-identical
    // rule, and lint, typecheck and test run against a working tree installed
    // from a re-derived lockfile rather than the committed one.
    //
    // `--lockfile-only` resolves without writing; `--frozen-lockfile` makes a
    // mismatch against the manifests an error.
    name: "lockfile",
    argv: ["pnpm", "install", "--frozen-lockfile", "--ignore-scripts", "--lockfile-only"],
    what: "the committed lockfile against every workspace manifest",
  },
  { name: "fmt:check", argv: ["pnpm", "fmt:check"], what: "formatting" },
  { name: "lint", argv: ["pnpm", "lint"], what: "lint rules" },
  { name: "typecheck", argv: ["pnpm", "typecheck"], what: "types across every workspace" },
  {
    // The only step that runs a real bundler, and the only one that can see
    // what a bundler sees. Upstream's `t3code:third-party-licenses` plugin runs
    // in `generateBundle`, so it is unreachable from typecheck and test, and it
    // hard-fails on any bundled package whose license it cannot resolve — every
    // dependency edge the fork has and upstream does not is a candidate.
    //
    // The 2026-09-13 merge passed all eight checks here and broke
    // `Build & push moatless-t3` on its first CI run, after the branch was
    // pushed and the PR was open: the fork's `mermaid` edge bundles `khroma`,
    // `fastdom` and `strictdom`, which upstream never bundles and its
    // `third-party-licenses.config.json` therefore says nothing about.
    //
    // `apps/web` only. It is the fork's one shipped client, and the other apps
    // add minutes to every pass for bundles no deployment pulls.
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
 * Keyed off vitest's own closing `Test Files` line, not off any labeled line:
 * `vp run -r test` kills the packages still running when one of them fails, so
 * a package can print two hundred passing files and never reach its summary.
 * Counting those as tested is a false green — on 2026-09-07 a desktop failure
 * cut the web suite short and four failing web tests went unreported.
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
 * Returns the raw status and signal rather than a boolean: the summary tells an
 * OOM kill from a failing test by reading them, and the web suite is the one
 * that gets OOM-killed. `files` narrows the run to those test files, which is
 * what separates a package contending with itself from a real failure.
 */
function runPackageAlone(pkg, files = []) {
  return runCapturing("vp", ["run", "--filter", pkg, "test", ...files]);
}

const ANSI = /\[[0-9;]*m/g;

/**
 * The test files vitest named as failing.
 *
 * Read off its `FAIL <path> > <suite> > <name>` lines, which it prints once per
 * failing test and which carry the path this needs. A package whose failure has
 * no such line — a setup crash, an unhandled rejection — yields nothing, and the
 * caller reports that rather than guessing.
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
 * How far a package's failure survived being run on its own.
 *
 *   passed          — the package passes once the other packages are not running.
 *   confirmed       — a single failing file fails on its own. A finding.
 *   load-sensitive  — the package fails alone and each failing file passes as a
 *                     single file, so what it contends with is itself.
 *   unidentified    — failed twice, and which file failed could not be read out
 *                     of the output. Still a finding: something failed, and this
 *                     cannot say it was the machine.
 *
 * Only `confirmed` and `unidentified` keep the step red. The distinction is the
 * point of the whole path: a label that says a failure is real when it is load
 * noise sends someone hunting a regression that does not exist.
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
 * A package that fails here is put through the same file-level confirmation the
 * retry path uses. Running a package away from the others does not make it alone
 * — its own files still run concurrently — so a `--sequential` failure is no more
 * confirmed than a retry failure is, and saying otherwise is the same false
 * label. Only a single file that fails by itself is a finding.
 *
 * The ledger line is the point of the mode as much as the memory ceiling is. It
 * is written before the next package starts, so a log cut off mid-run still says
 * which packages passed, which is exactly what an evicted run cannot otherwise
 * tell you.
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
 * `vp run -r test` kills the packages still running when one of them fails, so
 * the parallel log can carry a real-looking `FAIL` for a package that was cut
 * off mid-file and passes on its own. On 2026-09-11 four packages were re-run
 * alone and all passed, while a truncated `apps/mobile` failure stayed in the
 * log above the retries with nothing marking it superseded — and it cost a
 * diagnosis pass on a test neither side of the merge touched.
 *
 * The summary line already says which verdict each package earned. This says it
 * where the misleading output is, for the reader scrolling rather than jumping
 * to the end.
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

  // `vp run -r test` does not always finish every package that declares a test
  // script, and it exits 0 when it skips one: a merge can pass this step with
  // the fork's main surface never tested. The packages that finished printed a
  // summary line, so the ones that did not are knowable. Run those rather than
  // only naming them — a step that reports green is claiming they ran.
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
 * `docs/fork/gaps.md` already lists the packages expected to be red — the
 * libsecret entry says it exists "so the next merge does not chase it as a
 * regression" — but nothing connected the register to the failure, so it only
 * worked on a reader who had already opened it. Two slots connect them:
 *
 *   **Package:**    the workspace package the entry is about.
 *   **Open while:** a command that exits nonzero while the gap is open.
 *
 * The predicate is what makes the marker safe to print. Matching a failing
 * package against heading prose would keep saying "known gap" long after the
 * gap closed, which excuses the next real regression in the same package. A
 * command that has to fail for the marker to appear stops on its own.
 *
 * Neither existing slot can host it. `**Check:**` means "what to run to see the
 * state" and its polarity varies between entries; `**Closes when:**` is prose
 * about backend state. So this is a third slot, and the two keep their meanings.
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
