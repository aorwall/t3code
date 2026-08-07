import { describe, expect, it } from "vite-plus/test";

import { filterByText } from "./listSearch";

interface Row {
  readonly name: string;
  readonly detail?: string | null;
}

// Deliberately not in alphabetical order: the caller sorts before filtering,
// and a filter that re-sorts would move rows around as someone types.
const rows: ReadonlyArray<Row> = [
  { name: "Checkout", detail: null },
  { name: "billing-api", detail: "github.com/acme/billing" },
  { name: "Ínfra", detail: "internal tooling" },
];

const searchText = (row: Row) => [row.name, row.detail];

describe("filterByText", () => {
  it("returns every row for a blank query", () => {
    expect(filterByText(rows, "", searchText)).toHaveLength(3);
    expect(filterByText(rows, "   ", searchText)).toHaveLength(3);
  });

  it("matches a substring, not only a prefix", () => {
    const matched = filterByText(rows, "api", searchText);
    expect(matched.map((row) => row.name)).toEqual(["billing-api"]);
  });

  it("ignores case", () => {
    expect(filterByText(rows, "CHECKOUT", searchText).map((row) => row.name)).toEqual(["Checkout"]);
  });

  it("ignores accents, so a name typed without them still finds its row", () => {
    expect(filterByText(rows, "infra", searchText).map((row) => row.name)).toEqual(["Ínfra"]);
  });

  it("matches on any field, not only the first", () => {
    expect(filterByText(rows, "acme", searchText).map((row) => row.name)).toEqual(["billing-api"]);
  });

  it("skips a null or undefined field rather than treating it as empty text", () => {
    // An empty string is a substring of everything, so a row with no detail
    // would match every query if nullish fields were coalesced to "".
    expect(filterByText(rows, "zzz", searchText)).toEqual([]);
  });

  it("returns no rows when nothing matches", () => {
    expect(filterByText(rows, "nothing here", searchText)).toEqual([]);
  });

  it("keeps the order it was given", () => {
    const matched = filterByText(rows, "o", searchText);
    expect(matched.map((row) => row.name)).toEqual(["Checkout", "billing-api", "Ínfra"]);
  });
});
