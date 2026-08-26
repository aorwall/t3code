#!/usr/bin/env node
/**
 * Regenerates `apps/web/src/routeTree.gen.ts` without a dev server.
 *
 *   node .agents/skills/fork-upstream-merge/scripts/regen-route-tree.mjs
 *
 * A route file conflict — adding, deleting, or renaming anything under
 * `apps/web/src/routes/` — leaves the generated route tree stale, and nothing
 * else in the merge procedure touches it. The obvious fix, starting `vp dev`
 * and killing it once the file changes, means a spin-up, a poll loop, and a
 * PID to track and kill correctly (see the "killing by pattern" rule in
 * AGENTS.md) for what is a one-shot file write.
 *
 * `@tanstack/router-plugin`'s Vite plugin calls exactly two functions to do
 * this: `getConfig` reads the router's config (empty here — `vite.config.ts`
 * calls `tanstackRouter()` with no options, so every default applies) and
 * `new Generator({ config, root }).run()` walks `apps/web/src/routes/` once
 * and writes the tree. Calling them directly here skips Vite, the dev server,
 * and the file watcher entirely.
 *
 * Both live in `@tanstack/router-generator`, which `apps/web` never imports
 * itself — `@tanstack/router-plugin` depends on it, and pnpm's isolated
 * `node_modules` nests it under the plugin's own directory rather than
 * hoisting it where a bare `import "@tanstack/router-generator"` would find
 * it. Resolving it from there, the same way Node would resolve it from inside
 * the plugin's own code, is what `resolveGeneratorFromRouterPlugin` below
 * does — no version-pinned `dist/...` path to go stale on an upgrade.
 *
 * Unlike its siblings in this directory, this script is NOT dependency-free:
 * `@tanstack/router-plugin` has to already be in `node_modules`, which means
 * `vp install` has to have run first. That is the normal state of a working
 * checkout, so it is not spelled out as a separate step — this script just
 * fails with a clear pointer to `vp install` if it is not.
 */
import * as NodeFS from "node:fs";
import * as NodeModule from "node:module";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";

import { REPO_ROOT, bold, dim, git, green, red, runMain } from "./lib.mjs";

const WEB_ROOT = NodePath.resolve(REPO_ROOT, "apps/web");
const ROUTE_TREE_PATH = NodePath.resolve(WEB_ROOT, "src/routeTree.gen.ts");

function resolveGeneratorFromRouterPlugin() {
  const requireFromWeb = NodeModule.createRequire(NodePath.join(WEB_ROOT, "package.json"));
  const routerPluginManifest = requireFromWeb.resolve("@tanstack/router-plugin/package.json");
  const requireFromRouterPlugin = NodeModule.createRequire(routerPluginManifest);
  return requireFromRouterPlugin.resolve("@tanstack/router-generator");
}

async function loadGenerator() {
  try {
    const entry = resolveGeneratorFromRouterPlugin();
    return await import(NodeURL.pathToFileURL(entry).href);
  } catch (error) {
    if (error.code !== "MODULE_NOT_FOUND" && error.code !== "ERR_MODULE_NOT_FOUND") throw error;
    throw new Error(
      "@tanstack/router-plugin (and its router-generator dependency) is not installed. " +
        "Run `vp install` first, then re-run this script.",
      { cause: error },
    );
  }
}

async function main() {
  const before = NodeFS.existsSync(ROUTE_TREE_PATH)
    ? NodeFS.readFileSync(ROUTE_TREE_PATH, "utf8")
    : null;

  const { getConfig, Generator } = await loadGenerator();
  const config = getConfig({}, WEB_ROOT);
  const generator = new Generator({ config, root: WEB_ROOT });
  await generator.run();

  const after = NodeFS.existsSync(ROUTE_TREE_PATH)
    ? NodeFS.readFileSync(ROUTE_TREE_PATH, "utf8")
    : null;
  const relPath = NodePath.relative(REPO_ROOT, ROUTE_TREE_PATH);

  if (after === null) {
    process.stderr.write(`${red("error")} generator ran but ${relPath} still does not exist.\n`);
    return 1;
  }
  if (before === after) {
    process.stdout.write(`${dim(relPath)} already up to date, nothing written.\n`);
    return 0;
  }
  const changedLines = git(["diff", "--stat", "--", relPath], { allowFailure: true });
  process.stdout.write(`${green("regenerated")} ${bold(relPath)}\n`);
  if (changedLines) process.stdout.write(`${dim(changedLines)}\n`);
  return 0;
}

runMain(main);
