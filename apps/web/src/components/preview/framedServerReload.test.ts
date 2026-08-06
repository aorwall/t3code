import { describe, expect, it } from "vite-plus/test";

import { nextFramedServerReload } from "./framedServerReload";

describe("nextFramedServerReload", () => {
  it("replaces the frame once a server that was still coming up starts serving", () => {
    const comingUp = nextFramedServerReload(false, "starting");
    expect(comingUp).toEqual({ reload: false, loadedBeforeServing: true });

    expect(nextFramedServerReload(comingUp.loadedBeforeServing, "started")).toEqual({
      reload: true,
      loadedBeforeServing: false,
    });
  });

  it("remembers a server that was installing before it started", () => {
    const installing = nextFramedServerReload(false, "installing");
    expect(installing.loadedBeforeServing).toBe(true);
    expect(nextFramedServerReload(installing.loadedBeforeServing, "started").reload).toBe(true);
  });

  it("leaves a page alone when its server was already serving when it loaded", () => {
    expect(nextFramedServerReload(false, "started")).toEqual({
      reload: false,
      loadedBeforeServing: false,
    });
  });

  it("replaces the frame once per recovery, not on every status after it", () => {
    const recovered = nextFramedServerReload(true, "started");
    expect(recovered.reload).toBe(true);
    expect(nextFramedServerReload(recovered.loadedBeforeServing, "started").reload).toBe(false);
  });

  it("marks a page stale again when its server stops or fails under it", () => {
    for (const status of ["stopped", "failed"] as const) {
      expect(nextFramedServerReload(false, status)).toEqual({
        reload: false,
        loadedBeforeServing: true,
      });
    }
  });

  it("decides nothing for a tab on no declared server's origin", () => {
    expect(nextFramedServerReload(true, null)).toEqual({
      reload: false,
      loadedBeforeServing: true,
    });
    expect(nextFramedServerReload(false, null)).toEqual({
      reload: false,
      loadedBeforeServing: false,
    });
  });
});
