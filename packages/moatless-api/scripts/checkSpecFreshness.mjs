#!/usr/bin/env node
/**
 * Fails when the checked-in Moatless API description no longer matches the backend's own.
 *
 * Sources: `--url <origin>` reads `/api-docs/openapi.json` from a deployment; `--moatless-repo
 * <path>` reads `openapi-specs.json` from a checkout (default `../moatless`).
 * Exits 0 on match, 1 with the differing paths otherwise.
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
