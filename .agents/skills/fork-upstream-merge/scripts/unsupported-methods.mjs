#!/usr/bin/env node
/**
 * Derives which contract WebSocket methods should declare `UnsupportedMethodError`,
 * by reading both sides rather than remembering either.
 *
 *   node .agents/skills/fork-upstream-merge/scripts/unsupported-methods.mjs
 *
 * Contract side: every `Rpc.make(WS_METHODS.x, …)` / `Rpc.make(ORCHESTRATION_WS_METHODS.x, …)`
 * in packages/contracts/src/rpc.ts, resolved through the method maps to wire strings.
 * Backend side: the `"method.name" =>` arms of the frame dispatch in soaplabs/moatless
 * (crates/t3code/src/lib.rs), read over the API since a sandbox has no checkout.
 *
 * Both directions are findings. A method the backend has started serving keeps a
 * union entry that can never fire; a method it has stopped serving loses the typed
 * refusal the client renders.
 *
 * Dispatched is not the same as never refuses: an arm that can still reach
 * `unsupported_exit` keeps its union member, so those are reported separately
 * rather than as entries to drop. Pass --offline to skip the network read and
 * report only the contract side.
 */
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";

import { REPO_ROOT, bold, cyan, dim, green, red, runMain, sh, yellow } from "./lib.mjs";

const RPC_PATH = "packages/contracts/src/rpc.ts";
const ORCHESTRATION_PATH = "packages/contracts/src/orchestration.ts";
const BACKEND_API = "repos/soaplabs/moatless/contents/crates/t3code/src/lib.rs";

const read = (relative) => NodeFS.readFileSync(NodePath.resolve(REPO_ROOT, relative), "utf8");

/** `name: "wire.string"` pairs out of a `X = { … } as const` map. */
function parseMethodMap(source, name) {
  const match = source.match(new RegExp(`${name}\\s*=\\s*\\{([\\s\\S]*?)\\}\\s*as const`));
  if (!match) throw new Error(`could not find ${name}`);
  return Object.fromEntries(
    [...match[1].matchAll(/(\w+)\s*:\s*"([^"]+)"/g)].map((m) => [m[1], m[2]]),
  );
}

/** Walks forward from an offset to the matching close paren, so nested unions are kept whole. */
function balancedSlice(source, start) {
  let depth = 1;
  let index = start;
  while (index < source.length && depth > 0) {
    const char = source[index];
    if (char === "(") depth += 1;
    else if (char === ")") depth -= 1;
    index += 1;
  }
  return source.slice(start, index);
}

function parseContract() {
  const rpc = read(RPC_PATH);
  const maps = {
    WS_METHODS: parseMethodMap(rpc, "WS_METHODS"),
    ORCHESTRATION_WS_METHODS: parseMethodMap(read(ORCHESTRATION_PATH), "ORCHESTRATION_WS_METHODS"),
  };

  const methods = new Map();
  const marker = "Rpc.make(";
  for (let at = rpc.indexOf(marker); at !== -1; at = rpc.indexOf(marker, at + 1)) {
    const call = balancedSlice(rpc, at + marker.length);
    const ref = call.match(/^\s*(WS_METHODS|ORCHESTRATION_WS_METHODS)\.(\w+)/);
    if (!ref) continue;
    const wire = maps[ref[1]][ref[2]];
    if (!wire) throw new Error(`${ref[1]}.${ref[2]} is not in its map`);
    methods.set(wire, call.includes("UnsupportedMethodError"));
  }
  if (methods.size === 0) throw new Error(`no Rpc.make calls found in ${RPC_PATH}`);
  return methods;
}

function parseBackend() {
  let raw = "";
  for (const cmd of [["moat", "gh"], ["gh"]]) {
    raw = sh(cmd[0], [...cmd.slice(1), "api", BACKEND_API, "--jq", ".content"], {
      allowFailure: true,
    });
    if (raw) break;
  }
  if (!raw) return null;

  const source = Buffer.from(raw, "base64").toString("utf8");
  const dispatched = new Set();
  for (const match of source.matchAll(/"([a-zA-Z._]+)"\s*=>/g)) {
    // `"on" =>` is a match arm on a different enum, not a wire method.
    if (match[1] !== "on") dispatched.add(match[1]);
  }

  /**
   * An arm that can still return `unsupported_exit` refuses conditionally, so
   * its union member has to stay. Scope each arm from its own `"name" =>` to the
   * next one and look inside.
   */
  const arms = [...source.matchAll(/"([a-zA-Z._]+)"\s*=>/g)];
  const conditional = new Set();
  for (const [index, arm] of arms.entries()) {
    const start = arm.index;
    const end = index + 1 < arms.length ? arms[index + 1].index : source.length;
    if (source.slice(start, end).includes("unsupported_exit")) conditional.add(arm[1]);
  }
  conditional.delete("on");
  return { dispatched, conditional };
}

const list = (title, items, colour) => {
  process.stdout.write(`\n${bold(colour(`${title} (${items.length})`))}\n`);
  if (items.length === 0) process.stdout.write(dim("  (none)\n"));
  for (const item of items) process.stdout.write(`  ${item}\n`);
};

runMain(async () => {
  const contract = parseContract();
  const declared = [...contract].filter(([, has]) => has).map(([wire]) => wire);

  process.stdout.write(
    `\n${bold("Contract")}  ${contract.size} WebSocket methods, ` +
      `${declared.length} declaring UnsupportedMethodError\n`,
  );

  if (process.argv.includes("--offline")) {
    list("Declaring UnsupportedMethodError", declared.sort(), cyan);
    return 0;
  }

  const backend = parseBackend();
  if (!backend) {
    process.stderr.write(
      `\n${yellow("warning")} could not read the backend dispatch; reporting the contract side only.\n` +
        `  Needs an authenticated gh. Retry, or run with --offline.\n`,
    );
    list("Declaring UnsupportedMethodError", declared.sort(), cyan);
    return 2;
  }

  process.stdout.write(`${bold("Backend")}   ${backend.dispatched.size} dispatched methods\n`);

  const add = [];
  const drop = [];
  const keepConditional = [];
  for (const [wire, hasUnion] of [...contract].sort()) {
    const dispatched = backend.dispatched.has(wire);
    if (!hasUnion && !dispatched) add.push(wire);
    else if (hasUnion && dispatched) {
      (backend.conditional.has(wire) ? keepConditional : drop).push(wire);
    }
  }

  list("ADD — backend does not dispatch these, and they carry no union entry", add, red);
  list("DROP — backend serves these unconditionally; the union entry can never fire", drop, red);
  list("KEEP — dispatched, but the arm can still reach unsupported_exit", keepConditional, green);

  process.stdout.write(
    `\n${dim("Union entries live in packages/contracts/src/rpc.ts. Reconcile docs/fork/gaps.md after changing them.")}\n\n`,
  );
  return add.length + drop.length > 0 ? 1 : 0;
});
