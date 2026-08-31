import { describe, expect, it } from "vite-plus/test";

import { initialHostedFrameLoad, resolveHostedFrameLoad } from "./hostedFrameLoad";

const HOME = "https://task--4000.preview.example.test/";
const CUSTOMERS = "https://task--4000.preview.example.test/customers";
const CRR = "https://task--4000.preview.example.test/crr";

describe("resolveHostedFrameLoad", () => {
  it("stays on the same load when the guest reports where it routed itself", () => {
    const loaded = initialHostedFrameLoad({ url: HOME, reloadNonce: 0 });

    const next = resolveHostedFrameLoad(loaded, {
      url: CUSTOMERS,
      reloadNonce: 0,
      reportedUrl: CUSTOMERS,
    });

    expect(next).toBe(loaded);
  });

  it("stays put across a run of guest route changes", () => {
    const loaded = initialHostedFrameLoad({ url: HOME, reloadNonce: 0 });

    const afterFirst = resolveHostedFrameLoad(loaded, {
      url: CUSTOMERS,
      reloadNonce: 0,
      reportedUrl: CUSTOMERS,
    });
    const afterSecond = resolveHostedFrameLoad(afterFirst, {
      url: CRR,
      reloadNonce: 0,
      reportedUrl: CRR,
    });

    expect(afterSecond).toBe(loaded);
    expect(afterSecond.url).toBe(HOME);
  });

  it("follows a URL the host navigated to, even after the guest has moved", () => {
    const loaded = initialHostedFrameLoad({ url: HOME, reloadNonce: 0 });

    const next = resolveHostedFrameLoad(loaded, {
      url: CRR,
      reloadNonce: 0,
      reportedUrl: CUSTOMERS,
    });

    expect(next).toEqual({ url: CRR, reloadNonce: 0 });
  });

  it("follows the first URL a tab is given", () => {
    const loaded = initialHostedFrameLoad({ url: null, reloadNonce: 0 });

    const next = resolveHostedFrameLoad(loaded, {
      url: HOME,
      reloadNonce: 0,
      reportedUrl: null,
    });

    expect(next).toEqual({ url: HOME, reloadNonce: 0 });
  });

  it("reloads onto the page the guest routed to, not the one the frame was built from", () => {
    const loaded = initialHostedFrameLoad({ url: HOME, reloadNonce: 0 });
    const afterRoute = resolveHostedFrameLoad(loaded, {
      url: CUSTOMERS,
      reloadNonce: 0,
      reportedUrl: CUSTOMERS,
    });

    const next = resolveHostedFrameLoad(afterRoute, {
      url: CUSTOMERS,
      reloadNonce: 1,
      reportedUrl: CUSTOMERS,
    });

    expect(next).toEqual({ url: CUSTOMERS, reloadNonce: 1 });
  });

  it("is idempotent, so re-rendering on unrelated state never replaces the frame", () => {
    const loaded = initialHostedFrameLoad({ url: HOME, reloadNonce: 0 });
    const tab = { url: CUSTOMERS, reloadNonce: 0, reportedUrl: CUSTOMERS } as const;

    const once = resolveHostedFrameLoad(loaded, tab);
    const twice = resolveHostedFrameLoad(once, tab);

    expect(twice).toBe(once);
  });

  it("does not re-run a reload it has already applied", () => {
    const loaded = initialHostedFrameLoad({ url: HOME, reloadNonce: 0 });
    const tab = { url: HOME, reloadNonce: 1, reportedUrl: null } as const;

    const once = resolveHostedFrameLoad(loaded, tab);
    const twice = resolveHostedFrameLoad(once, tab);

    expect(once).toEqual({ url: HOME, reloadNonce: 1 });
    expect(twice).toBe(once);
  });
});
