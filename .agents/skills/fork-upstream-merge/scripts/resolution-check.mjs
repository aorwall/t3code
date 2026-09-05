#!/usr/bin/env node
/**
 * Resolutions that silently reverted to one side.
 *
 *   node .agents/skills/fork-upstream-merge/scripts/resolution-check.mjs
 *   node .agents/skills/fork-upstream-merge/scripts/resolution-check.mjs c3a5e9b8e
 *
 * The failure this exists for is a resolution that disappears without leaving a
 * marker. A sandbox restart reverts the uncommitted working tree: conflicted
 * files come back with their `<<<<<<<` markers and are obvious, while files
 * edited as collateral of resolving a conflict elsewhere revert in silence.
 *
 * Fork-only files have a detector for that already — the `guard` entries in the
 * inventory, which turn a lost `FEATURES` flag into a failing `features.test.ts`.
 * Nothing covered the upstream-owned half: no guard names those paths, and
 * `merge-stats.mjs` only counts files, so one lost file is noise. This reads the
 * content of each candidate path against both parents and reports where the
 * result contradicts the path's own verdict.
 *
 * So it says nothing about fork-only paths (`ours`), and cannot: with no
 * upstream side there is no third reference to compare against, and "identical
 * to the fork's copy" is that verdict's correct answer. Guards cover those.
 *
 * Two limits, both deliberate:
 *
 * It compares whole files. A path whose entry bundles several deltas can lose
 * one and keep another, and the file still differs from both parents, so
 * nothing fires. `inventory-check.mjs`'s `guard.symbol` checks are the finer
 * grain; this is the coarse net under them.
 *
 * The `// Fork:` marker census is reported, never enforced. A delta can be a
 * deletion — `apps/server/src/bin.ts` carries its whole delta as upstream's
 * `pairCommand` removed from a list, with no marker on either side of the merge
 * — so the census reads `0 → 0` whether that deletion survived or reverted. A
 * signal blind to half its own failure class does not get a vote.
 *
 * Like `duplicate-adds.mjs`, this runs mid-merge on purpose. Before the commit
 * exists a finding is still a plain edit.
 */
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";

import {
  REPO_ROOT,
  Report,
  blobLines,
  bold,
  dim,
  filesInWorkingTree,
  git,
  lines,
  loadInventory,
  mergeBase,
  mergeSides,
  runMain,
  verdictFor,
} from "./lib.mjs";

