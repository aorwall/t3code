---
name: fork-upstream-merge
description: Explicit fork upstream merge workflow for T3 Code.
disable-model-invocation: true
---

# Fork Upstream Merge

Use this skill in the T3 Code fork when merging upstream, answering whether a
file is ours or theirs, or changing code in a way that grows the fork delta.

Before taking merge or ownership actions, read
`docs/fork/upstream-merge-inventory.md`. Treat it as the mutable source of truth
for fork-owned concerns, path policy, deleted-surface tripwires, fork inventory,
and convergence checks. Treat `docs/fork/upstream-merge-log.md` as the
append-only merge decision tracker.

Completion for an upstream merge: conflicts are resolved by
`docs/fork/upstream-merge-inventory.md`, deleted-surface tripwires are checked,
newly added upstream files in owned concerns are swept, convergence is checked,
new upstream features are classified in the PR report, unsupported Moatless
methods declare `UnsupportedMethodError`, backend behavior worth reproducing in
Moatless is called out, verification is run or caveated, and
`docs/fork/upstream-merge-log.md` has a compact dated entry.

Completion for a file ownership question: answer with the path policy, the
fork-owned concern if any, and whether the policy or inventory needs an update.

Completion for a fork-delta change: the implementation is done, and
`docs/fork/upstream-merge-inventory.md` has any new or changed inventory, path
policy, tripwire, or convergence rule needed for future merges.

## Policy Meanings

- `ours`: take the fork side wholesale.
- `theirs`: take upstream wholesale.
- `theirs, verbatim`: take upstream exactly and investigate why a fork delta
  reappeared.
- `converged`: take upstream wholesale, then re-apply only the listed fork
  deltas.
- `decide, then add a row`: make the merge decision now and update
  `docs/fork/upstream-merge-inventory.md` so the next merge does not rediscover
  it.

## Upstream Merge Procedure

Run from the repository root:

```bash
git fetch upstream
UPSTREAM_BASE="$(git merge-base HEAD upstream/main)"
git merge upstream/main
```

Then:

1. Resolve every conflict with the inventory doc's Path Policy.
2. Run every Deleted Surface tripwire from the inventory doc. A `removed` surface
   must return no matches. A `decided, not yet removed` surface may have known
   existing matches; reject or explicitly accept new upstream additions.
3. Sweep newly added upstream files in fork-owned concerns:

   ```bash
   git diff --diff-filter=A --name-only \
     "$UPSTREAM_BASE..upstream/main" -- ':(exclude).repos' \
     | grep -Ei 'auth|pair|session|clerk|cloud|relay|connect|proxy|origin|host'
   ```

   Decide each relevant hit against the inventory doc's Fork-Owned Concerns.
   Record the decision in `docs/fork/upstream-merge-log.md`, including when the
   sweep had no relevant hits. Widen the inventory doc's filter when a concern
   grows vocabulary not covered by the pattern.
4. Check every conflicting path against the inventory doc's Fork Inventory before
   taking upstream. If a path is listed there, preserve or intentionally drop the
   fork delta.
5. Check the inventory doc's Convergence Watch List. When upstream now provides a
   fork-built surface, prefer upstream and shrink the fork delta.
6. Classify new upstream additions for the PR report:
   - `Usable as-is`: features the fork can expose without Moatless backend or
     deployment work.
   - `Unsupported in Moatless`: features whose client, contract, HTTP, RPC,
     auth, cloud, relay, pairing, or runtime assumptions need Moatless
     implementation before use.
   - `Backend behavior to consider reproducing in Moatless`: upstream server,
     runtime, orchestration, lifecycle, VCS, provider, update, settlement, or
     background-task behavior that would improve Moatless even when the fork
     cannot use the upstream implementation directly.
   Include paths, methods, and short implementation notes for unsupported and
   reproducible-backend items. For example, a new upstream auto-settle rule such
   as keeping threads with open PRs unsettled belongs in the reproducible-backend
   bucket if Moatless owns settlement.
7. For each newly unsupported WebSocket method, add `UnsupportedMethodError` to
   that method's error union in `packages/contracts/src/rpc.ts`. If the shared
   error type changes or is missing, update `packages/contracts/src/auth.ts`.
   Derive the unsupported set from contract WebSocket methods minus the Moatless
   backend dispatch arms instead of editing by intuition.
8. Run `pnpm typecheck && pnpm test && pnpm lint && pnpm fmt:check`, or record
   the exact skipped or failing checks in the tracker.
9. Append a compact dated tracker entry with upstream head/base, conflict
   decisions, owned-surface sweep decisions, and verification.
10. Put the feature classification in the PR body or PR summary. Include
    `Usable as-is`, `Unsupported in Moatless / needs implementation`, and
    `Backend behavior to consider reproducing in Moatless`, even when a list is
    empty.

Outside a merge, update `docs/fork/upstream-merge-inventory.md` in the same
change that grows the fork delta. The docs inventory is the merge-time source of
truth for deliberate fork changes.

## Stable Fork Rules

Surface gates must be additive: no new prop threading, effects, state, or
re-indentation of upstream JSX. Place gates at filters or existing decision
points when possible.

Keep unsupported-method declarations honest in both directions: a method that
gains a Moatless implementation loses its `UnsupportedMethodError` union entry
in the same change, and a method dropped by the backend gains one.
