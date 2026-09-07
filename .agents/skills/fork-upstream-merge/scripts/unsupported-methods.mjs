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
 * (crates/t3code/src/rpc/dispatch.rs), read over the API since a sandbox has no checkout.
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

import {
  REPO_ROOT,
  bold,
  cyan,
  dim,
  green,
  loadInventory,
  red,
  runMain,
  sh,
  yellow,
} from "./lib.mjs";

const RPC_PATH = "packages/contracts/src/rpc.ts";
const ORCHESTRATION_PATH = "packages/contracts/src/orchestration.ts";
/**
 * The dispatch has moved once already — it was inline in `lib.rs` until the
 * backend split `rpc/` into its own module on 2026-09-07. A read that finds the
 * file but no arms reports "0 dispatched methods", which reads as "the backend
 * serves nothing" and turns every union entry into a finding. Try each known
 * location and take the first that actually holds arms.
 */
const BACKEND_APIS = [
  "repos/soaplabs/moatless/contents/crates/t3code/src/rpc/dispatch.rs",
  "repos/soaplabs/moatless/contents/crates/t3code/src/lib.rs",
];

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

/**
 * `error:` fields that name a shared `const FooError = Schema.Union([…])` instead of
 * inlining the union — several `Rpc.make` calls reuse one error type this way. Maps
 * each such const's name to whether its own union includes `UnsupportedMethodError`,
 * so a call site that only says `error: FooError` still resolves correctly.
 */
function parseErrorConsts(source) {
  const consts = new Map();
  const pattern = /const\s+(\w+)\s*=\s*Schema\.Union\(/g;
  for (let match = pattern.exec(source); match; match = pattern.exec(source)) {
    const body = balancedSlice(source, match.index + match[0].length);
    consts.set(match[1], body.includes("UnsupportedMethodError"));
  }
  return consts;
}

function parseContract() {
  const rpc = read(RPC_PATH);
  const orchestration = read(ORCHESTRATION_PATH);
  const maps = {
    WS_METHODS: parseMethodMap(rpc, "WS_METHODS"),
    ORCHESTRATION_WS_METHODS: parseMethodMap(orchestration, "ORCHESTRATION_WS_METHODS"),
  };
  const errorConsts = new Map([...parseErrorConsts(rpc), ...parseErrorConsts(orchestration)]);

  const methods = new Map();
  const marker = "Rpc.make(";
  for (let at = rpc.indexOf(marker); at !== -1; at = rpc.indexOf(marker, at + 1)) {
    const call = balancedSlice(rpc, at + marker.length);
    const ref = call.match(/^\s*(WS_METHODS|ORCHESTRATION_WS_METHODS)\.(\w+)/);
    if (!ref) continue;
    const wire = maps[ref[1]][ref[2]];
    if (!wire) throw new Error(`${ref[1]}.${ref[2]} is not in its map`);
    const errorRef = call.match(/error:\s*(\w+)/);
    const hasUnsupported =
      errorRef && errorConsts.has(errorRef[1])
        ? errorConsts.get(errorRef[1])
        : call.includes("UnsupportedMethodError");
    methods.set(wire, hasUnsupported);
  }
  if (methods.size === 0) throw new Error(`no Rpc.make calls found in ${RPC_PATH}`);
  return methods;
}

/** The `{ … }` after an offset, brace-balanced, or "" when the offset opens none. */
function balancedBlock(source, from) {
  const open = source.indexOf("{", from);
  if (open === -1) return "";
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    else if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(open, index + 1);
    }
  }
  return source.slice(open);
}

