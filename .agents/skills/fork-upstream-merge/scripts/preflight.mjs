#!/usr/bin/env node
/**
 * Everything worth knowing BEFORE `git merge upstream/main`.
 *
 *   node .agents/skills/fork-upstream-merge/scripts/preflight.mjs
 *
 * Fetches upstream (un-shallowing first if the sandbox clone is shallow, which
 * otherwise reports an empty merge-base and silently turns the whole upstream
 * range into "new"), then reports the range, the stale inventory entries, and
 * the conflicts this merge is going to produce — each already carrying the path
 * policy verdict that resolves it.
 *
 * The forecast is the point. Conflict resolution is most of a merge's cost, and
 * it is far cheaper planned than discovered one `<<<<<<<` at a time.
 */
import {
  Report,
  allFilesInRef,
  bold,
  cyan,
  dim,
  ensureFullHistory,
  fetchUpstream,
  git,
  globToRegExp,
  lines,
  loadInventory,
  requireUpstreamRemote,
  runMain,
} from "./lib.mjs";
import { requireUpstream, runInventoryChecks } from "./inventory-check.mjs";

/**
 * The verdict for a path: the most specific matching entry wins, so a fork-only
 * file inside an otherwise-upstream directory keeps its own answer.
 */
function verdictFor(inventory, path) {
  let best = null;
  for (const entry of inventory.pathPolicy) {
    for (const pattern of entry.paths) {
      if (!globToRegExp(pattern).test(path)) continue;
      const score = (pattern.includes("*") ? 0 : 1000) + pattern.length;
      if (!best || score > best.score) best = { score, entry, pattern };
    }
  }
  return best;
}

function reportRange(report, base, ref) {
  const section = report.section("Range");
  const count = lines(git(["rev-list", "--no-merges", `${base}..${ref}`])).length;
  const upstreamHead = git(["rev-parse", "--short", ref]);
  section.info(`base ${git(["rev-parse", "--short", base])} -> ${ref} ${upstreamHead}`);
  section.info(`${count} non-merge upstream commits`);
  section.info(
    `${lines(git(["diff", "--name-only", base, ref])).length} files changed upstream, ` +
      `${lines(git(["diff", "--name-only", base, "HEAD"])).length} changed in the fork`,
  );
  return { count, upstreamHead };
}

/**
 * Files both sides touched. Git will not necessarily conflict on all of them,
 * but every real conflict is in here, and each one's verdict is known now.
 */
function reportForecast(inventory, report, base, ref) {
  const upstreamChanged = new Set(lines(git(["diff", "--name-only", base, ref])));
  const forkChanged = lines(git(["diff", "--name-only", base, "HEAD"]));
  const overlap = forkChanged.filter((path) => upstreamChanged.has(path)).sort();

  const section = report.section(`Conflict forecast (${overlap.length} files touched by both)`);
  if (overlap.length === 0) return section.ok("no overlap");

  const byVerdict = new Map();
  for (const path of overlap) {
    const match = verdictFor(inventory, path);
    const key = match ? match.entry.verdict : "unlisted";
    if (!byVerdict.has(key)) byVerdict.set(key, []);
    byVerdict.get(key).push({ path, entry: match?.entry });
  }

  // `decide` and unlisted files are the ones that need a human; lead with them.
  const order = ["decide", "unlisted", "converged", "theirs-verbatim", "theirs", "ours"];
  for (const verdict of order) {
    const group = byVerdict.get(verdict);
    if (!group) continue;
    const level = verdict === "decide" || verdict === "unlisted" ? "warn" : "info";
    section[level](
      `${verdict} — ${group.length} file(s)`,
      group.map(({ path, entry }) => `${path}${entry ? dim(`  [${entry.id}]`) : ""}`),
    );
  }
  if (byVerdict.has("unlisted")) {
    section.info("Unlisted files fall back to the concern rules", [
      `inside a fork-owned concern: ${inventory.fallback.insideConcern}`,
      `outside one: ${inventory.fallback.outsideConcern}`,
    ]);
  }
}

