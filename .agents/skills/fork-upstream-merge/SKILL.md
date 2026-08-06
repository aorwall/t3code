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
append-only merge decision tracker, and `docs/fork/gaps.md` as the register of
work that is not done — on the Moatless backend or in this repository.

The three answer different questions and do not overlap. The inventory says what
the fork decided and what a merge must carry through. The tracker says what one
merge did, on one date. The gaps register says what is still missing, and it is
the only one written for someone who is not currently merging.

Completion for an upstream merge: conflicts are resolved by
`docs/fork/upstream-merge-inventory.md`, deleted-surface tripwires are checked,
newly added upstream files in owned concerns are swept, convergence is checked,
the merge diff is read against both parents and its file counts recorded,
new upstream features are classified in the PR report, unsupported Moatless
methods declare `UnsupportedMethodError`, backend behavior worth reproducing in
Moatless is called out, verification is run or caveated,
`docs/fork/upstream-merge-log.md` has a compact dated entry, and anything the
merge found and did not do is an entry in `docs/fork/gaps.md`.

Completion for a file ownership question: answer with the path policy, the
fork-owned concern if any, and whether the policy or inventory needs an update.

Completion for a fork-delta change: the implementation is done,
`docs/fork/upstream-merge-inventory.md` has any new or changed inventory, path
policy, tripwire, or convergence rule needed for future merges, and any gap the
change opens or closes is written or struck in `docs/fork/gaps.md`.

## Policy Meanings

- `ours`: take the fork side wholesale. Legitimate only when the path does not
  exist in `upstream/main`. On a path upstream still owns, a blanket `ours`
  discards every upstream change to it, merge after merge, and reports nothing.
- `theirs`: take upstream wholesale.
- `theirs, verbatim`: take upstream exactly and investigate why a fork delta
  reappeared.
- `converged`: take upstream wholesale, then re-apply only the listed fork
  deltas. The listed delta describes what must survive; it is not a patch to
  replay. If upstream restructured the file so the delta no longer has an
  anchor, the entry is stale: resolve as `decide` and rewrite the entry in the
  same merge.
- `decide`: the fork changed a file upstream still owns, and upstream changes to
  it are still wanted. There is no cached verdict. Read upstream's side of the
  conflict every merge and decide it there. The Fork Inventory entry names the
  behavior that must survive; it does not name a winner.
- `decide, then add an entry`: make the merge decision now and update
  `docs/fork/upstream-merge-inventory.md` so the next merge does not rediscover
  it.

## The Gaps Register

`docs/fork/gaps.md` has two halves — what Moatless does not serve, and what this
repository owes independently of it. Every entry is one thing that is not done,
under whichever half owns the fix.

A gap earns an entry when it is **standing**: something a future merge, or the
next person to touch the surface, will hit again. A one-merge annoyance goes in
the tracker entry and nowhere else.

Each entry carries four things, in prose rather than fields:

1. **What is missing**, named concretely — the RPC method, the capability, the
   suppressed rule. Not "settings are incomplete".
2. **What it costs**, in terms of what a person can and cannot do. A reader
   deciding whether to pick the gap up is deciding against this line.
3. **What holds it open here** — the `FEATURES` flag, the
   `UnsupportedMethodError` union entry, the fork-only component. This is the
   part that makes the gap actionable rather than a complaint.
4. **The check that closes it**, and what to delete here when it passes.

The fourth is the point of the file. The last commit of a backend feature is the
one that removes its stand-in on this side: a flag left at `true` gates nothing
and costs a conflict every time upstream edits the code around it, and a union
entry for a method the backend now serves declares a refusal that can never
fire. An entry that does not say what to delete will not be finished.

Write a check that recomputes rather than one that compares against the file. A
count or a list in the register is a snapshot for orientation, and the tripwire,
`git grep`, or derivation beside it is what is authoritative.

### Maintaining it

- Every gap the merge classified as `Unsupported in Moatless` or
  `Backend behavior to consider reproducing in Moatless` in step 7 is checked
  against the register. New ones are added; ones that are now served are struck.
