#!/usr/bin/env node
/**
 * Regenerates `apps/web/src/routeTree.gen.ts` without a dev server.
 *
 *   node .agents/skills/fork-upstream-merge/scripts/regen-route-tree.mjs
 *
 * Needed after route files change. Resolves `@tanstack/router-generator` via the router plugin
 * (pnpm does not hoist it), so `vp install` must have run first.
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
