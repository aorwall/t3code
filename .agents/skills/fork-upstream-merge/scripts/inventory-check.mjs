#!/usr/bin/env node
/**
 * Checks every path in docs/fork/inventory.json against upstream/main and the
 * working tree, and reports the entries that have gone stale.
 *
 * This is the check that catches the expensive kind of merge surprise: a fork
 * delta whose anchor upstream has renamed, deleted, or started shipping itself.
 * The 2026-08-08 merge found `SidebarV2.tsx` deleted upstream only by hitting a
 * modify/delete conflict mid-merge, because git cannot see that swap as a
 * rename (upstream moved SidebarV2's content into Sidebar.tsx and Sidebar.tsx's
 * into LegacySidebar.tsx — a delete paired with a modify, which no `-M`
 * threshold detects). Reading the inventory's own paths back out of upstream
 * finds it in a second, before the merge starts.
 *
 * It also enforces the rule the path policy states in prose: an entry may be
 * `ours` only if the path does not exist in upstream/main.
 *
 *   node .agents/skills/fork-upstream-merge/scripts/inventory-check.mjs
 */
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";

import {
  REPO_ROOT,
  Report,
  filesInRef,
  filesInWorkingTree,
  loadInventory,
  refExists,
  runMain,
} from "./lib.mjs";

/** Verdicts whose paths upstream is expected to own. */
const UPSTREAM_OWNED = new Set(["decide", "converged", "theirs", "theirs-verbatim"]);

function checkPathPolicy(inventory, report, ref) {
  const section = report.section("Path policy vs upstream");
  for (const entry of inventory.pathPolicy) {
    for (const path of entry.paths) {
      const upstreamHits = filesInRef(ref, [path]).length;
      const localHits = filesInWorkingTree([path]).length;

      if (entry.verdict === "ours" && upstreamHits > 0) {
        section.fail(`${entry.id}: \`ours\` path is now shipped by upstream — ${path}`, [
          `upstream/main has ${upstreamHits} file(s) here; \`ours\` would discard them.`,
          "Split the entry, or change the verdict to decide/converged.",
        ]);
        continue;
      }
      if (UPSTREAM_OWNED.has(entry.verdict) && upstreamHits === 0) {
        section.fail(`${entry.id}: upstream no longer has ${path} (${entry.verdict})`, [
          localHits > 0
            ? "The fork still has it, so upstream renamed or deleted it out from under the delta."
            : "Gone from both sides — the entry is dead and should be removed.",
          "Find where upstream moved the behavior and re-home the delta before merging.",
        ]);
        continue;
      }
      if (localHits === 0 && upstreamHits === 0) {
        section.fail(`${entry.id}: ${path} exists on neither side`, ["Stale entry — remove it."]);
        continue;
      }
      if (localHits === 0) {
        section.warn(`${entry.id}: ${path} is absent from the fork's tree`, [
          "Expected when the fork deliberately deletes an upstream path; otherwise stale.",
        ]);
        continue;
      }
      section.ok(`${entry.id}: ${path} (${entry.verdict})`);
    }
  }
}

function checkInventoryPaths(inventory, report) {
  const section = report.section("Fork inventory vs working tree");
  for (const entry of inventory.inventory) {
    const dead = entry.paths.filter((path) => filesInWorkingTree([path]).length === 0);
    if (dead.length === 0) {
      section.ok(`${entry.id}: ${entry.paths.length} path(s) live`);
      continue;
    }
    section.fail(`${entry.id}: ${dead.length} path(s) no longer exist`, [
      ...dead,
      "The behavior this entry protects has moved. Re-point the entry in the same merge.",
    ]);
  }
}

/**
 * A gate that a merge can silently drop is worth naming a file and a symbol for.
 * Grepping for it here fails the check the moment an upstream rewrite takes the
 * gate with it, rather than at review time.
 */
function checkGuards(inventory, report) {
  const section = report.section("Delta guards");
  const guarded = inventory.inventory.filter((entry) => entry.guard);
  if (guarded.length === 0) return section.info("no guards declared");
  for (const entry of guarded) {
    const { symbol, files } = entry.guard;
    for (const file of files) {
      if (filesInWorkingTree([file]).length === 0) {
        section.fail(`${entry.id}: guarded file is gone — ${file}`, [
          "Upstream renamed or deleted it; the gate needs a new home.",
        ]);
        continue;
      }
      const source = NodeFS.readFileSync(NodePath.resolve(REPO_ROOT, file), "utf8");
      if (source.includes(symbol)) section.ok(`${entry.id}: ${symbol} present in ${file}`);
      else section.fail(`${entry.id}: ${symbol} MISSING from ${file}`, [entry.mustSurvive]);
    }
  }
}

function checkDeletedPaths(inventory, report, ref) {
  const section = report.section("Upstream paths the fork deletes");
  for (const path of inventory.deletedUpstreamPaths.paths) {
    const upstreamHas = filesInRef(ref, [path]).length > 0;
    const localHas = filesInWorkingTree([path]).length > 0;
    if (!upstreamHas) {
      section.warn(`${path}: upstream dropped it too`, [
        "Nothing left to re-delete; remove it from deletedUpstreamPaths.",
      ]);
    } else if (localHas) {
      section.fail(`${path}: restored in the fork`, [
        "Taking upstream on a delete/modify conflict silently brings these back.",
      ]);
    } else {
      section.ok(`${path}: still deleted`);
    }
  }
}

/** Exported so `preflight.mjs` runs the same checks inside its own report. */
export function runInventoryChecks(inventory, report, ref) {
  checkPathPolicy(inventory, report, ref);
  checkInventoryPaths(inventory, report);
  checkGuards(inventory, report);
  checkDeletedPaths(inventory, report, ref);
}

export function requireUpstream(inventory) {
  const ref = inventory.upstream.ref;
  if (!refExists(ref)) {
    throw new Error(
      `${ref} is not available. Run:\n` +
        `  git remote add upstream ${inventory.upstream.url}\n` +
        `  git fetch upstream`,
    );
  }
  return ref;
}

// Only run the report when invoked directly, not when preflight imports it.
if (NodePath.resolve(process.argv[1] ?? "") === NodeURL.fileURLToPath(import.meta.url)) {
  runMain(async () => {
    const inventory = loadInventory();
    const report = new Report();
    runInventoryChecks(inventory, report, requireUpstream(inventory));
    report.print();

    if (report.failed) {
      process.stdout.write(
        "Inventory is stale. Fix the entries above (in docs/fork/inventory.json) before merging.\n\n",
      );
      return 1;
    }
    process.stdout.write("Inventory matches upstream and the working tree.\n\n");
    return 0;
  });
}
