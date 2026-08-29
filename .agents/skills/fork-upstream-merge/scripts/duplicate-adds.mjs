#!/usr/bin/env node
/**
 * Lines both sides added that the merge took twice.
 *
 *   node .agents/skills/fork-upstream-merge/scripts/duplicate-adds.mjs
 *   node .agents/skills/fork-upstream-merge/scripts/duplicate-adds.mjs 29ec3ec02
 *
 * The failure this exists for is a clean merge that is wrong. When the fork and
 * upstream both append the same line to the same list at different offsets —
 * the same import, the same const, the same entry in a catalog — git resolves it
 * without a `<<<<<<<` marker and keeps both copies. Nothing in the merge reports
 * it. In the 2026-08-29 merge that was `OrchestrationMessage` and
 * `decodeOrchestrationMessage` in `packages/contracts/src/orchestration.test.ts`,
 * and it cost a full verify pass — 146s of typecheck and 565s of tests — to
 * learn about as a parse error.
 *
 * The rule is narrow on purpose: a line that appears **exactly once on each
 * side and twice in the merge**. The looser reading — any line more frequent in
 * the merge than in either parent — reports 37 hits on that same merge, almost
 * all of them `});` and `}`, and a check nobody can read is a check nobody runs.
 * With the narrow rule the same merge gives 2 hits and both are the defect.
 *
 * It cannot catch a duplicate of a line that already appeared elsewhere in the
 * file; the trade is deliberate. This is a tripwire, not a proof.
 */
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";

import {
  REPO_ROOT,
  Report,
  blobLines,
  bold,
  dim,
  git,
  lines,
  mergeBase,
  mergeSides,
  runMain,
} from "./lib.mjs";

/** Lines by frequency, whitespace-normalized and ignoring blanks. */
function counts(content) {
  const tally = new Map();
  if (content === null) return null;
  for (const line of content) {
    const key = line.trim();
    if (key === "") continue;
    tally.set(key, (tally.get(key) ?? 0) + 1);
  }
  return tally;
}

/**
 * The merged content: the working tree mid-merge, the merge commit's own blob
 * once it is committed. Reading the working tree is what lets this run before
 * the commit, while a fix is still just an edit.
 */
function mergedLines(sides, path) {
  if (sides.state === "committed") return blobLines(sides.merged, path);
  const absolute = NodePath.resolve(REPO_ROOT, path);
  if (!NodeFS.existsSync(absolute)) return null;
  return NodeFS.readFileSync(absolute, "utf8").split("\n");
}

function findDuplicates(sides, paths) {
  const found = [];
  for (const path of paths) {
    const merged = counts(mergedLines(sides, path));
    const ours = counts(blobLines(sides.ours, path));
    const theirs = counts(blobLines(sides.theirs, path));
    if (!merged || !ours || !theirs) continue;
    for (const [line, seen] of merged) {
      if (seen === 2 && ours.get(line) === 1 && theirs.get(line) === 1) {
        found.push({ path, line });
      }
    }
  }
  return found;
}

/**
 * A landed merge commit's sides, for pointing this at a merge that is already
 * in — which is how the rule was calibrated, and how a future change to it can
 * be checked against a merge whose answer is known.
 */
function sidesOf(commit) {
  const [head, ...parents] = git(["rev-list", "--parents", "-n", "1", commit]).split(" ");
  if (parents.length !== 2) throw new Error(`${commit} is not a merge commit`);
  return { state: "committed", merged: head, ours: parents[0], theirs: parents[1] };
}

export function runDuplicateAddsCheck(report, commit = null) {
  const section = report.section("Lines both sides added, taken twice");
  const sides = commit ? sidesOf(commit) : mergeSides();
  if (sides === null) {
    section.ok("no merge in progress and HEAD is not a merge commit — nothing to check");
    return;
  }

  const base = mergeBase(sides.ours, sides.theirs);
  const upstreamChanged = new Set(lines(git(["diff", "--name-only", base, sides.theirs])));
  const bothChanged = lines(git(["diff", "--name-only", base, sides.ours])).filter((path) =>
    upstreamChanged.has(path),
  );

  // A file still carrying conflict markers holds both sides' text at once, so
  // every line either side added looks duplicated. Those are the files a human
  // is about to resolve by hand anyway; the ones worth reporting are the ones
  // git already resolved silently.
  const unresolved = new Set(lines(git(["diff", "--name-only", "--diff-filter=U"])));
  const both = bothChanged.filter((path) => !unresolved.has(path));

  const duplicates = findDuplicates(sides, both);
  const scanned =
    `${both.length} file(s) both sides changed` +
    (unresolved.size > 0 ? `, ${unresolved.size} still unresolved and skipped` : "");
  if (duplicates.length === 0) {
    section.ok(`none across ${scanned}`);
    if (unresolved.size > 0) {
      section.info("Re-run once the conflicts are resolved", [...unresolved]);
    }
    return;
  }

  const byPath = new Map();
  for (const { path, line } of duplicates) {
    if (!byPath.has(path)) byPath.set(path, []);
    byPath.get(path).push(line.length > 78 ? `${line.slice(0, 78)}…` : line);
  }
  section.fail(`${duplicates.length} duplicated line(s) across ${scanned}`, [
    ...[...byPath].flatMap(([path, hits]) => [path, ...hits.map((hit) => `    ${hit}`)]),
    "Each was added by both sides and kept twice. Git reported no conflict for",
    "these, so nothing else in the merge will mention them. Delete one copy.",
  ]);
}

runMain(async () => {
  const report = new Report();
  runDuplicateAddsCheck(report, process.argv[2] ?? null);
  report.print();
  if (report.failed) {
    process.stdout.write(
      `${bold("Remove the duplicates before verifying.")} ` +
        `${dim("They surface as parse errors in lint, typecheck and test at once.")}\n\n`,
    );
    return 1;
  }
  return 0;
});