/**
 * Upstream deleting a file the fork changed is a modify/delete conflict, and
 * resolving it by taking upstream silently drops the fork delta with no marker
 * left behind. Worth its own section.
 */
function reportDeletesAndRenames(report, base, ref) {
  const section = report.section("Upstream deletions and renames");
  const deleted = lines(git(["diff", "--diff-filter=D", "--name-only", base, ref]));
  const forkChanged = new Set(lines(git(["diff", "--name-only", base, "HEAD"])));
  const dangerous = deleted.filter((path) => forkChanged.has(path));

  if (dangerous.length > 0) {
    section.warn(`${dangerous.length} file(s) deleted upstream that the fork also changed`, [
      ...dangerous,
      "Modify/delete conflicts. Taking upstream drops the fork delta with no marker.",
    ]);
  } else {
    section.ok("no modify/delete conflicts");
  }

  const renames = lines(
    git(["diff", "-M", "--diff-filter=R", "--name-status", base, ref], { allowFailure: true }),
  );
  if (renames.length > 0) section.info(`${renames.length} rename(s) detected`, renames);
  if (deleted.length > 0) {
    section.info(`${deleted.length} upstream deletion(s) in total`, [
      "Git cannot see a content swap (delete + unrelated modify) as a rename;",
      "the inventory liveness check above is what catches those.",
    ]);
  }
}

/** New upstream files in fork-owned concerns, and new workflows that arrive enabled. */
function reportNewFiles(inventory, report, base, ref) {
  const inBase = new Set(allFilesInRef(base));
  const added = allFilesInRef(ref).filter((path) => !inBase.has(path));

  const sweep = report.section("Owned-concern sweep (new upstream files)");
  const pattern = new RegExp(inventory.sweep.pattern, "i");
  const excluded = (path) => inventory.sweep.exclude.some((prefix) => path.startsWith(prefix));
  const hits = added.filter((path) => pattern.test(path) && !excluded(path));
  if (hits.length === 0) sweep.ok("no keyword hits");
  else
    sweep.warn(`${hits.length} new file(s) match the concern pattern`, [
      ...hits,
      "Decide each against the fork-owned concerns; most are false positives.",
      "Record the decision in the tracker either way.",
    ]);

  const workflows = added.filter((path) => path.startsWith(".github/workflows/"));
  const section = report.section("New upstream workflows");
  if (workflows.length === 0) section.ok("none");
  else
    section.warn(`${workflows.length} new workflow(s) will arrive enabled`, [
      ...workflows,
      "Disable each after the merge lands:",
      ...workflows.map(
        (path) => `  gh workflow disable ${path.split("/").pop()} --repo soaplabs/t3code`,
      ),
    ]);
}

runMain(async () => {
  const inventory = loadInventory();

  // Checked before the un-shallow below, which is a large fetch to spend on a
  // clone that was never going to be able to reach upstream.
  requireUpstreamRemote(inventory);

  if (ensureFullHistory()) {
    process.stdout.write(dim("un-shallowed the clone so merge-base is meaningful\n"));
  }
  fetchUpstream(inventory);
  const ref = requireUpstream(inventory);
  const base = git(["merge-base", "HEAD", ref]);

  const report = new Report();
  const { count } = reportRange(report, base, ref);
  runInventoryChecks(inventory, report, ref);
  reportForecast(inventory, report, base, ref);
  reportDeletesAndRenames(report, base, ref);
  reportNewFiles(inventory, report, base, ref);
  report.print();

  if (report.failed) {
    process.stdout.write(
      `${bold("Fix the stale inventory entries before merging.")} They are what the merge resolves against.\n\n`,
    );
    return 1;
  }
  process.stdout.write(
    `${cyan("Ready.")} ${count} commits to merge. Next:\n` +
      `  UPSTREAM_BASE=${base}\n` +
      `  git merge ${ref}\n\n`,
  );
  return 0;
});
