/**
 * Fork-only. What the fork dialog's three controls resolve to on the wire —
 * kept apart from the dialog component so the resolution rule (branch only
 * ever travels with an isolated checkout, an empty message means idle) is
 * unit-testable without rendering anything.
 */

/** The fork dialog's own draft state, before resolving to a submission. */
export interface ThreadForkDialogDraft {
  readonly sameSandbox: boolean;
  readonly message: string;
  readonly branch: string;
}

/** The fields a fork submission carries once resolved from the draft. */
export interface ThreadForkSubmission {
  readonly sameSandbox: boolean;
  readonly message?: string;
  readonly branch?: string;
}

/**
 * `branch` cannot be set with `sameSandbox` — the fork shares one working
 * tree (`TaskForkService::validate_checkout` in the Moatless backend) — so a
 * same-sandbox draft drops the branch field outright rather than relying on
 * the input staying disabled. Blank text in either field means "not set", the
 * same convention the source thread's create form uses.
 */
export function resolveThreadForkSubmission(draft: ThreadForkDialogDraft): ThreadForkSubmission {
  const message = draft.message.trim();
  const branch = draft.sameSandbox ? "" : draft.branch.trim();
  return {
    sameSandbox: draft.sameSandbox,
    ...(message.length > 0 ? { message } : {}),
    ...(branch.length > 0 ? { branch } : {}),
  };
}
