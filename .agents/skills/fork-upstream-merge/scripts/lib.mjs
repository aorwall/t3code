/**
 * Shared helpers for the fork merge scripts.
 *
 * Everything here is fork-owned and dependency-free: these run in a fresh
 * sandbox before `pnpm install` has necessarily happened, so they use only
 * node builtins and `git`.
 */
import * as NodeChildProcess from "node:child_process";
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";

const SCRIPT_DIR = NodePath.dirname(NodeURL.fileURLToPath(import.meta.url));

/**
 * The checkout being merged, which is not necessarily the one holding this
 * script: worktrees are the normal way to work in this repo, and resolving the
 * root from the script's own path would silently report on the main checkout
 * instead of the worktree the merge is happening in.
 */
function findRepoRoot() {
  try {
    return NodeChildProcess.execFileSync("git", ["rev-parse", "--show-toplevel"], {
      cwd: process.cwd(),
      encoding: "utf8",
    }).trim();
  } catch {
    return NodePath.resolve(SCRIPT_DIR, "../../../..");
  }
}

export const REPO_ROOT = findRepoRoot();
export const INVENTORY_PATH = NodePath.resolve(REPO_ROOT, "docs/fork/inventory.json");

const NO_COLOR = process.env.NO_COLOR !== undefined || !process.stdout.isTTY;
const paint = (code) => (text) => (NO_COLOR ? text : `[${code}m${text}[0m`);
export const bold = paint("1");
export const dim = paint("2");
export const red = paint("31");
export const green = paint("32");
export const yellow = paint("33");
export const cyan = paint("36");

/**
 * Run a command and return trimmed stdout. Throws on non-zero exit unless
 * `allowFailure`, which is what callers want for `git grep` (exit 1 just means
 * "no matches") and for probing a ref that may not be fetched.
 */
export function sh(cmd, args, { allowFailure = false, cwd = REPO_ROOT } = {}) {
  try {
    return NodeChildProcess.execFileSync(cmd, args, {
      cwd,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    }).trim();
  } catch (error) {
    if (allowFailure) return typeof error.stdout === "string" ? error.stdout.trim() : "";
    throw new Error(`${cmd} ${args.join(" ")} failed: ${error.message}`, { cause: error });
  }
}

export const git = (args, options) => sh("git", args, options);

/** Non-empty lines, which is the shape every git listing here wants. */
export const lines = (output) => output.split("\n").filter((line) => line.length > 0);

export function loadInventory() {
  const raw = JSON.parse(NodeFS.readFileSync(INVENTORY_PATH, "utf8"));
  const problems = [];
  const seen = new Set();
  for (const group of ["pathPolicy", "inventory", "convergence", "concerns", "tripwires"]) {
    if (!Array.isArray(raw[group])) problems.push(`${group} is missing or not an array`);
    for (const entry of raw[group] ?? []) {
      if (!entry.id) problems.push(`${group}: an entry has no id`);
      const key = `${group}:${entry.id}`;
      if (seen.has(key)) problems.push(`${group}: duplicate id ${entry.id}`);
      seen.add(key);
    }
  }
  for (const entry of raw.pathPolicy ?? []) {
    if (!Object.hasOwn(raw.verdicts, entry.verdict)) {
      problems.push(`pathPolicy ${entry.id}: unknown verdict ${entry.verdict}`);
    }
    if (!entry.paths?.length) problems.push(`pathPolicy ${entry.id}: no paths`);
  }
  if (problems.length > 0) {
    throw new Error(`docs/fork/inventory.json is malformed:\n  - ${problems.join("\n  - ")}`);
  }
  return raw;
}

/**
 * Glob matching is done here rather than handed to git, because `git ls-tree`
 * treats its path arguments as leading-directory prefixes while `git ls-files`
 * applies full pathspec matching. Feeding the same pattern to both silently
 * answers two different questions — `.plans/**` matched nothing in a tree and
 * everything in the index — and this file exists to compare the two sides.
 *
 * Semantics are the conventional ones: `*` and `?` stay within a path segment,
 * `**` crosses separators.
 */
