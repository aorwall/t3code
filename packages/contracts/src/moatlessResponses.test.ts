/**
 * The seam between two products that share a schema and no test process.
 *
 * A hand-written JSON literal inside a Rust test asserts what its author
 * believed this schema said. These fixtures are the responses the Moatless
 * backend actually produces, checked in here and decoded by the schemas
 * themselves — so when its projection changes, the fixture changes with it in
 * the same commit and this is what fails if the two drift.
 */
import * as Schema from "effect/Schema";
import { describe, expect, it } from "vite-plus/test";

import previewList from "../fixtures/moatless/preview-list.json" with { type: "json" };
import previewListEmpty from "../fixtures/moatless/preview-list-empty.json" with { type: "json" };
import serversList from "../fixtures/moatless/servers-list.json" with { type: "json" };
import serversListNeverProvisioned from "../fixtures/moatless/servers-list-never-provisioned.json" with { type: "json" };
import subtasksList from "../fixtures/moatless/subtasks-list.json" with { type: "json" };
import subtasksListEmpty from "../fixtures/moatless/subtasks-list-empty.json" with { type: "json" };
import threadsGetShell from "../fixtures/moatless/threads-get-shell.json" with { type: "json" };
import threadsGetShellAbsent from "../fixtures/moatless/threads-get-shell-absent.json" with { type: "json" };
import { PreviewListResult } from "./preview.ts";
import { ServersListResult } from "./servers.ts";
import { SubtasksListResult } from "./subtasks.ts";
import { ThreadShellGetResult } from "./threadShellLookup.ts";

const decodeServersList = Schema.decodeUnknownSync(ServersListResult);
const decodePreviewList = Schema.decodeUnknownSync(PreviewListResult);
const decodeSubtasksList = Schema.decodeUnknownSync(SubtasksListResult);
const decodeThreadShell = Schema.decodeUnknownSync(ThreadShellGetResult);

describe("Moatless servers.list", () => {
  it("decodes a running environment, including a starting and a failed server", () => {
    const result = decodeServersList(serversList);

    expect(result.servers.map((server) => server.status)).toEqual([
      "started",
      "starting",
      "failed",
    ]);
    // `error` and `detail` are required and nullable, never absent — a client
    // decoding a struct does not get to treat a missing key as null.
    expect(result.servers[0]?.error).toBeNull();
    expect(result.servers[2]?.detail).toBe("bash: line 1: vp: command not found");
  });

  /**
   * Config-first means the servers a repository declares are listed before any
   * container exists to observe. Nothing has been provisioned here, so the
   * status is what the resolver falls back to rather than something it read,
   * and the URL is the ingress hostname that will serve the port once there is
   * something behind it — not a promise that anything answers there now.
   */
  it("decodes the config-first list of an environment that was never provisioned", () => {
    const result = decodeServersList(serversListNeverProvisioned);

    expect(result.servers).toHaveLength(1);
    expect(result.servers[0]?.status).toBe("starting");
    expect(result.servers[0]?.url).not.toBeNull();
  });
});

describe("Moatless subtasks.list", () => {
  it("decodes both parent edges, in spawn order, with the nullable fields written as null", () => {
    const result = decodeSubtasksList(subtasksList);

    expect(result.subtasks.map((subtask) => subtask.relation)).toEqual([
      "createdBy",
      "createdBy",
      "forkedFrom",
    ]);
    // Spawn order, not recency: the panel updates rows in place and must not
    // re-sort itself when a child settles.
    expect(result.subtasks.map((subtask) => subtask.createdAt)).toEqual([
      "2026-07-01T09:05:00.000Z",
      "2026-07-01T09:06:12.000Z",
      "2026-07-01T09:07:00.000Z",
    ]);
    expect(result.subtasks[1]?.branch).toBeNull();
    expect(result.subtasks[0]?.archivedAt).toBeNull();
    // Waiting on a person rides beside the status rather than replacing it.
    expect(result.subtasks[1]?.status).toBe("idle");
    expect(result.subtasks[1]?.awaitingInput).toBe(true);
    // A child that never ran still has a turn count, and it is zero.
    expect(result.subtasks[2]?.turnCount).toBe(0);
  });

  it("decodes a thread that spawned nothing", () => {
    expect(decodeSubtasksList(subtasksListEmpty).subtasks).toEqual([]);
  });
});

/**
 * The fixture is a real archived Moatless task, and it is deliberately one the
 * shell listing does not carry: that is the whole reason the method exists.
 * Decoding it as `OrchestrationThreadShell` is the assertion — the row a client
 * gets by id has to be the row it would have got from the listing, or the same
 * thread renders two ways depending on how it was reached.
 */
describe("Moatless threads.getShell", () => {
  it("decodes a closed thread's listing row as the listing's own shape", () => {
    const result = decodeThreadShell(threadsGetShell);

    expect(result.thread?.title).toBe("fork-verify-source");
    // What the client could not learn from the thread subscription alone.
    expect(result.thread?.projectId).not.toBe("");
    expect(result.thread?.archivedAt).toBe("2026-09-01T05:33:40.403Z");
    // Sidebar-row facts the shell carries and the detail does not.
    expect(result.thread?.hasPendingUserInput).toBe(false);
    expect(result.thread?.latestUserMessageAt).not.toBeNull();
  });

  it("decodes an absent thread as null rather than an error", () => {
    expect(decodeThreadShell(threadsGetShellAbsent).thread).toBeNull();
  });
});

describe("Moatless preview.list", () => {
  it("decodes open tabs, with the viewport absent rather than null on an unresized tab", () => {
    const result = decodePreviewList(previewList);

    expect(result.revision).toBe(7);
    expect(result.serverEpoch).not.toBe("");
    expect(result.sessions.map((session) => session.navStatus._tag)).toEqual(["Success", "Idle"]);
    expect(result.sessions[0]?.viewport).toBeUndefined();
  });

  it("decodes a thread with no tabs, which still carries an epoch and a revision", () => {
    const result = decodePreviewList(previewListEmpty);

    expect(result.sessions).toEqual([]);
    expect(result.revision).toBe(0);
    expect(result.serverEpoch).not.toBe("");
  });
});
