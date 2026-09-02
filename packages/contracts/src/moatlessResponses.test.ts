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
import { PreviewListResult } from "./preview.ts";
import { ServersListResult } from "./servers.ts";
import { SubtasksListResult } from "./subtasks.ts";

const decodeServersList = Schema.decodeUnknownSync(ServersListResult);
const decodePreviewList = Schema.decodeUnknownSync(PreviewListResult);
const decodeSubtasksList = Schema.decodeUnknownSync(SubtasksListResult);

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