export function globToRegExp(pattern) {
  let out = "";
  for (let i = 0; i < pattern.length; i += 1) {
    const char = pattern[i];
    if (char === "*") {
      if (pattern[i + 1] === "*") {
        // A trailing or separator-bound `**` also matches zero segments, so
        // `a/**` matches `a/b` and `a/**/c` matches `a/c`.
        if (pattern[i + 2] === "/") {
          out += "(?:.*/)?";
          i += 2;
        } else {
          out += ".*";
          i += 1;
        }
      } else {
        out += "[^/]*";
      }
      continue;
    }
    if (char === "?") out += "[^/]";
    else out += char.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${out}$`);
}

const matchAny = (paths, pathspecs) => {
  const matchers = pathspecs.map(globToRegExp);
  return paths.filter((path) => matchers.some((matcher) => matcher.test(path)));
};

const refListingCache = new Map();

/** Every tracked file in a committed tree, cached per ref. */
export function allFilesInRef(ref) {
  if (!refListingCache.has(ref)) {
    refListingCache.set(ref, lines(git(["ls-tree", "-r", "--name-only", ref])));
  }
  return refListingCache.get(ref);
}

let workingTreeListing = null;

export function allFilesInWorkingTree() {
  workingTreeListing ??= lines(git(["ls-files"]));
  return workingTreeListing;
}

/** Files matching these globs in a committed tree. */
export function filesInRef(ref, pathspecs) {
  if (pathspecs.length === 0) return [];
  return matchAny(allFilesInRef(ref), pathspecs);
}

/** Files matching these globs in the index / working tree. */
export function filesInWorkingTree(pathspecs) {
  if (pathspecs.length === 0) return [];
  return matchAny(allFilesInWorkingTree(), pathspecs);
}

export function refExists(ref) {
  try {
    git(["rev-parse", "--verify", "--quiet", `${ref}^{commit}`]);
    return true;
  } catch {
    return false;
  }
}

export const remoteExists = (name) => lines(git(["remote"], { allowFailure: true })).includes(name);

/**
 * Fetch upstream, having first checked the remote is configured.
 *
 * A fresh clone has only `origin`, which is the normal state in a sandbox, so
 * this is the first thing a merge hits. Fetching blind gets `fatal: 'upstream'
 * does not appear to be a git repository` — which does not say that the remote
 * is simply missing, and does not say what URL to add, even though the answer
 * is sitting in inventory.json two lines away.
 */
export function requireUpstreamRemote(inventory) {
  const { remote, url } = inventory.upstream;
  if (remoteExists(remote)) return remote;
  throw new Error(
    `this clone has no \`${remote}\` remote (a fresh clone only has origin). Run:\n` +
      `  git remote add ${remote} ${url}\n` +
      `  git fetch ${remote}`,
  );
}

export function fetchUpstream(inventory) {
  // Quiet, because the branch-and-tag listing is longer than this script's own
  // report and pushes it off the top of the screen.
  git(["fetch", "--quiet", requireUpstreamRemote(inventory)]);
}

/**
 * The fork's history has to be complete for a merge: a shallow clone reports an
 * empty merge-base, which silently turns the whole upstream range into "new".
 */
export function ensureFullHistory() {
  const shallow = git(["rev-parse", "--is-shallow-repository"], { allowFailure: true });
  if (shallow !== "true") return false;
  git(["fetch", "--unshallow", "origin"]);
  return true;
}

export function mergeBase(a, b) {
  return git(["merge-base", a, b]);
}

