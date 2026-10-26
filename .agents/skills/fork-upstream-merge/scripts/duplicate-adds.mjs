#!/usr/bin/env node
/**
 * Lines both sides added that the merge took twice.
 *
 *   node .agents/skills/fork-upstream-merge/scripts/duplicate-adds.mjs [merge-sha]
 *
 * Flags a name-bearing line once on each side and twice in the merge; looser rules drown in `});`.
 * Unseeable collisions go in `duplicateAddExceptions` (docs/fork/inventory.json).
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
  loadInventory,
  mergeBase,
  mergeSides,
  runMain,
} from "./lib.mjs";

/**
 * Lines that could name something, by frequency, whitespace-normalized.
 *
 * Skips pure punctuation and bare JSX attributes (`size="sm"`): unrelated blocks share them by
 * design and would pass "once each side, twice in the merge". A real duplicate attribute is
 * already a lint/typecheck error.
 */
const BARE_JSX_ATTRIBUTE = /^[A-Za-z_][\w:.-]*=(?:"[^"]*"|'[^']*'|\{[^{}]*\})$/;

/**
 * Normalized line to its raw lines, in file order. Raw text is kept because indentation shows
 * where a copy came from.
 */
function occurrences(content) {
  const tally = new Map();
  if (content === null) return null;
  for (const line of content) {
    const key = line.trim();
    if (key === "" || !/\w/.test(key)) continue;
    if (BARE_JSX_ATTRIBUTE.test(key)) continue;
    if (!tally.has(key)) tally.set(key, []);
    tally.get(key).push(line);
  }
  return tally;
}

const at = (tally, key) => tally.get(key) ?? [];

/**
 * True when every copy in the merge is text a parent actually had.
 *
 * A copy matching no parent line verbatim was written by the resolution, not kept twice
 * (`if (` at two indents in auth.ts looked like one line taken twice once trimmed).
 */
function everyCopyCameFromAParent(merged, ours, theirs) {
  const parents = new Set([...ours, ...theirs]);
  return merged.every((raw) => parents.has(raw));
}

/** A statement that only calls something: no `import`, no binding, no assignment. */
const CALL_STATEMENT = /^(?:await\s+)?[A-Za-z_$][\w$.]*\(/;
const BINDS_A_NAME =
  /^(?:import|export|const|let|var|function|class|type|interface|enum|case|return|throw)\b/;
const ASSIGNS = /[^=!<>]=(?![=>])/;

/**
 * True when the line's recurrence is ordinary rather than evidence.
 *
 * Bare calls like `expect(x).toEqual([]);` bind no name, so a repeat is a warning, not red.
 * Red must keep meaning "delete one copy": imports, consts and catalog entries bind names.
 */
function isWeakEvidence(line) {
  if (!line.endsWith(";")) return false;
  if (BINDS_A_NAME.test(line)) return false;
  if (ASSIGNS.test(line)) return false;
  return CALL_STATEMENT.test(line);
}

/**
 * Generated files nobody resolves by hand.
 *
 * `pnpm-lock.yaml` is rewritten by `vp i`, and repeats a dependency line per declaring
 * package, so its repeats are output rather than resolution.
 */
const GENERATED = new Set(["pnpm-lock.yaml"]);

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
    const merged = occurrences(mergedLines(sides, path));
    const ours = occurrences(blobLines(sides.ours, path));
    const theirs = occurrences(blobLines(sides.theirs, path));
    if (!merged || !ours || !theirs) continue;
    for (const [line, copies] of merged) {
      if (copies.length !== 2) continue;
      if (at(ours, line).length !== 1 || at(theirs, line).length !== 1) continue;
      if (!everyCopyCameFromAParent(copies, at(ours, line), at(theirs, line))) continue;
      found.push({ path, line, weak: isWeakEvidence(line) });
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
  const both = bothChanged.filter((path) => !unresolved.has(path) && !GENERATED.has(path));

  const hits = findDuplicates(sides, both);
  const scanned =
    `${both.length} file(s) both sides changed` +
    (unresolved.size > 0 ? `, ${unresolved.size} still unresolved and skipped` : "");

  /*
   * Collisions the rule cannot see past, declared in the inventory (e.g. `orchestration.test.ts`:
   * two wanted tests share boilerplate), so the check is not permanently red.
   * They leave the exit code alone, like `unsupportedMethodExceptions`.
   */
  const exceptions = loadInventory().duplicateAddExceptions ?? [];
  const waived = exceptions.filter((entry) =>
    hits.some((hit) => hit.path === entry.path && hit.line === entry.line),
  );
  const claimed = new Set(waived.map((entry) => `${entry.path}\0${entry.line}`));
  const reported = hits.filter((hit) => !claimed.has(`${hit.path}\0${hit.line}`));

  const listing = (group) => {
    const byPath = new Map();
    for (const { path, line } of group) {
      if (!byPath.has(path)) byPath.set(path, []);
      byPath.get(path).push(line.length > 78 ? `${line.slice(0, 78)}…` : line);
    }
    return [...byPath].flatMap(([path, shown]) => [path, ...shown.map((line) => `    ${line}`)]);
  };

  const confident = reported.filter((hit) => !hit.weak);
  const weak = reported.filter((hit) => hit.weak);

  if (confident.length > 0) {
    section.fail(`${confident.length} duplicated line(s) across ${scanned}`, [
      ...listing(confident),
      "Each was added by both sides and kept twice. Git reported no conflict for",
      "these, so nothing else in the merge will mention them. Delete one copy.",
    ]);
  } else {
    section.ok(`no duplicated line(s) across ${scanned}`);
  }

  if (weak.length > 0) {
    section.warn(`${weak.length} line(s) repeated, on weak evidence`, [
      ...listing(weak),
      "Each is a bare call that binds no name, so two of them are two callers",
      "doing the same ordinary thing more often than one block kept twice. Worth",
      "a look; not on its own a reason to edit, and not a failure.",
    ]);
  }

  if (waived.length > 0) {
    section.warn(
      "KNOWN EXCEPTIONS — declared in inventory.json, not counted",
      waived.flatMap((entry) => [`${entry.path}: ${entry.line}`, `    ${entry.reason}`]),
    );
  }

  // An exception nobody can trip is an exception nobody will retire — but only
  // a merge that scanned the entry's file has anything to say about it, and most
  // merges touch neither side of any given exception.
  const scannedPaths = new Set(both);
  const stale = exceptions.filter(
    (entry) => !waived.includes(entry) && scannedPaths.has(entry.path),
  );
  if (stale.length > 0) {
    section.info("STALE EXCEPTIONS — no longer reported; delete the entry", [
      ...stale.map((entry) => `${entry.path}: ${entry.line}`),
      ...stale.map((entry) => `    retire when: ${entry.retiredWhen}`),
    ]);
  }

  if (unresolved.size > 0) {
    section.info("Re-run once the conflicts are resolved", [...unresolved]);
  }
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
