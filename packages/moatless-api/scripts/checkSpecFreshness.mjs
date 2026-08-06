#!/usr/bin/env node
/**
 * Fails when the checked-in Moatless API description no longer matches the
 * backend's own.
 *
 * The description is a contract held across two git repositories, which is the
 * one interface in this package that can go stale without anything failing at
 * build time. The first symptom otherwise is a decode error on an
 * administration page nobody opened during review, on a deployment nobody was
 * watching. This is the same guard the Moatless repo runs through
 * `task generate`, pointed the other way.
 *
 * Two ways to get the backend's description, in order of preference:
 *
 *   1. `--url <origin>` — read `/api-docs/openapi.json` from a running
 *      deployment. What CI uses against the environment it is about to deploy.
 *   2. `--moatless-repo <path>` — read `openapi-specs.json` from a sibling
 *      checkout. What a developer with both repos open uses. Defaults to
 *      `../moatless` relative to this repo, which is the workspace layout.
 *
 * Exits 0 when they match, 1 with a summary of the differing paths when they
 * do not. The summary lists paths rather than a full JSON diff, because a
 * 476 KB diff is not something a person reads out of a CI log.
 */

import * as NodeFSP from "node:fs/promises";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";

const packageDir = NodePath.dirname(NodePath.dirname(NodeURL.fileURLToPath(import.meta.url)));
const checkedInPath = NodePath.join(packageDir, "openapi-specs.json");

function arg(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

async function readBackendSpec() {
  const url = arg("--url");
  if (url !== undefined) {
    const target = new URL("/api-docs/openapi.json", url);
    const response = await fetch(target);
    if (!response.ok) {
      throw new Error(`GET ${target} responded ${response.status}`);
    }
    return { spec: await response.json(), from: target.toString() };
  }

  const repo = arg("--moatless-repo") ?? NodePath.resolve(packageDir, "../../../moatless");
  const path = NodePath.join(repo, "openapi-specs.json");
  return {
    spec: JSON.parse(await NodeFSP.readFile(path, "utf8")),
    from: path,
  };
}

/** Every `METHOD /path` pair a description declares. */
function operations(spec) {
  const found = new Set();
  for (const [path, methods] of Object.entries(spec.paths ?? {})) {
    for (const method of Object.keys(methods ?? {})) {
      found.add(`${method.toUpperCase()} ${path}`);
    }
  }
  return found;
}

const checkedIn = JSON.parse(await NodeFSP.readFile(checkedInPath, "utf8"));
const { spec: backend, from } = await readBackendSpec();

if (JSON.stringify(checkedIn) === JSON.stringify(backend)) {
  console.log(`openapi-specs.json matches ${from}`);
  process.exit(0);
}

const ours = operations(checkedIn);
const theirs = operations(backend);
const added = [...theirs].filter((op) => !ours.has(op)).sort();
const removed = [...ours].filter((op) => !theirs.has(op)).sort();

console.error(`openapi-specs.json is stale against ${from}\n`);
if (added.length > 0) {
  console.error(`Operations the backend has and the client does not (${added.length}):`);
  for (const op of added) console.error(`  + ${op}`);
}
if (removed.length > 0) {
  console.error(`\nOperations the client has and the backend does not (${removed.length}):`);
  for (const op of removed) console.error(`  - ${op}`);
}
if (added.length === 0 && removed.length === 0) {
  console.error(
    "The operation list is unchanged, so the difference is in schemas,\n" +
      "parameters or responses. Regenerate to see it.",
  );
}
console.error(
  `\nRefresh with:\n` +
    `  cp <moatless>/openapi-specs.json ${checkedInPath}\n` +
    `  pnpm --filter @t3tools/moatless-api generate`,
);
process.exit(1);
