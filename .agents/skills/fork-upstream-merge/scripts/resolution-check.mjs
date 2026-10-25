#!/usr/bin/env node
/**
 * Resolutions that silently reverted to one side.
 *
 *   node .agents/skills/fork-upstream-merge/scripts/resolution-check.mjs [merge-sha]
 *
 * Compares upstream-owned paths against both parents; whole-file only, so a partly lost delta
 * passes (`guard.symbol` is finer). Skips `ours` paths; the `// Fork:` census is never enforced.
 */
import * as NodeChildProcess from "node:child_process";
import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
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
 * Missing on either parent is an addition or deletion (`tripwires.mjs` owns it). `ours == theirs`
 * means nothing to decide; without that guard converged paths fire forever (`inventory-check.mjs`).
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
 * `converged` fails outright: plain upstream means the delta is gone. `decide` only warns, and
 * only when the fork side had a `// Fork:` marker, since most files in a glob were never touched.
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
 * Whether upstream's change to `path` is already in the fork's copy: a
 * three-way merge of it onto `ours` is clean and changes nothing. That is
 * convergence, where upstream made an edit the fork had already made, rather
 * than an upstream change the resolution dropped.
 */
function upstreamChangeAlreadyCarried(base, sides, path, ours) {
  const baseBlob = blobLines(base, path);
  const theirs = blobLines(sides.theirs, path);
  if (baseBlob === null || theirs === null) return false;
  const dir = NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "resolution-check-"));
  try {
    for (const [name, content] of Object.entries({ ours, base: baseBlob, theirs })) {
      NodeFS.writeFileSync(NodePath.join(dir, name), content.join("\n"));
    }
    const result = NodeChildProcess.spawnSync(
      "git",
      ["merge-file", "-p", "--quiet", "ours", "base", "theirs"],
      { cwd: dir, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
    );
    return result.status === 0 && result.stdout === ours.join("\n");
  } finally {
    NodeFS.rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * Landed as the fork's own pre-merge content, where upstream had moved on.
 *
 * The merged tree equalling `ours` on a path upstream changed means upstream's
 * change is simply not in. For `decide` that can be deliberate; everywhere else
 * the verdict says upstream's version is the base to start from.
 */
function checkUpstreamDrift(inventory, report, sides, paths, base) {
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
    if (upstreamChangeAlreadyCarried(base, sides, path, blobs.ours)) {
      section.info(`${path}: upstream's change was already in the fork's copy [${match.entry.id}]`);
      continue;
    }

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
 * A standing invariant, so it scans every tracked path of that verdict. Never plain `theirs`:
 * `pnpm-lock.yaml` differs forever and would make this red on every merge.
 */
/**
 * The upstream commit to hold a `theirs-verbatim` path against.
 *
 * `sides.theirs` is upstream only in an upstream merge; otherwise use the newest upstream commit
 * the fork side contains. Returns null with no upstream ref, skipping the rule.
 */
function upstreamReference(inventory, sides) {
  const ref = inventory.upstream.ref;
  if (!git(["rev-parse", "--verify", "--quiet", ref], { allowFailure: true })) return null;
  if (isUpstreamMerge(inventory, sides)) return git(["rev-parse", sides.theirs]);

  // Not an upstream merge: use the newest upstream commit the merge RESULT carries. From `ours`
  // alone, files a newer upstream touched would be reported as drifted.
  if (sides.state === "committed") return mergeBase(sides.merged, ref);
  const fromOurs = mergeBase(sides.ours, ref);
  const fromTheirs = mergeBase(sides.theirs, ref);
  return mergeBase(fromOurs, fromTheirs) === fromOurs ? fromTheirs : fromOurs;
}

/**
 * Whether the merge being checked is an upstream merge at all.
 *
 * Rules 1 and 2 read `theirs` as upstream. In a fork-branch merge they are meaningless, so they
 * are skipped, not reported.
 */
function isUpstreamMerge(inventory, sides) {
  const ref = inventory.upstream.ref;
  if (!git(["rev-parse", "--verify", "--quiet", ref], { allowFailure: true })) return false;
  // `theirs` is an upstream commit exactly when it is its own merge-base with
  // the upstream ref — that is, when upstream already contains it.
  const theirs = git(["rev-parse", sides.theirs]);
  return mergeBase(theirs, ref) === theirs;
}

function checkVerbatim(inventory, report, sides) {
  const section = report.section("theirs-verbatim paths, against upstream");
  const upstream = upstreamReference(inventory, sides);
  if (upstream === null) return section.info("no upstream ref to compare against");
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
      const theirs = blobLines(upstream, path);
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

  if (isUpstreamMerge(inventory, sides)) {
    checkDeltaDrift(inventory, report, sides, candidates);
    checkUpstreamDrift(inventory, report, sides, candidates, base);
  } else {
    report
      .section("Resolutions against both sides")
      .ok(`not an upstream merge — ${sides.theirs} is not in ${inventory.upstream.ref}`);
  }
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