- Strike an entry in the same change that closes it, together with the flag,
  union entry, or component it named. Do not leave a "done" entry behind.
- When a merge finds a gap that is one of several already listed under one
  heading, extend that entry rather than adding a parallel one. The register is
  a register, not a log — it has no dated sections and nothing appends to it.
- An entry that has sat unchanged across several merges is worth a sentence on
  why it has not moved, so the next reader does not re-derive the answer.

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
   existing matches; reject or explicitly accept new upstream additions. Run the
   inventory doc's Off-repository state checks in the same pass — a merge cannot
   see state that lives in GitHub, so nothing else will catch it.
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
6. Read what the merge actually took, against both parents:

   ```bash
   git diff --stat HEAD^1 HEAD   # upstream content that landed on the fork
   git diff --stat HEAD^2 HEAD   # the whole fork delta, restated against upstream
   ```

   Compare the first against `git diff --stat "$UPSTREAM_BASE..upstream/main"`.
   A merge that touched far fewer files than upstream changed is the failure this
   step exists to catch: `ours` resolutions on live upstream paths produce a
   clean, green, quiet merge that threw upstream's work away. Record both file
   counts in the tracker entry. If the gap is not accounted for by the conflicts
   you resolved, find the missing files before continuing.

   The second number is the fork delta. If it grows every merge, the Convergence
   Watch List is not being worked.

7. Classify new upstream additions for the PR report. Include paths, methods, and
   short implementation notes for unsupported and reproducible-backend items. For
   example, a new upstream auto-settle rule such as keeping threads with open PRs
   unsettled belongs in the reproducible-backend bucket if Moatless owns
   settlement.

   - `Usable as-is`: features the fork can expose without Moatless backend or
     deployment work.
   - `Unsupported in Moatless`: features whose client, contract, HTTP, RPC,
     auth, cloud, relay, pairing, or runtime assumptions need Moatless
     implementation before use.
   - `Backend behavior to consider reproducing in Moatless`: upstream server,
     runtime, orchestration, lifecycle, VCS, provider, update, settlement, or
     background-task behavior that would improve Moatless even when the fork
     cannot use the upstream implementation directly.

   The second and third buckets are the input to the next step. The first is
   not: a feature the fork can already expose has no gap to record.

8. For each newly unsupported WebSocket method, add `UnsupportedMethodError` to
   that method's error union in `packages/contracts/src/rpc.ts`. If the shared
   error type changes or is missing, update `packages/contracts/src/auth.ts`.
   Derive the unsupported set from contract WebSocket methods minus the Moatless
   backend dispatch arms instead of editing by intuition. The derivation runs in
   both directions and both directions are findings: a method the backend has
   started serving is a union entry to drop, not a no-op.
9. Reconcile `docs/fork/gaps.md` against what steps 7 and 8 found. Add an entry
   for anything standing that is not already there, extend the entry that
   already covers it when one does, and strike anything the backend now serves —
   along with the flag or union entry that stood in for it. See The Gaps Register
   above for what an entry holds. A drift the merge deliberately did not act on
   is an entry with its reason, not a bullet in the tracker.
10. Run `pnpm typecheck && pnpm test && pnpm lint && pnpm fmt:check`, or record
    the exact skipped or failing checks in the tracker.
11. Append a compact dated tracker entry with upstream head/base, the two file
    counts from step 6, conflict decisions, owned-surface sweep decisions, and
    verification. Link the gaps entry rather than restating it.
12. Put the feature classification in the PR body or PR summary. Include
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

Nothing in this fork stands in for a backend feature silently. A surface the
backend cannot serve is a `FEATURES` flag, a method it does not dispatch is a
union entry, and both are named in `docs/fork/gaps.md` with the check that
retires them. A stand-in with no entry is indistinguishable from a decision the
fork made on purpose, and the next merge will treat it as one.

Land upstream with a merge commit. A cherry-pick moves the code without moving
the merge base, so the next merge replays commits that are already in,
re-conflicts files already identical to upstream, and reports file counts that
do not reconcile until someone works out why by hand.
