#!/usr/bin/env node
/**
 * The numbers step 2 of the merge procedure asks for, computed once instead of
 * by hand.
 *
 *   node .agents/skills/fork-upstream-merge/scripts/merge-stats.mjs
 *
 * Run it once the merge commit exists (conflicts resolved and committed) — it
 * reads everything from `HEAD`'s two parents, so there is nothing to capture
 * mid-merge. The three numbers the tracker entry template asks for come out
 * ready to paste: how much of upstream's range landed, how big the fork delta
 * is, and where the two might not match. A merge that only touched a fraction
 * of what upstream changed is usually an `ours` resolution that quietly threw
 * upstream's work away — the file-level gap listed here is what makes that
 * fast to confirm instead of re-deriving with a handful of separate `git diff`
 * calls.
 *
 * It also lists every file both sides touched since the merge-base, the same
 * set `preflight.mjs` forecasts before merging — restated here against what
 * actually landed, with each file's path-policy verdict, so the tracker's
 * conflict list does not have to be reconstructed from memory after the merge
 * markers are already gone.
 */
import { Report, bold, dim, git, lines, loadInventory, runMain, verdictFor } from "./lib.mjs";

function requireMergeCommit() {
  const hasSecondParent = git(["rev-parse", "--verify", "--quiet", "HEAD^2"], {
    allowFailure: true,
  });
  if (!hasSecondParent) {
    throw new Error(
      "HEAD is not a merge commit (no HEAD^2). Run this after `git merge upstream/main` " +
        "has been resolved and committed.",
    );
  }
  const hasThirdParent = git(["rev-parse", "--verify", "--quiet", "HEAD^3"], {
    allowFailure: true,
  });
  if (hasThirdParent) {
    throw new Error(
      "HEAD has more than two parents — this script assumes an ordinary two-way merge.",
    );
  }
}

function shortstat(a, b) {
  const raw = git(["diff", "--shortstat", a, b]);
  return raw.length > 0 ? raw : "0 files changed";
}

function nameOnly(a, b) {
  return new Set(lines(git(["diff", "--name-only", a, b])));
}

function reportRange(report) {
  const base = git(["merge-base", "HEAD^1", "HEAD^2"]);
  const upstreamHead = git(["rev-parse", "--short", "HEAD^2"]);
  const baseShort = git(["rev-parse", "--short", base]);
  const count = lines(git(["rev-list", "--no-merges", `${base}..HEAD^2`])).length;
  const section = report.section("Range");
  section.info(`Upstream: \`${upstreamHead}\` from base \`${baseShort}\` (\`${count}\` commits).`);
  return { base, upstreamHead, baseShort, count };
}

function reportLandedVsUpstream(report, base) {
  const section = report.section("Landed vs upstream range");
  const landed = nameOnly("HEAD^1", "HEAD");
  const upstreamRange = nameOnly(base, "HEAD^2");
  section.info(`Landed: \`${landed.size}\` files (\`git diff --stat HEAD^1 HEAD\`)`, [
    shortstat("HEAD^1", "HEAD"),
  ]);
  section.info(
    `Upstream range: \`${upstreamRange.size}\` files (\`git diff --stat ${base} HEAD^2\`)`,
    [shortstat(base, "HEAD^2")],
  );

  if (landed.size === upstreamRange.size && [...landed].every((path) => upstreamRange.has(path))) {
    section.ok("exact match — nothing landed that upstream didn't change, nothing dropped");
    return;
  }

  const onlyInLanded = [...landed].filter((path) => !upstreamRange.has(path)).sort();
  const onlyInUpstream = [...upstreamRange].filter((path) => !landed.has(path)).sort();
  section.warn(`gap of ${Math.abs(landed.size - upstreamRange.size)} file(s) — explain each side`, [
    ...(onlyInLanded.length > 0
      ? [`in landed, not in upstream range (${onlyInLanded.length}):`, ...onlyInLanded]
      : []),
    ...(onlyInUpstream.length > 0
      ? [`in upstream range, not in landed (${onlyInUpstream.length}):`, ...onlyInUpstream]
      : []),
  ]);
}

function reportForkDelta(report) {
  const section = report.section("Fork delta");
  const delta = nameOnly("HEAD^2", "HEAD");
  section.info(`\`${delta.size}\` files (\`git diff --stat HEAD^2 HEAD\`)`, [
    shortstat("HEAD^2", "HEAD"),
  ]);
}

function reportConflictCandidates(inventory, report, base) {
  const forkChanged = nameOnly(base, "HEAD^1");
  const upstreamChanged = nameOnly(base, "HEAD^2");
  const overlap = [...forkChanged].filter((path) => upstreamChanged.has(path)).sort();

  const section = report.section(
    `Conflict candidates (${overlap.length} files touched by both sides)`,
  );
  if (overlap.length === 0) return section.ok("no overlap");
  for (const path of overlap) {
    const match = verdictFor(inventory, path);
    section.info(
      `${path}${match ? dim(`  [${match.entry.verdict} — ${match.entry.id}]`) : dim("  [unlisted]")}`,
    );
  }
  section.info("Not every file here necessarily produced a `<<<<<<<` marker", [
    "git may have auto-merged one silently — check it by hand if the file is one",
    "a route, a search catalog, or anything else two unrelated additions could collide in.",
  ]);
}

runMain(async () => {
  requireMergeCommit();
  const inventory = loadInventory();

  const report = new Report();
  const { base } = reportRange(report);
  reportLandedVsUpstream(report, base);
  reportForkDelta(report);
  reportConflictCandidates(inventory, report, base);
  report.print();

  process.stdout.write(
    `${bold("Paste the Range/Landed/Fork delta lines into the tracker entry.")}\n\n`,
  );
  return 0;
});
