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
import { PreviewListResult } from "./preview.ts";
import { ServersListResult } from "./servers.ts";

const decodeServersList = Schema.decodeUnknownSync(ServersListResult);
const decodePreviewList = Schema.decodeUnknownSync(PreviewListResult);

describe("Moatless servers.list", () => {
  it("decodes a running environment, including a starting and a failed server", () => {
    const result = decodeServersList(serversList);

    expect(result.sandboxStatus).toBe("ready");
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

    expect(result.sandboxStatus).toBe("not_created");
    expect(result.servers).toHaveLength(1);
    expect(result.servers[0]?.status).toBe("starting");
    expect(result.servers[0]?.url).not.toBeNull();
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
