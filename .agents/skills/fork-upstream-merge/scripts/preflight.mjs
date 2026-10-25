#!/usr/bin/env node
/**
 * Everything worth knowing BEFORE `git merge upstream/main`.
 *
 *   node .agents/skills/fork-upstream-merge/scripts/preflight.mjs
 *
 * Fetches upstream (un-shallowing first, or merge-base is empty), then reports the range, stale
 * inventory entries, and forecast conflicts with their path-policy verdicts.
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
  lines,
  loadInventory,
  predictConflicts,
  requireUpstreamRemote,
  runMain,
  verdictFor,
} from "./lib.mjs";
import { requireUpstream, runInventoryChecks } from "./inventory-check.mjs";

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

/** One line per file: the path, and the inventory entry that answers it. */
function describe(inventory, paths) {
  return paths.map((path) => {
    const entry = verdictFor(inventory, path)?.entry;
    const verdict = entry ? entry.verdict : "unlisted";
    return `${path}  ${dim(`[${verdict}${entry ? ` — ${entry.id}` : ""}]`)}`;
  });
}

function groupByVerdict(inventory, paths) {
  const byVerdict = new Map();
  for (const path of paths) {
    const match = verdictFor(inventory, path);
    const key = match ? match.entry.verdict : "unlisted";
    if (!byVerdict.has(key)) byVerdict.set(key, []);
    byVerdict.get(key).push({ path, entry: match?.entry });
  }
  return byVerdict;
}

/**
 * The plan for the merge: files git will stop on, and files it resolves itself.
 *
 * All-files-touched over-reports about 5x; `merge-tree` gives the real conflict set, the second
 * list is the "read these anyway" set. Do not conflate them.
 */
function forecast(base, ref) {
  const upstreamChanged = new Set(lines(git(["diff", "--name-only", base, ref])));
  const forkChanged = lines(git(["diff", "--name-only", base, "HEAD"]));
  const overlap = forkChanged.filter((path) => upstreamChanged.has(path)).sort();

  const predicted = predictConflicts("HEAD", ref);
  const conflicts = predicted === null ? null : predicted.filter(Boolean).sort();
  return { overlap, conflicts };
}

function reportForecast(inventory, report, base, ref) {
  const { overlap, conflicts } = forecast(base, ref);

  const section = report.section(
    conflicts === null
      ? `Conflict forecast (${overlap.length} files touched by both)`
      : `Conflicts (${conflicts.length} of ${overlap.length} files touched by both)`,
  );

  if (conflicts === null) {
    section.info("git could not pre-merge; falling back to every file both sides touched", [
      "The list below is a superset of the real conflicts, never a subset.",
    ]);
  } else if (conflicts.length === 0) {
    section.ok("git resolves this merge without stopping");
  } else {
    // These are the files the merge will actually put in front of a human.
    section.warn(
      `${conflicts.length} file(s) will conflict — resolve each by its verdict`,
      describe(inventory, conflicts),
    );
  }

  const listed = conflicts ?? overlap;
  const byVerdict = groupByVerdict(inventory, listed);
  if (conflicts === null) {
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
  }

  if (byVerdict.has("unlisted")) {
    section.info("Unlisted files fall back to the concern rules", [
      `inside a fork-owned concern: ${inventory.fallback.insideConcern}`,
      `outside one: ${inventory.fallback.outsideConcern}`,
    ]);
  }

  if (conflicts === null) return;

  // Auto-merged does not mean correct: two unrelated additions to the same list
  // merge clean and can still be wrong, which is what `duplicate-adds.mjs`
  // catches after the merge. Naming them here is what makes that check's
  // findings expected rather than a surprise.
  const quiet = overlap.filter((path) => !conflicts.includes(path));
  const quietSection = report.section(`Auto-merged, worth a look (${quiet.length} files)`);
  if (quiet.length === 0) return quietSection.ok("none");
  quietSection.info("Git resolves these silently — a wrong resolution leaves no marker", [
    ...describe(inventory, quiet),
    "After merging, `duplicate-adds.mjs` checks these for lines both sides added twice.",
  ]);
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

/**
 * The forecast as data, grouped by concern.
 *
 * A concern is the unit resolvable independently; one can span files whose edits depend on each
 * other (a removed re-export breaks another), so splitting by file splits one decision.
 */
function forecastJson(inventory, base, ref, upstreamHead, count) {
  const { overlap, conflicts } = forecast(base, ref);
  const entryOf = (path) => {
    const entry = verdictFor(inventory, path)?.entry;
    return { path, verdict: entry?.verdict ?? "unlisted", id: entry?.id ?? null };
  };

  const byConcern = new Map();
  for (const item of (conflicts ?? overlap).map(entryOf)) {
    const key = item.id ?? "unlisted";
    if (!byConcern.has(key)) {
      byConcern.set(key, { id: item.id, verdict: item.verdict, paths: [] });
    }
    byConcern.get(key).paths.push(item.path);
  }

  return {
    upstream: { head: upstreamHead, base, commits: count },
    // False when git could not pre-merge. `conflicts` is then the whole overlap
    // rather than the real conflict set, and `autoMerged` is not knowable — it
    // stays empty rather than repeating the same paths under a name that claims
    // git resolved them.
    predicted: conflicts !== null,
    conflicts: (conflicts ?? overlap).map(entryOf),
    concerns: [...byConcern.values()],
    autoMerged:
      conflicts === null ? [] : overlap.filter((path) => !conflicts.includes(path)).map(entryOf),
  };
}

runMain(async () => {
  const inventory = loadInventory();
  const asJson = process.argv.includes("--json");

  // Checked before the un-shallow below, which is a large fetch to spend on a
  // clone that was never going to be able to reach upstream.
  requireUpstreamRemote(inventory);

  if (ensureFullHistory() && !asJson) {
    process.stdout.write(dim("un-shallowed the clone so merge-base is meaningful\n"));
  }
  fetchUpstream(inventory);
  const ref = requireUpstream(inventory);
  const base = git(["merge-base", "HEAD", ref]);

  if (asJson) {
    const upstreamHead = git(["rev-parse", "--short", ref]);
    const count = lines(git(["rev-list", "--no-merges", `${base}..${ref}`])).length;

    // The staleness gate applies here too. A verdict read off an entry whose
    // path upstream has renamed away is a wrong answer delivered confidently,
    // and this output exists to be handed to someone who will act on it — so
    // it says so in the payload and still exits non-zero.
    const staleReport = new Report();
    runInventoryChecks(inventory, staleReport, ref);
    const forecast = forecastJson(inventory, base, ref, upstreamHead, count);
    forecast.inventoryStale = staleReport.failed;
    process.stdout.write(`${JSON.stringify(forecast, null, 2)}\n`);
    if (staleReport.failed) {
      process.stderr.write(
        "inventory entries are stale; re-run without --json for the list.\n" +
          "Fix them before merging — they are what the merge resolves against.\n",
      );
      return 1;
    }
    return 0;
  }

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
    `${cyan("Ready.")} ${count} commits to merge. Next:\n  git merge ${ref}\n\n`,
  );
  return 0;
});
