import { meHandler } from "@t3tools/moatless-api/generated/auth/auth";
import type { SessionResponse } from "@t3tools/moatless-api/generated/model";

import { moatlessQuery, useMoatlessQuery } from "./query.ts";

/**
 * Who the viewer is to Moatless, and whether they administer it.
 * This decides what is shown, nothing else: Moatless enforces admin in its DAOs
 * (`ScopeContext.is_admin`). Gates built on this hide controls the server would refuse anyway;
 * a stale value costs a menu entry or a readable 403. Never describe it as a security boundary.
 */

const sessionQuery = moatlessQuery<SessionResponse>("session", () => meHandler());

export interface MoatlessSession {
  readonly session: SessionResponse | null;
  readonly isAdmin: boolean;
  readonly isPending: boolean;
  readonly error: Error | null;
}

export function useMoatlessSession(): MoatlessSession {
  const { data, error, isPending } = useMoatlessQuery(sessionQuery);
  return {
    session: data,
    // Absent while loading and after a failure. An admin-only control appears
    // when the answer is known to be yes, never on the way to finding out —
    // an entry that materialises a second after the page settles reads as a
    // glitch, and one that vanishes reads as a permissions change.
    isAdmin: data?.user?.role === "admin",
    isPending,
    error,
  };
}
