import { useState } from "react";

/**
 * Local form state with dirty tracking against an initial snapshot.
 *
 * Ported from the Moatless SPA (`apps/frontend/src/lib/hooks/use-dirty-form.ts`)
 * so that the administration forms behave the same on both sides during the
 * move. Deliberately does not resync on a background refetch: the alternative is
 * a page that discards what someone is halfway through typing because the cache
 * revalidated underneath them.
 *
 * Mount the form `key`ed by the entity id, so switching entities remounts
 * rather than merging one entity's edits into another's snapshot.
 */
export function useDirtyForm<T extends Record<string, unknown>>(initial: T) {
  const [values, setValues] = useState<T>(initial);

  const isDirty = !shallowEqual(values, initial);

  const setField = <K extends keyof T>(key: K, value: T[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  const reset = () => setValues(initial);

  return { values, setField, isDirty, reset };
}

function shallowEqual<T extends Record<string, unknown>>(a: T, b: T): boolean {
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) {
    return false;
  }
  return keys.every((key) => a[key] === b[key]);
}
