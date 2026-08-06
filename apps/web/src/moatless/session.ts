import { meHandler } from "@t3tools/moatless-api/generated/auth/auth";
import type { SessionResponse } from "@t3tools/moatless-api/generated/model";

import { moatlessQuery, useMoatlessQuery } from "./query.ts";

/**
 * Who the viewer is to Moatless, and whether they administer it.
 *
 * # This decides what is shown, and nothing else
 *
 * Moatless enforces administration in its DAOs, through `ScopeContext.is_admin`
 * (`backend/src/loops/dao.rs:404`). Every gate built on this module is
 * cosmetic: hiding a control the server would refuse anyway, so that nobody is
 * offered work they cannot do. A stale `false` costs a person a menu entry; a
 * stale `true` costs them a 403 they can read. Neither is a security failure,
 * and nothing here should ever be described as one — a future reader who
 * mistakes this for the boundary will start trusting it.
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
    // Absent while loading and after a failure. The administration nav appears
    // when the answer is known to be yes, never on the way to finding out —
    // an entry that materialises a second after the page settles reads as a
    // glitch, and one that vanishes reads as a permissions change.
    isAdmin: data?.user?.role === "admin",
    isPending,
    error,
  };
}

/** The same answer outside React, for a router `beforeLoad`. */
export async function readIsMoatlessAdmin(): Promise<boolean> {
  const response = await meHandler();
  if (response.status !== 200) return false;
  return response.data.user?.role === "admin";
}
