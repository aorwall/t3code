#!/usr/bin/env node
/**
 * Deleted-surface tripwires, the deletion check, and the off-repository state
 * that a merge cannot see because it lives in GitHub rather than in the tree.
 *
 * Run after a merge, before writing the tracker entry:
 *   node .agents/skills/fork-upstream-merge/scripts/tripwires.mjs
 *
 * A `removed` surface must return no matches. A `decided-not-removed` surface
 * has known matches and reports its count, which is the number the tracker
 * entry quotes — the point is to hold it steady, not at zero, so a count that
 * moves is the finding.
 */
import {
  Report,
  filesInRef,
  filesInWorkingTree,
  git,
  lines,
  loadInventory,
  refExists,
  runMain,
  sh,
} from "./lib.mjs";

function checkTripwires(inventory, report) {
  const section = report.section("Deleted surfaces");
  for (const tripwire of inventory.tripwires) {
    const matches = lines(git(tripwire.args, { allowFailure: true }));
    const label = `${tripwire.name} (${tripwire.status})`;
    if (tripwire.expect === "no-matches" && matches.length > 0) {
      section.fail(`${label}: ${matches.length} match(es), expected none`, matches.slice(0, 10));
      continue;
    }
    if (tripwire.expect === "matches" && matches.length === 0) {
      section.warn(`${label}: no matches left`, [
        "The surface looks removed. Flip status to `removed` and expect to `no-matches`.",
      ]);
      continue;
    }
    section.ok(`${label}: ${matches.length} ${tripwire.unit ?? "match(es)"}`);
  }
}

/**
 * Taking upstream on a delete/modify conflict silently restores a file the fork
 * decided out, and nothing else in the merge notices.
 *
 * Both halves are measured against the merge base rather than upstream's head.
 * `upstream/main` moves on between merges, so diffing the two trees reports
 * every file upstream has added since as a deletion by this fork — noise that
 * grows with every day the branch is open, and that buries the one line here
 * that matters. Between the base and HEAD there is only this fork's own work.
 */
function checkDeletions(inventory, report, base) {
  const section = report.section("Upstream paths the fork deletes");
  const expected = new Set(inventory.deletedUpstreamPaths.paths);

  // "Still deleted" is a question about the tree, not about a diff: a path
  // upstream added after the base is in no diff but would still be a finding.
  const restored = [...expected].filter((path) => filesInWorkingTree([path]).length > 0);

  const deletedHere = base
    ? lines(git(["diff", "--diff-filter=D", "--name-only", base, "HEAD"], { allowFailure: true }))
    : [];
  const unexpected = deletedHere.filter((path) => !expected.has(path));

  if (restored.length > 0) {
    section.fail(`${restored.length} decided-out path(s) are back in the tree`, restored);
  }
  if (unexpected.length > 0) {
    section.fail(`${unexpected.length} upstream path(s) deleted without an entry`, [
      ...unexpected,
      "Either restore them or add them to deletedUpstreamPaths in docs/fork/inventory.json.",
    ]);
  }
  if (restored.length === 0 && unexpected.length === 0) {
    section.ok(`exactly the ${expected.size} known deletions`);
  }
}

/**
 * Workflows are switched off in GitHub, not in the tree, so a clone carries no
 * record of it and a merge cannot check it. A workflow upstream adds arrives
 * enabled, which makes this the check that fails after a merge rather than
 * before one.
 */
function checkOffRepo(inventory, report, base, ref) {
  const section = report.section("Off-repository state (GitHub)");
  const { allowedActiveWorkflows, workflowsApi } = inventory.offRepo;

  if (base && refExists(ref)) {
    const added = filesInRef(ref, [".github/workflows/**"]).filter(
      (path) => filesInRef(base, [path]).length === 0,
    );
    for (const path of added) {
      section.warn(`upstream adds ${path}`, [
        "It arrives active once this merge lands. Disable it and record it in the tracker:",
        `  gh workflow disable ${path.split("/").pop()} --repo soaplabs/t3code`,
      ]);
    }
  }

  let raw;
  for (const cmd of [["moat", "gh"], ["gh"]]) {
    raw = sh(
      cmd[0],
      [
        ...cmd.slice(1),
        "api",
        workflowsApi,
        "--jq",
        '.workflows[] | select(.state == "active") | .path',
      ],
      {
        allowFailure: true,
      },
    );
    if (raw) break;
  }
  if (!raw) {
    return section.warn("could not read workflow state from GitHub", [
      "Needs an authenticated `gh`. Check by hand:",
      `  gh api ${workflowsApi} --jq '.workflows[] | select(.state == "active") | .path'`,
      `Allowed: ${allowedActiveWorkflows.join(", ")}`,
    ]);
  }

  const active = lines(raw);
  const unexpected = active.filter((path) => !allowedActiveWorkflows.includes(path));
  if (unexpected.length > 0) {
    section.fail(`${unexpected.length} inherited workflow(s) are active again`, [
      ...unexpected,
      "Disable each: gh workflow disable <name> --repo soaplabs/t3code",
    ]);
  } else {
    section.ok(`${active.length} active workflow(s), all allowed`);
  }
}

runMain(async () => {
  const inventory = loadInventory();
  const ref = inventory.upstream.ref;
  if (!refExists(ref)) throw new Error(`${ref} is not available. Run: git fetch upstream`);

  const base = git(["merge-base", "HEAD", ref], { allowFailure: true }) || null;

  const report = new Report();
  checkTripwires(inventory, report);
  checkDeletions(inventory, report, base);
  checkOffRepo(inventory, report, base, ref);
  report.print();

  if (report.failed) {
    process.stdout.write("Tripwires found something that needs a decision.\n\n");
    return 1;
  }
  return 0;
});
