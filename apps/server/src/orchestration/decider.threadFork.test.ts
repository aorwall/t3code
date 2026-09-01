// Fork: forking a thread from the chat hover action. thread.fork is served by
// Moatless; this only checks the bundled server refuses it cleanly.
import { CommandId, ThreadId } from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { expect, it } from "@effect/vitest";

import { decideOrchestrationCommand } from "./decider.ts";
import { createEmptyReadModel } from "./projector.ts";

it.layer(NodeServices.layer)("thread.fork on the bundled server", (it) => {
  it.effect("refuses rather than fabricate a session-less copy", () =>
    Effect.gen(function* () {
      const error = yield* decideOrchestrationCommand({
        command: {
          type: "thread.fork",
          commandId: CommandId.make("cmd-fork-1"),
          threadId: ThreadId.make("thread-fork-new"),
          sourceThreadId: ThreadId.make("thread-fork-source"),
          sameSandbox: true,
          createdAt: "2026-01-01T00:00:00.000Z",
        },
        readModel: createEmptyReadModel("2026-01-01T00:00:00.000Z"),
      }).pipe(Effect.flip);
      expect(error._tag).toBe("OrchestrationCommandInvariantError");
    }),
  );
});
