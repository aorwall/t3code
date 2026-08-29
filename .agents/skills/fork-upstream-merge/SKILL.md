---
name: fork-upstream-merge
description: Explicit fork upstream merge workflow for T3 Code.
disable-model-invocation: true
---

# Fork Upstream Merge

Use this skill in the T3 Code fork when merging upstream, answering whether a
file is ours or theirs, or changing code in a way that grows the fork delta.

## Where the policy lives

- **`docs/fork/inventory.json`** — the mutable source of truth, as data:
  fork-owned concerns, path policy, deleted-surface tripwires, fork inventory,
  deliberately deleted upstream paths, off-repository state, and convergence
  checks. Do not answer merge questions by reading it end to end; the scripts
  below apply it for you and print the answer beside each affected path.
- **`docs/fork/upstream-merge-inventory.md`** — the part that is not data: the
  four re-application deltas, where the unsupported-method set comes from, and
  the reasoning behind the path policy rule.
- **`docs/fork/upstream-merge-log.md`** — the append-only merge decision tracker.
- **`docs/fork/gaps.md`** — the register of work that is not done, on the
  Moatless backend or in this repository.

These answer different questions and do not overlap. The inventory says what the
fork decided and what a merge must carry through. The tracker says what one merge
did, on one date. The gaps register says what is still missing, and it is the
only one written for someone who is not currently merging.

## The scripts

Fork-owned. Most are dependency-free and runnable before `pnpm install`; the two
that are not say so in the table below. They exist because every check they run
was previously a paragraph of prose that a merge had to remember to perform, and
the two merges that skipped one paid for it mid-merge.

| Script                    | When             | What it answers                                                                                                                                                             |
| ------------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `preflight.mjs`           | before merging   | the range, which inventory entries have gone stale, the files this merge will actually stop on, and the ones git resolves silently — each with its verdict attached         |
| `duplicate-adds.mjs`      | after merging    | lines both sides added that the merge kept twice — the clean-but-wrong resolution that leaves no marker behind                                                              |
| `regen-route-tree.mjs`    | after resolving  | rewrites `apps/web/src/routeTree.gen.ts`, headlessly, whenever a route file conflict leaves it stale                                                                        |
| `verify.mjs`              | after resolving  | tripwires, contract drift, format, lint, types and tests, in one pass that does not stop at the first failure and retries a test package alone before reporting it failed   |
| `merge-stats.mjs`         | after committing | the tracker entry's numbers — upstream range, landed vs upstream-range file counts with the gap already explained, fork delta, and the conflict list restated with verdicts |
| `inventory-check.mjs`     | any time         | does every inventory path still exist on the side its verdict claims                                                                                                        |
| `tripwires.mjs`           | after merging    | deleted surfaces, re-deletions, and workflow state in GitHub                                                                                                                |
| `unsupported-methods.mjs` | after merging    | which contract methods should declare `UnsupportedMethodError`, derived from both sides                                                                                     |

All live in `.agents/skills/fork-upstream-merge/scripts/`. `verify.mjs` runs
`duplicate-adds.mjs`, `tripwires.mjs` and `unsupported-methods.mjs` itself, so
the three are listed separately only for running one on its own.
`regen-route-tree.mjs` and `merge-stats.mjs` are the two exceptions to
"dependency-free": both need `vp install` to have already run — the first
because it calls `@tanstack/router-generator` directly, the second because it
only makes sense once a merge commit exists.

`verify.mjs --fast` drops the test step and keeps everything else. The full pass
is about thirteen minutes and the tests are most of it, so a merge with anything
to fix pays that twice — once to find the problem, once to confirm the fix.
Iterate on `--fast`, then run the whole thing once before writing anything down.

A failing check names the `id` of the `inventory.json` entry it came from. Fix
the entry, in the same merge — a stale entry is not noise to route around, it is
the merge telling you a fork delta has lost its anchor upstream.

## Completion

Completion for an upstream merge: `preflight.mjs` is clean before merging,
conflicts are resolved by the verdicts it printed, the merge diff is read against
both parents and its file counts recorded, `verify.mjs` passes or its failures
are caveated, new upstream features are classified in the PR report, unsupported
Moatless methods declare `UnsupportedMethodError`, backend behavior worth
reproducing in Moatless is called out, `docs/fork/upstream-merge-log.md` has a
compact dated entry, and anything the merge found and did not do is an entry in
`docs/fork/gaps.md`.

Completion for a file ownership question: answer with the path policy verdict,
the fork-owned concern if any, and whether `docs/fork/inventory.json` needs an
update.

