import { TurnId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { parseMoatlessTurnNumber } from "./threadFork";

describe("parseMoatlessTurnNumber", () => {
  it("reads the turn number off Moatless's task-id:turn-number wire format", () => {
    expect(parseMoatlessTurnNumber(TurnId.make("9b1f2c3d-source-task:3"))).toBe(3);
  });

  it("reads turn zero", () => {
    expect(parseMoatlessTurnNumber(TurnId.make("9b1f2c3d-source-task:0"))).toBe(0);
  });

  it("returns null for a turn id with no trailing number", () => {
    expect(parseMoatlessTurnNumber(TurnId.make("9b1f2c3d-source-task:"))).toBeNull();
    expect(parseMoatlessTurnNumber(TurnId.make("not-a-moatless-turn-id"))).toBeNull();
  });
});