/**
 * The files `git merge` will actually stop on, computed without touching the
 * working tree.
 *
 * "Files both sides changed" over-reports by about 5x — 24 candidates for 3 real
 * conflicts in the 2026-08-29 merge — because git auto-merges most of them. This
 * runs the real merge machinery into a temporary tree and reports what it could
 * not resolve, in about 100ms. The tree it writes is unreferenced and gets
 * collected; nothing is checked out and no merge is started.
 *
 * Returns `null` when git cannot do the merge at all (unrelated histories, or a
 * git older than 2.38, which has no `--write-tree`). Callers fall back to the
 * both-sides-changed set, which is a superset and so never hides a conflict.
 */
export function predictConflicts(ours, theirs) {
  const output = sh("git", ["merge-tree", "--write-tree", "--name-only", ours, theirs], {
    allowFailure: true,
  });
  if (output === "") return null;
  // `<tree oid>\n<conflicted paths>\n\n<informational messages>`. A clean merge
  // is the oid alone, which is an empty conflict list rather than a failure.
  const [summary] = output.split("\n\n");
  const [oid, ...paths] = lines(summary);
  if (!/^[0-9a-f]{40}$/.test(oid)) return null;
  return paths;
}

/**
 * Where a merge is: mid-resolution, already committed, or not happening.
 *
 * Both states can be checked, and the useful moment is the first one — before
 * the merge commit exists, while a finding is still a plain edit rather than an
 * amend.
 */
export function mergeSides() {
  const mergeHead = git(["rev-parse", "--verify", "--quiet", "MERGE_HEAD"], { allowFailure: true });
  if (mergeHead !== "") {
    return {
      state: "in-progress",
      merged: null,
      ours: git(["rev-parse", "HEAD"]),
      theirs: mergeHead,
    };
  }
  const [head, ...parents] = git(["rev-list", "--parents", "-n", "1", "HEAD"]).split(" ");
  if (parents.length !== 2) return null;
  return { state: "committed", merged: head, ours: parents[0], theirs: parents[1] };
}

/**
 * A blob's lines, or `null` when the path does not exist on that side — which
 * is normal (a file one side added) and not an error.
 */
export function blobLines(ref, path) {
  const result = NodeChildProcess.spawnSync("git", ["show", `${ref}:${path}`], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.status !== 0) return null;
  return result.stdout.split("\n");
}

/**
 * The verdict for a path: the most specific matching entry wins, so a fork-only
 * file inside an otherwise-upstream directory keeps its own answer.
 */
export function verdictFor(inventory, path) {
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

/**
 * Collects findings so a script can print one grouped report and exit non-zero
 * only when something actually needs a decision.
 */
export class Report {
  #sections = [];
  #failed = false;

  section(title) {
    const entries = [];
    this.#sections.push({ title, entries });
    const add = (level, message, detail) => {
      entries.push({ level, message, detail });
      if (level === "fail") this.#failed = true;
      return api;
    };
    const api = {
      ok: (message, detail) => add("ok", message, detail),
      info: (message, detail) => add("info", message, detail),
      warn: (message, detail) => add("warn", message, detail),
      fail: (message, detail) => add("fail", message, detail),
    };
    return api;
  }

  get failed() {
    return this.#failed;
  }

  print() {
    const mark = {
      ok: green("  ok "),
      info: dim("  -- "),
      warn: yellow("  !! "),
      fail: red("  XX "),
    };
    for (const { title, entries } of this.#sections) {
      process.stdout.write(`\n${bold(title)}\n`);
      if (entries.length === 0) process.stdout.write(dim("  (nothing)\n"));
      for (const { level, message, detail } of entries) {
        process.stdout.write(`${mark[level]}${message}\n`);
        for (const line of detail ?? []) process.stdout.write(dim(`       ${line}\n`));
      }
    }
    process.stdout.write("\n");
  }
}

/** `main()` wrapper that turns a thrown error into a clean non-zero exit. */
export function runMain(main) {
  main().then(
    (code) => process.exit(code ?? 0),
    (error) => {
      process.stderr.write(`${red("error")} ${error.message}\n`);
      process.exit(2);
    },
  );
}