const FORK_MARKER = /\/\/\s*Fork:|\{\s*\/\*\s*Fork:|#\s*Fork:/;

/** How many fork hunks a side of the merge marked in this file. */
function countMarkers(content) {
  return content === null ? null : content.filter((line) => FORK_MARKER.test(line)).length;
}

/**
 * The merged content: the working tree mid-merge, the merge commit's own blob
 * once it is committed. Same shape as `duplicate-adds.mjs`'s `mergedLines`, and
 * for the same reason — reading the working tree is what lets this run before
 * the commit.
 */
function mergedLines(sides, path) {
  if (sides.state === "committed") return blobLines(sides.merged, path);
  const absolute = NodePath.resolve(REPO_ROOT, path);
  if (!NodeFS.existsSync(absolute)) return null;
  return NodeFS.readFileSync(absolute, "utf8").split("\n");
}

const same = (a, b) => a !== null && b !== null && a.join("\n") === b.join("\n");

/**
 * The three blobs a rule needs, or `null` when the comparison cannot be made.
 *
 * A path missing on either parent is one side's addition or upstream's
 * deletion. Neither is this check's business — re-deletions are what
 * `tripwires.mjs` watches — and both would otherwise read as "identical to the
 * side that still has it".
 *
 * `ours == theirs` means this merge had nothing to decide here. Without that
 * guard every path whose delta converged in some earlier merge fires forever,
 * which is staleness, and `inventory-check.mjs` already owns it.
 */
function sidesOfPath(sides, path) {
  const ours = blobLines(sides.ours, path);
  const theirs = blobLines(sides.theirs, path);
  const merged = mergedLines(sides, path);
  if (ours === null || theirs === null || merged === null) return null;
  if (same(ours, theirs)) return null;
  return { ours, theirs, merged };
}

/** Every path this merge could have dropped something in, from either direction. */
function candidatePaths(sides, base) {
  const landed =
    sides.state === "committed"
      ? lines(git(["diff", "--name-only", sides.ours, sides.merged]))
      : lines(git(["diff", "--name-only", "HEAD"]));
  const upstreamChanged = new Set(lines(git(["diff", "--name-only", base, sides.theirs])));
  const forkChanged = new Set(lines(git(["diff", "--name-only", base, sides.ours])));

  // Both directions are needed. A dropped fork delta shows up in `landed`. A
  // dropped upstream change cannot: it means the merged tree still equals the
  // fork's own pre-merge blob, so the path produces no diff against `ours` at
  // all and appears only in what upstream touched.
  const unresolved = new Set(lines(git(["diff", "--name-only", "--diff-filter=U"])));
  const candidates = [...new Set([...landed, ...upstreamChanged])]
    .filter((path) => !unresolved.has(path))
    .sort();

  // The narrower set, for reporting rather than for rules: a path only one side
  // touched has nobody's work to lose, and naming every upstream file the merge
  // carried would bury the handful worth reading.
  const bothChanged = candidates.filter(
    (path) => forkChanged.has(path) && upstreamChanged.has(path),
  );
  return { candidates, bothChanged };
}

/**
 * Landed as plain upstream, where the verdict promised a fork delta on top.
 *
 * `converged` fails outright: taking upstream and re-applying the listed delta
 * is the entire content of that verdict, so plain upstream means the delta is
 * gone. The entry promised one, so its absence is a finding on its own.
 *
 * `decide` only warns, and only when the fork's own side carried a `// Fork:`
 * marker. That verdict is usually a glob over a directory upstream owns, most
 * of whose files the fork has never touched — `apps/web/src/browser/**` covers
 * six of them — and for those, landing on upstream is not a resolution at all,
 * it is Tuesday. Requiring a marker is what separates "a marked delta stopped
 * being there" from "this file never had one", at the cost of missing a
 * delete-shaped delta, which is a trade only warnings can afford.
 */
function checkDeltaDrift(inventory, report, sides, paths) {
  const section = report.section("Fork delta, against what landed");
  let checked = 0;
  let found = 0;

  for (const path of paths) {
    const match = verdictFor(inventory, path);
    const verdict = match?.entry.verdict;
    if (verdict !== "converged" && verdict !== "decide") continue;
    const blobs = sidesOfPath(sides, path);
    if (blobs === null) continue;
    checked += 1;
    if (!same(blobs.merged, blobs.theirs)) continue;

    const before = countMarkers(blobs.ours);
    const after = countMarkers(blobs.merged);
    if (verdict === "decide" && before === 0) continue;

    const detail = [
      match.entry.mustSurvive ?? match.entry.note ?? "Nothing recorded on this entry.",
      `\`// Fork:\` markers ${before} → ${after}.`,
    ];
    const message = `${path} landed byte-identical to upstream [${match.entry.id}, ${verdict}]`;
    found += 1;
    if (verdict === "converged") {
      section.fail(message, [
        ...detail,
        "A `converged` path takes upstream and re-applies the delta above. Plain",
        "upstream means the delta was dropped — or it genuinely converged, in",
        "which case retire the entry in this same merge and this goes quiet.",
      ]);
    } else {
      section.warn(message, [...detail, "Confirm this is the decision, not a lost edit."]);
    }
  }

  if (checked === 0) return section.ok("no converged or decide path changed on both sides");
  // Counted per section, not from `report.failed`: that flag is the whole
  // report's, so a finding here would otherwise blank out the next section's
  // tally and make "checked and clean" look like "checked nothing".
  if (found === 0) section.ok(`${checked} path(s) checked, each still differs from upstream`);
}

/**
 * Landed as the fork's own pre-merge content, where upstream had moved on.
 *
 * The merged tree equalling `ours` on a path upstream changed means upstream's
 * change is simply not in. For `decide` that can be deliberate; everywhere else
 * the verdict says upstream's version is the base to start from.
 */
function checkUpstreamDrift(inventory, report, sides, paths) {
  const section = report.section("Upstream change, against what landed");
  let checked = 0;
  let found = 0;

  for (const path of paths) {
    const match = verdictFor(inventory, path);
    const verdict = match?.entry.verdict;
    if (!["theirs", "theirs-verbatim", "converged", "decide"].includes(verdict)) continue;
    const blobs = sidesOfPath(sides, path);
    if (blobs === null) continue;
    checked += 1;
    if (!same(blobs.merged, blobs.ours)) continue;

    const message =
      `${path} landed unchanged from the fork's pre-merge copy, ` +
      `but upstream changed it [${match.entry.id}, ${verdict}]`;
    found += 1;
    if (verdict === "decide") {
      section.warn(message, ["Confirm this is the decision, not a lost merge."]);
    } else {
      section.fail(message, [
        "This verdict takes upstream's version as the base. Nothing of upstream's",
        "change to this path is in the merge.",
      ]);
    }
  }

  if (checked === 0)
    return section.ok("no path with an upstream-taking verdict changed on both sides");
  if (found === 0) section.ok(`${checked} path(s) checked, each carries upstream's change`);
}

/**
 * `theirs-verbatim` paths that are not byte-identical to upstream.
 *
 * A standing invariant rather than a question about this merge, so it scans
 * every tracked path the verdict claims rather than the merge's own diff.
 *
 * Scoped to `theirs-verbatim` and never to plain `theirs`: `pnpm-lock.yaml` is
 * the fork's only `theirs` path and is meant to differ from upstream's lockfile
 * forever, so including it would make this step red on every merge — the same
 * standing failure `unsupported-methods.mjs` carries for `scripts.run`, which
 * is a thing to stop doing rather than to copy.
 */
function checkVerbatim(inventory, report, sides) {
  const section = report.section("theirs-verbatim paths, against upstream");
  const entries = inventory.pathPolicy.filter((entry) => entry.verdict === "theirs-verbatim");
  let checked = 0;
  let found = 0;

  for (const entry of entries) {
    if (entry.driftException) {
      section.info(`${entry.id}: documented exception — ${entry.driftException}`);
      continue;
    }
    for (const path of filesInWorkingTree(entry.paths)) {
      // A glob does not own every path it matches. `.github/workflows/**` is
      // `theirs-verbatim`, but `ci.yml` under it is `converged` and carries the
      // fork's one workflow step on purpose. Expanding the glob without asking
      // who actually wins reports that step as a delta that reappeared.
      if (verdictFor(inventory, path)?.entry.id !== entry.id) continue;
      const theirs = blobLines(sides.theirs, path);
      const merged = mergedLines(sides, path);
      if (theirs === null || merged === null) continue;
      checked += 1;
      if (same(merged, theirs)) continue;
      found += 1;
      section.fail(`${path} differs from upstream [${entry.id}, theirs-verbatim]`, [
        entry.mustSurvive ?? "This verdict promises upstream's file exactly.",
        "Find why a fork delta reappeared here. If it has to stay, it is not",
        "`theirs-verbatim` any more — change the verdict, or record a",
        "`driftException` on the entry saying why.",
      ]);
    }
  }

  if (checked === 0) return section.ok("none tracked");
  if (found === 0) section.ok(`${checked} path(s) byte-identical to upstream`);
}

/** Paths both sides moved that no entry claims — the ones needing thought. */
function reportUnlisted(inventory, report, sides, paths) {
  const unlisted = paths.filter(
    (path) => !verdictFor(inventory, path) && sidesOfPath(sides, path) !== null,
  );
  const section = report.section(`Unlisted paths both sides changed (${unlisted.length})`);
  if (unlisted.length === 0) return section.ok("none");
  section.info("No path-policy entry, so no rule above applies to these", [
    ...unlisted,
    "Inside a fork-owned concern each is `decide, then add an entry`; outside one,",
    "`theirs`. An entry now is what makes the next merge check them.",
  ]);
}

/**
 * A landed merge commit's sides, for pointing this at a merge that is already
 * in.
 */
function sidesOf(commit) {
  const [head, ...parents] = git(["rev-list", "--parents", "-n", "1", commit]).split(" ");
  if (parents.length !== 2) throw new Error(`${commit} is not a merge commit`);
  return { state: "committed", merged: head, ours: parents[0], theirs: parents[1] };
}

export function runResolutionCheck(report, commit = null) {
  const sides = commit ? sidesOf(commit) : mergeSides();
  if (sides === null) {
    report
      .section("Resolutions against both sides")
      .ok("no merge in progress and HEAD is not a merge commit — nothing to check");
    return;
  }

  // Pointed at a landed merge, the policy to judge it by is the one that merge
  // itself carried. Live, the working tree holds both the resolution and the
  // entry changes it came with, which is the pair that has to agree.
  const inventory = loadInventory(sides.state === "committed" && commit ? sides.merged : null);
  const base = mergeBase(sides.ours, sides.theirs);
  const { candidates, bothChanged } = candidatePaths(sides, base);

  checkDeltaDrift(inventory, report, sides, candidates);
  checkUpstreamDrift(inventory, report, sides, candidates);
  checkVerbatim(inventory, report, sides);
  reportUnlisted(inventory, report, sides, bothChanged);
}

runMain(async () => {
  const report = new Report();
  runResolutionCheck(report, process.argv[2] ?? null);
  report.print();
  if (report.failed) {
    process.stdout.write(
      `${bold("A resolution landed as one side whole.")} ` +
        `${dim("Either the delta was dropped, or the entry that claims it is stale — fix one.")}\n\n`,
    );
    return 1;
  }
  return 0;
});