Completion for a fork-delta change: the implementation is done,
`docs/fork/inventory.json` has any new or changed inventory, path policy,
tripwire, or convergence entry needed for future merges,
`inventory-check.mjs` passes, and any gap the change opens or closes is written
or struck in `docs/fork/gaps.md`.

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
  conflict every merge and decide it there. The `inventory` entry names the
  behavior that must survive; it does not name a winner.
- `decide, then add an entry`: make the merge decision now and update
  `docs/fork/inventory.json` so the next merge does not rediscover
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
  `Backend behavior to consider reproducing in Moatless` is checked against the
  register. New ones are added; ones that are now served are struck.
- Strike an entry in the same change that closes it, together with the flag,
  union entry, or component it named. Do not leave a "done" entry behind.
- When a merge finds a gap that is one of several already listed under one
  heading, extend that entry rather than adding a parallel one. The register is
  a register, not a log — it has no dated sections and nothing appends to it.
- An entry that has sat unchanged across several merges is worth a sentence on
  why it has not moved, so the next reader does not re-derive the answer.

## Upstream Merge Procedure

### 1. Before merging

```bash
node .agents/skills/fork-upstream-merge/scripts/preflight.mjs
```

A fresh clone has only `origin`, and this is where that surfaces: the script
refuses with the `git remote add upstream …` line to run. Expect it in a new
sandbox.

It fetches upstream (un-shallowing the clone first, which a sandbox needs — a
shallow clone reports an empty merge-base and silently turns the whole upstream
range into "new"), then prints the range, every stale inventory entry, the
owned-concern sweep over newly added upstream files, any new upstream workflow,
and the two halves of the forecast:

- **Conflicts** — the files `git merge` will actually stop on, each with its
  verdict. This is the work. It comes from `git merge-tree`, which runs the real
  merge into a throwaway tree without touching the working tree, so it is the
  same answer the merge will give.
- **Auto-merged, worth a look** — everything else both sides touched. Git will
  resolve these without asking, and a wrong resolution here leaves no marker.

The second list used to be the whole forecast, which over-reported the work by
about 5x — 24 files for 3 real conflicts on 2026-08-29 — and made the plan
something to skim rather than read.

**Fix the stale entries before merging.** They are what the merge resolves
against, and an entry whose path upstream has renamed out from under it is a fork
delta that this merge is about to drop with nothing to notice it. Re-point the
entry in `docs/fork/inventory.json`, then re-run.

Read the forecast before starting. The **Conflicts** list is the plan; within
it, `decide` and unlisted files are the ones that need thought and everything
else has a cached answer. Record the sweep decision in the tracker even when
there were no relevant hits.

### 2. Merge and resolve

```bash
git merge upstream/main
```

1. Resolve every conflict with the verdict the forecast printed for it. An
   unlisted file falls back to the concern rules: inside a fork-owned concern it
   is `decide, then add an entry`; outside one it is `theirs`.
2. A `decide` file's `inventory.json` entry names the behavior that must
   survive; it does not name a winner. Read upstream's side and decide it there.
3. When upstream now provides a fork-built surface, prefer upstream and shrink
   the fork delta. The `convergence` entries say what to watch for.
4. If any conflict touched `apps/web/src/routes/**` — an add, a delete, a
   rename, anything that changes which files are there — regenerate the route
   tree once resolution is done:

   ```bash
   node .agents/skills/fork-upstream-merge/scripts/regen-route-tree.mjs
   ```

   It calls the same generator `vp dev` would, without starting a dev server,
   waiting for it to notice the change, and killing it by a tracked PID. A
   route-file conflict with a stale `routeTree.gen.ts` left behind is a
   typecheck failure at step 3, not a merge failure now — catch it here.

5. Resolve `pnpm-lock.yaml` by taking upstream's and re-installing —
   `git checkout --theirs pnpm-lock.yaml && vp i`. It conflicts on every merge,
   and `vp i` re-derives the fork's own edges. Never hand-merge it.

6. With everything resolved but before committing, check what git resolved on
   its own:

   ```bash
   node .agents/skills/fork-upstream-merge/scripts/duplicate-adds.mjs
   ```

   When both sides append the same line to the same list at different offsets —
   the same import, the same const, the same catalog entry — git keeps both
   copies and reports no conflict. Nothing else in the merge mentions it. This
   names those lines in about a second. It runs mid-merge on purpose: until the
   merge is committed the fix is a plain edit. It skips files whose conflicts
   are still unresolved, since those hold both sides' text by definition, which
   is why this comes after resolving rather than straight after `git merge`.
   `verify.mjs` runs it again later; running it here is what keeps the finding
   from costing a full typecheck-and-test pass, as it did on 2026-08-29.

