import { describe, expect, it } from "vite-plus/test";

import {
  composeSidebarThreadList,
  isThreadBrowseActive,
  isThreadFilterActive,
  NO_THREAD_BROWSE_FILTER,
  threadBrowseInput,
} from "./threadBrowseFilter";

describe("threadBrowseInput", () => {
  it("has nothing to ask for while the listing is the answer", () => {
    expect(threadBrowseInput(NO_THREAD_BROWSE_FILTER)).toBeNull();
    // Closed work the viewer follows is a listing of its own, so this alone is
    // not a browse.
    expect(threadBrowseInput({ ...NO_THREAD_BROWSE_FILTER, includeClosed: true })).toBeNull();
  });

  it("leaves an unset filter out, so one filter is one payload", () => {
    expect(threadBrowseInput({ ownerUserId: "user-1", tag: null, includeClosed: false })).toEqual({
      ownerUserId: "user-1",
      includeClosed: false,
    });
    expect(
      JSON.stringify(threadBrowseInput({ ownerUserId: "user-1", tag: "bug", includeClosed: true })),
    ).toBe(JSON.stringify({ ownerUserId: "user-1", tag: "bug", includeClosed: true }));
  });
});

describe("isThreadBrowseActive", () => {
  it("is owner or tag, and nothing else", () => {
    expect(isThreadBrowseActive(NO_THREAD_BROWSE_FILTER)).toBe(false);
    expect(isThreadBrowseActive({ ...NO_THREAD_BROWSE_FILTER, includeClosed: true })).toBe(false);
    expect(isThreadBrowseActive({ ...NO_THREAD_BROWSE_FILTER, tag: "bug" })).toBe(true);
    expect(isThreadFilterActive({ ...NO_THREAD_BROWSE_FILTER, includeClosed: true })).toBe(true);
  });
});

describe("composeSidebarThreadList", () => {
  const listed = [{ environmentId: "env", id: "open" }];
  const archived = [{ environmentId: "env", id: "closed" }];

  it("replaces the listing with the browse, rather than adding to it", () => {
    const browsed = [{ environmentId: "env", id: "someone-elses" }];
    expect(composeSidebarThreadList({ listed, browsed, archived })).toEqual(browsed);
  });

  it("appends the closed half, and keeps the listing when there is none", () => {
    expect(composeSidebarThreadList({ listed, browsed: null, archived: [] })).toBe(listed);
    expect(composeSidebarThreadList({ listed, browsed: null, archived })).toEqual([
      ...listed,
      ...archived,
    ]);
  });

  it("drops a closed thread the graft already put in the listing", () => {
    // Reading a closed thread adopts it into the snapshot, so both halves carry
    // it and React would see one key twice.
    expect(
      composeSidebarThreadList({
        listed: [...listed, ...archived],
        browsed: null,
        archived,
      }),
    ).toEqual([...listed, ...archived]);
  });
});
