import { normalizeSearchText } from "~/lib/utils";

/**
 * Filtering an administration list by what its rows say.
 *
 * One function for all of them because the three lists differ only in which
 * text a row shows, and that is the part worth stating per list. Everything
 * else — how a query is normalized, what an empty query means, whether a row
 * matches on any field or all of them — is the same answer in every list, and
 * disagreeing about it across three panels is the failure this prevents.
 *
 * These lists are filtered in the browser rather than by the API: none of
 * `/workspaces`, `/loops` or `/users` takes a query parameter, they return
 * everything the deployment has, and the answer is wanted per keystroke.
 */

/**
 * The rows whose text contains `query`, or every row when it is blank.
 *
 * `searchText` returns the strings the row actually renders, and a row matches
 * when any one of them contains the query. Nullable entries are allowed so a
 * caller can pass an optional field straight through instead of coalescing it.
 *
 * Substring, not fuzzy or prefix: an administrator searching a list of things
 * they named is usually typing the middle of a name they already know — `api`
 * finding `billing-api` is the point — and a fuzzy match over short slugs
 * mostly returns rows whose relevance nobody can explain.
 */
export function filterByText<T>(
  items: ReadonlyArray<T>,
  query: string,
  searchText: (item: T) => ReadonlyArray<string | null | undefined>,
): ReadonlyArray<T> {
  const needle = normalizeSearchText(query);
  if (needle.length === 0) return items;

  return items.filter((item) =>
    searchText(item).some((field) => field != null && normalizeSearchText(field).includes(needle)),
  );
}