7. Commit the merge, then read what it actually took, against both parents:

   ```bash
   node .agents/skills/fork-upstream-merge/scripts/merge-stats.mjs
   ```

   It restates `git diff --stat HEAD^1 HEAD` (upstream content that landed) and
   `git diff --stat` from the merge-base to `HEAD^2` (what upstream actually
   changed) — computed from the merge commit's own parents, nothing to have
   captured beforehand — diffs the two file lists so any gap already comes
   with which files are on which side, and prints `git diff --stat HEAD^2
HEAD` (the whole fork delta, restated against upstream). A merge that
   touched far fewer files than upstream changed is the failure this step
   exists to catch: `ours` resolutions on live upstream paths produce a clean,
   green, quiet merge that threw upstream's work away. If the gap is not
   accounted for by the conflicts you resolved, find the missing files before
   continuing. Paste the three summary lines into the tracker entry.

   The fork-delta number is also what the convergence entries are watching. If
   it grows every merge, they are not being worked.

   The same command also restates every file both sides touched since the
   merge-base, each with its path-policy verdict — the same set
   `preflight.mjs` forecast, now against what actually landed. Not every entry
   produced a `<<<<<<<` marker: git can auto-merge two unrelated additions to
   the same file (a route added on both sides, an entry appended to the same
   list) without flagging it as a conflict at all, and a file like that is
   worth a manual look even when nothing complained.

### 3. Verify, before writing anything down

```bash
node .agents/skills/fork-upstream-merge/scripts/verify.mjs
```

One command: duplicated adds, tripwires and off-repository state, the
unsupported-method derivation, format, lint, types, and every workspace test
suite. It keeps going after a failure and reports them together, so a formatting
nit does not hide the type errors behind it — and it raises the heap the web
suite needs, whose failure mode is otherwise an exit 137 that reads like a real
test failure.

The full pass is about thirteen minutes and the test step is most of it. When
something fails, fix it and re-run `verify.mjs --fast`, which keeps every check
except the tests; run the full command again once it is green. Every failure
this merge procedure has caught so far was visible without the test step.

A test package that fails is retried alone before being reported: the packages
`pnpm test` runs share one sandbox's CPU and memory, and a merge on a loaded
machine reliably turns up a perf-budget miss or a timeout that has nothing to
do with the merge. A package that passes alone is reported `flaky, passed
alone`, not silently green — read it, but it does not block the merge on its
own. A package that fails alone too keeps the step red and names it as
confirmed.

Run this **before** the classification and documentation steps, not after them.
Its output is their input: the unsupported-method buckets are step 4's answer,
and the tripwire counts are what the tracker entry quotes. Writing three
documents and then discovering the merge dropped a delta means writing them
twice.

Re-run one check after a fix with `--only <name>`.

### 4. Record what the merge found

1. Classify new upstream additions for the PR report. Include paths, methods, and
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

2. Apply the ADD and DROP buckets `verify.mjs` printed to the error unions in
   `packages/contracts/src/rpc.ts`. If the shared error type changes or is
   missing, update `packages/contracts/src/auth.ts`. Never edit these by
   intuition — both directions are findings, and a method the backend has started
   serving is a union entry to drop, not a no-op. The KEEP bucket is not a
   finding: those arms can still reach `unsupported_exit`, so they refuse
   conditionally and their union members stay.
3. Reconcile `docs/fork/gaps.md` against what the two steps above found. Add an
   entry for anything standing that is not already there, extend the entry that
   already covers it when one does, and strike anything the backend now serves —
   along with the flag or union entry that stood in for it. See The Gaps Register
   above for what an entry holds. A drift the merge deliberately did not act on
   is an entry with its reason, not a bullet in the tracker.
4. Append a compact dated tracker entry with upstream head/base, the two file
   counts from step 2, conflict decisions, owned-surface sweep decisions, and
   verification. Link the gaps entry rather than restating it.
5. Put the feature classification in the PR body or PR summary. Include
   `Usable as-is`, `Unsupported in Moatless / needs implementation`, and
   `Backend behavior to consider reproducing in Moatless`, even when a list is
   empty.

Outside a merge, update `docs/fork/inventory.json` in the same change that grows
the fork delta, and confirm with `inventory-check.mjs`. That file is the
merge-time source of truth for deliberate fork changes; a delta with no entry is
one the next merge has no reason to keep.

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