/** A match arm's right-hand side: the rest of its line, or its block when it opens one. */
function armBody(source, afterArrow) {
  const lineEnd = source.indexOf("\n", afterArrow);
  const line = source.slice(afterArrow, lineEnd === -1 ? source.length : lineEnd);
  return /\{\s*$/.test(line) ? balancedBlock(source, afterArrow) : line;
}

/** True when the code, or a function it calls, can return `unsupported_exit`. */
function refusesInside(source, code, depth, seen) {
  if (code.includes("unsupported_exit")) return true;
  if (depth === 0) return false;
  for (const call of code.matchAll(/([a-z_][a-z0-9_]*)\s*\(/gi)) {
    const name = call[1];
    if (seen.has(name)) continue;
    seen.add(name);
    const declaration = source.match(new RegExp(`fn\\s+${name}\\s*[(<]`));
    if (!declaration) continue;
    const body = balancedBlock(source, declaration.index + declaration[0].length);
    if (refusesInside(source, body, depth - 1, seen)) return true;
  }
  return false;
}

function parseBackend() {
  let source = "";
  for (const api of BACKEND_APIS) {
    let raw = "";
    for (const cmd of [["moat", "gh"], ["gh"]]) {
      raw = sh(cmd[0], [...cmd.slice(1), "api", api, "--jq", ".content"], {
        allowFailure: true,
      });
      if (raw) break;
    }
    if (!raw) continue;
    const decoded = Buffer.from(raw, "base64").toString("utf8");
    if (/"[a-zA-Z._]+"\s*=>/.test(decoded)) {
      source = decoded;
      break;
    }
  }
  if (!source) return null;

  const dispatched = new Set();
  for (const match of source.matchAll(/"([a-zA-Z._]+)"\s*=>/g)) {
    // `"on" =>` is a match arm on a different enum, not a wire method.
    if (match[1] !== "on") dispatched.add(match[1]);
  }

  /**
   * An arm that can still return `unsupported_exit` refuses conditionally, so
   * its union member has to stay.
   *
   * Reading the arm alone stopped being enough when the backend split `rpc/` out
   * on 2026-09-07: every arm is now a one-line call and the refusal sits in the
   * handler below the match. So read the arm, then follow the functions it calls.
   * Two levels, same file only. A false KEEP costs a report nobody acts on; a
   * false DROP costs the typed refusal a client has to decode.
   */
  const conditional = new Set();
  for (const arm of source.matchAll(/"([a-zA-Z._]+)"\s*=>/g)) {
    if (arm[1] === "on") continue;
    if (refusesInside(source, armBody(source, arm.index + arm[0].length), 2, new Set())) {
      conditional.add(arm[1]);
    }
  }
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

  /*
   * A method whose derivation is known to read backwards, declared in the
   * inventory rather than tolerated by habit. `scripts.run` is the standing
   * one: it is upstream's own server that refuses it, not Moatless, so the
   * comparison reports a union entry that can never fire while it is exactly
   * the entry that has to stay.
   *
   * These leave the exit code alone. A check that is always red is a check
   * whose findings nobody reads — which is the whole failure this script
   * exists to prevent, applied to the script itself.
   */
  const exceptions = loadInventory().unsupportedMethodExceptions ?? [];
  const excepted = (bucket, direction) => {
    const matches = exceptions.filter((entry) => entry.direction === direction);
    const claimed = new Set(matches.map((entry) => entry.method));
    return {
      remaining: bucket.filter((wire) => !claimed.has(wire)),
      waived: matches.filter((entry) => bucket.includes(entry.method)),
    };
  };
  const addBucket = excepted(add, "ADD");
  const dropBucket = excepted(drop, "DROP");
  const waived = [...addBucket.waived, ...dropBucket.waived];

  list(
    "ADD — backend does not dispatch these, and they carry no union entry",
    addBucket.remaining,
    red,
  );
  list(
    "DROP — backend serves these unconditionally; the union entry can never fire",
    dropBucket.remaining,
    red,
  );
  list("KEEP — dispatched, but the arm can still reach unsupported_exit", keepConditional, green);
  list(
    "KNOWN EXCEPTIONS — declared in inventory.json, not counted",
    waived.map((entry) => `${entry.direction} ${entry.method} — ${entry.reason}`),
    yellow,
  );

  // An exception nobody can trip is an exception nobody will retire.
  const stale = exceptions.filter((entry) => !waived.includes(entry));
  if (stale.length > 0) {
    list(
      "STALE EXCEPTIONS — no longer reported; delete the entry",
      stale.map(
        (entry) => `${entry.direction} ${entry.method} — retire when: ${entry.retiredWhen}`,
      ),
      yellow,
    );
  }

  process.stdout.write(
    `\n${dim("Union entries live in packages/contracts/src/rpc.ts. Reconcile docs/fork/gaps.md after changing them.")}\n\n`,
  );
  return addBucket.remaining.length + dropBucket.remaining.length > 0 ? 1 : 0;
});
