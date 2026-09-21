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
  re-application deltas, where the unsupported-method set comes from, and the
  reasoning behind the path policy rule. Every delta an `inventory.json` entry
  names has a section here, and `inventory-check.mjs` fails when one does not.
- **`docs/fork/upstream-merge-log.md`** — the append-only merge decision tracker.
- **`docs/fork/gaps.md`** — the register of work that is not done, on the
  Moatless backend or in this repository.

These answer different questions and do not overlap. The inventory says what the
fork decided and what a merge must carry through. The tracker says what one merge
did, on one date. The gaps register says what is still missing, and it is the
only one written for someone who is not currently merging.

## The scripts

Fork-owned. Most are dependency-free and runnable before `pnpm install`; the two
that are not say so in the table below. Run them rather than performing the
checks by hand.

| Script                    | When             | What it answers                                                                                                                                                                        |
| ------------------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `preflight.mjs`           | before merging   | the range, which inventory entries have gone stale, the files this merge will actually stop on, and the ones git resolves silently — each with its verdict attached                    |
| `install.mjs`             | before anything  | `vp install` under the heap node will not give itself, and which of the two failures it was when it fails                                                                              |
| `duplicate-adds.mjs`      | after merging    | lines both sides added that the merge kept twice — the clean-but-wrong resolution that leaves no marker behind                                                                         |
| `resolution-check.mjs`    | after resolving  | resolutions that landed as one side whole — a dropped fork delta or a dropped upstream change, in a file that may never have conflicted                                                |
| `regen-route-tree.mjs`    | after resolving  | rewrites `apps/web/src/routeTree.gen.ts`, headlessly, whenever a route file conflict leaves it stale                                                                                   |
| `verify.mjs`              | after resolving  | tripwires, contract drift, format, lint, types, the web build and tests, in one pass that does not stop at the first failure and retries a failing test package, then its failing file |
| `merge-stats.mjs`         | after committing | the tracker entry's numbers — upstream range, landed vs upstream-range file counts with the gap already explained, fork delta, and the conflict list restated with verdicts            |
| `inventory-check.mjs`     | any time         | does every inventory path still exist on the side its verdict claims                                                                                                                   |
| `tripwires.mjs`           | after merging    | deleted surfaces, re-deletions, and workflow state in GitHub                                                                                                                           |
| `unsupported-methods.mjs` | after merging    | which contract methods should declare `UnsupportedMethodError`, derived from both sides                                                                                                |

All live in `.agents/skills/fork-upstream-merge/scripts/`. `verify.mjs` runs
`duplicate-adds.mjs`, `tripwires.mjs`, `resolution-check.mjs` and
`unsupported-methods.mjs` itself, so the four are listed separately only for
running one on its own.
`regen-route-tree.mjs` and `merge-stats.mjs` are the two exceptions to
"dependency-free": both need `vp install` to have already run — the first
because it calls `@tanstack/router-generator` directly, the second because it
only makes sense once a merge commit exists.

`install.mjs` is the install those two wait on, and it is a wrapper rather than
a convenience: pnpm's resolution pass over this workspace exceeds node's default
heap on a capped sandbox and dies as a bare exit 1 whose output never says the
word memory. Use it in place of a plain `vp i` here — it runs the install under
the same derived heap `verify.mjs` gives the tests, and on a failure says
whether it ran out of memory or the manifests are actually broken. Arguments
pass through, so `install.mjs --frozen-lockfile` works.

`verify.mjs --fast` drops the test step and keeps everything else. The full pass
is about thirteen minutes and the tests are most of it, so a merge with anything
to fix pays that twice — once to find the problem, once to confirm the fix.
Iterate on `--fast`, then run the whole thing once before writing anything down.
`verify.mjs --sequential` runs that final pass one test package at a time — the
answer when a sandbox keeps getting evicted during the tests, covered under
_Verify, before writing anything down_ below.

A failing check names the `id` of the `inventory.json` entry it came from. Fix
the entry, in the same merge — a stale entry is not noise to route around, it is
the merge telling you a fork delta has lost its anchor upstream.

## Completion

Completion for an upstream merge: `preflight.mjs` is clean before merging,
conflicts are resolved by the verdicts it printed, the merge is committed as
soon as the markers are gone, `resolution-check.mjs` reports nothing landed as
one side whole, the merge diff is read against both parents and its file counts
recorded, `verify.mjs` passes or its failures are caveated, new upstream features are classified in the PR report, unsupported
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

## Delegating a merge

A merge is mostly independent work with a cached answer attached, so most of it
splits. What does not split is anything that writes to the tree: agents editing
one worktree collide, so resolutions come back as patches to apply in order, or
each agent gets its own worktree. Use Sonnet — these are read-and-report tasks
against a stated verdict, not open design.

Worth delegating:

- **Convergence validation.** Whether Moatless already does what a fork delta
  stands in for. One read of the backend per delta, independent, and the answer
  decides whether the entry retires. Confirm it against the backend source; a
  guess either keeps dead code or drops live behavior.
- **Feature classification.** The three buckets for the PR report, derived from
  the upstream commit range rather than from the conflicts — a feature that
  arrived in a cleanly merged file appears nowhere in the resolution work.
- **Gaps reconciliation.** Each unsupported or reproducible item checked against
  `docs/fork/gaps.md` to add, extend, or strike.

Conflict resolution splits **by concern, not by file**. `preflight.mjs --json`
emits the forecast already grouped that way:

```bash
node .agents/skills/fork-upstream-merge/scripts/preflight.mjs --json
```

A concern is the unit that can be decided alone. One concern regularly spans
several files whose edits depend on each other — a removed re-export in one
breaks another — so splitting by file hands one decision to two agents who
cannot see each other.

Do not delegate `verify.mjs`. Its packages already contend for one sandbox's
CPU, which is where the flaky perf and timeout failures come from; running more
of it at once makes that worse, not faster.

## Upstream Merge Procedure

### 0. Where this merge branches from

A merge branches from whatever already carries the fork's most recent upstream
merge, and that is not always `main`. One command says which case you are in:

```bash
moat gh pr list -R soaplabs/t3code --state open --json number,title,headRefName \
  --jq '.[] | select(.headRefName | startswith("merge/upstream-"))'
```

**Nothing open** — sync `main` and branch from it:

```bash
git switch main && git pull --ff-only
```

Do this every run, including in a sandbox that looks freshly cloned. A stale
`main` is not merely behind: the merge-base is behind with it, so
`preflight.mjs` forecasts a range whose earlier half has already been resolved
and merged, and the merge stops on files that are identical to upstream on the
real `main`.

**A merge PR is open** — stack on it instead of waiting for it. Branch from that
PR's head:

```bash
b=merge/upstream-2026-09-19            # the open PR's head branch
git fetch origin "+refs/heads/$b:refs/remotes/origin/$b"
git switch -c merge/upstream-$(date -u +%Y-%m-%d) "origin/$b"
```

and open this run's PR against that branch rather than `main`:

```bash
moat gh pr create --base "$b" --title … --body …
```

The open PR's merge commit is already in this branch's history, so the
merge-base has moved with it and `preflight.mjs` forecasts only what upstream
added since — its conflicts are not resolved a second time, and its fork deltas
are not re-decided. GitHub retargets the stacked PR onto `main` when the one
below it merges, so nothing needs rebasing by hand afterwards. Name the PR it
stacks on in the body, so a reviewer merges them bottom-up.

Stack on what is pushed, never on a local branch an earlier run left behind: a
new sandbox has only the pushed state, and a local-only branch makes a PR whose
base does not exist on the remote. Do not merge the open PR yourself to clear
the way — that is the same "do not merge" rule the loop prompt states, and
merging it unreviewed to unblock a later merge is the one way a bad resolution
reaches `main` with nobody having read it.

### 1. Before merging

```bash
node .agents/skills/fork-upstream-merge/scripts/preflight.mjs
```

A fresh clone has only `origin`, and this is where that surfaces: the script
refuses with the `git remote add upstream …` line to run. Expect it in a new
sandbox.

**Once that remote exists, pass `-R soaplabs/t3code` to every `gh` read.** `gh`
resolves a repository by preferring a remote named `upstream` over `origin`, so
from the moment the merge is set up, `moat gh pr checks <n>`, `pr view`, `run
list` and every other passthrough answer about `pingdotgg/t3code`. PR numbers
collide across the two repositories, so this does not error — it returns a
plausible answer about a stranger's PR. On 2026-09-15 that produced a reported
"all checks pass" for soaplabs/t3code#170 from an unrelated closed upstream PR;
the fork's PR had no checks at all. The four write operations
(`pr create`, `pr comment`, `pr reply`, `issue comment`) go through the Moatless
backend and resolve `origin` correctly, which is why everything you create lands
in the right place while only the reads are wrong.

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

**Fix the stale entries before merging.** They are what the merge resolves
against, and an entry whose path upstream has renamed out from under it is a fork
delta that this merge is about to drop with nothing to notice it. Re-point the
entry in `docs/fork/inventory.json`, then re-run.

Read the forecast before starting. The **Conflicts** list is the plan; within
it, `decide` and unlisted files are the ones that need thought and everything
else has a cached answer. Record the sweep decision in the tracker even when
there were no relevant hits.

### 2. Merge and resolve

Merge on a dated branch, which is what the PR comes from:

```bash
git switch -c merge/upstream-$(date -u +%Y-%m-%d)
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

5. **Re-derive `pnpm-lock.yaml` on every upstream merge, whether or not it
   conflicted, and commit the result.** Take upstream's copy and re-install:

   ```bash
   git checkout --theirs pnpm-lock.yaml   # only when it conflicted
   node .agents/skills/fork-upstream-merge/scripts/install.mjs
   ```

   Never hand-merge it. Upstream's lockfile does not carry the fork's own edges
   — `packages/moatless-api`, the `mermaid` tree — so upstream's copy taken
   whole fails `--frozen-lockfile` in CI, and only a real install puts them
   back.

   **The merge where it does not conflict is the dangerous one.** The verdict
   is `theirs`, so git will happily auto-merge the file to upstream's copy
   whole and say nothing; step 6's `resolution-check.mjs` exempts plain
   `theirs` paths by design; and lint, typecheck and test all pass because the
   working tree installed from the re-derived lockfile rather than the
   committed one. On 2026-09-16 that shipped a lockfile missing both fork edges
   to `main`, and CI found it at image build after the PR had merged. Step 8
   tells you to keep a _later_ `vp i` rewrite out of the `--amend`; that is
   true only once this step's result is already in the commit. Get it in first.

   `verify.mjs --only lockfile` is the two-second check that this landed.

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
   `verify.mjs` runs it again later; running it here keeps the finding from
   costing a full typecheck-and-test pass.

   A red result here means delete one copy. The three shapes that satisfy the
   rule without being that are kept out of the exit code: a copy whose exact
   text is in neither parent was written by the resolution rather than kept
   twice, a bare call statement binds no name and is reported as weak evidence,
   and a collision the rule cannot see past is declared in
   `duplicateAddExceptions` in `docs/fork/inventory.json`.

7. Check that nothing landed as one side whole:

   ```bash
   node .agents/skills/fork-upstream-merge/scripts/resolution-check.mjs
   ```

   A resolution can disappear without leaving a marker. A sandbox restart
   reverts the uncommitted working tree: a conflicted file comes back with its
   markers and is obvious, while a file edited as collateral of resolving a
   conflict elsewhere reverts in silence. This reads each path against both
   parents and reports where the result contradicts its verdict — a `converged`
   path that is byte-identical to upstream has lost its delta, and one identical
   to the fork's pre-merge copy never took upstream's change at all.

   It runs mid-merge for the same reason `duplicate-adds.mjs` does: before the
   commit exists the fix is a plain edit. It says nothing about fork-only
   (`ours`) paths — with no upstream side there is nothing to compare against,
   and the `guard` entries in the inventory are what cover those.

   It also says nothing about a file that auto-merged into something neither
   side wrote. Where upstream rewrote the condition a fork override hangs off,
   both sides' text survives, the file differs from both parents, and no rule
   here fires — the delta is intact and no longer reached. **The fork's own test
   suite is the only check that covers that**, so a merge that touches behavior
   the fork overrides is not verified until its tests have run.

8. Commit the merge as soon as the last conflict marker is gone — before
   `verify.mjs`, before the tracker entry, before anything is green. Then
   `--amend` through the rest.

   The merge commit is local until you push, so amending costs nothing, and
   everything above this line is otherwise carried in an uncommitted working
   tree for as long as verification and documentation take. In this sandbox only
   committed history and uncommitted non-gitignored changes survive a restart. A
   scratch file does not help: gitignored artifacts do not survive either.
   **A scratch ledger named `*.log` is the one that catches people** —
   `.gitignore` matches it (line 41), so a running log of the merge's decisions
   written there is outside the snapshot and a restart takes it with
   `node_modules`. Name the file `.out` or anything else git tracks.

   **Push the branch as soon as that commit exists**, and after each `--amend`.
   Committing survives a restart; it does not survive the sandbox being
   recreated from the repository, which discards anything never pushed. A merge
   redone from scratch is the most expensive thing that can happen here.

   The first push is plain. Every push after an `--amend` rewrites history and
   needs a lease, and this clone fetches only `main`:

   ```bash
   git config --get-all remote.origin.fetch
   # +refs/heads/main:refs/remotes/origin/main
   ```

   So `origin/merge/upstream-*` is never stored locally, and a bare
   `git push --force-with-lease` fails with `(stale info)` against a branch it
   has no remote-tracking ref for — on a branch nobody else is touching, which
   reads as a conflict that does not exist. Fetch the branch's own ref first and
   the lease has something true to check:

   ```bash
   b=$(git branch --show-current)
   git fetch origin "+refs/heads/$b:refs/remotes/origin/$b"
   git push --force-with-lease origin "$b"
   ```

   Do not work around it by guessing the remote SHA for an explicit
   `--force-with-lease=<ref>:<sha>` — a guessed SHA is a lease that checks
   nothing.

   Two things not to sweep into that commit:

   - **Never `git add -A` during a merge.** Stage explicit paths. A restart can
     wipe a symlink or a submodule gitlink — `.claude/skills` and
     `.repos/alchemy-effect/.vendor/alchemy` are the two that go — and `-A`
     stages those as deletions the merge appears to have made. A deletion you
     did not make is environment damage, not a resolution.
   - **Re-check `pnpm-lock.yaml`.** Step 5 resolved it, but a later `vp i` — the
     one verification needs — rewrites it again. Check it before every `--amend`
     so that rewrite is not folded into the merge commit.

   **After any interruption, run this before anything else.** A restart wipes
   `node_modules` and leaves the merge state to be re-established, and the steps
   are always these, in this order:

   ```bash
   I=.agents/skills/fork-upstream-merge/scripts/install.mjs
   node $I && git checkout -- pnpm-lock.yaml   # install, then undo the rewrite it just made
   git status                                  # merge state: mid-merge, or committed?
   git grep -n '<<<<<<<'                       # markers left behind
   node .agents/skills/fork-upstream-merge/scripts/resolution-check.mjs
   ```

   The install line is one command on purpose. The install is not optional — a
   restart leaves `node_modules` empty and every later step needs it — and it
   rewrites `pnpm-lock.yaml` every time it runs, so the restore belongs to it
   rather than to the `--amend` that comes minutes later and has to remember.
   The restore is only correct once step 5's re-derivation is committed; if it
   is not, go back and do step 5 instead.

   The last two cover the two ways a resolution disappears. A conflicted file
   comes back with its markers and `git grep` finds it; a file edited as
   collateral of resolving a conflict elsewhere reverts in silence, and only
   `resolution-check.mjs` sees that one.

9. Read what the merge actually took, against both parents:

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

One command: duplicated adds, tripwires and off-repository state, resolutions
against both parents, the unsupported-method derivation, the lockfile, format,
lint, types, the production web build, and every workspace test suite. It keeps
going after a failure and reports them together, so a formatting
nit does not hide the type errors behind it — and it raises the heap the web
suite needs, whose failure mode is otherwise an exit 137 that reads like a real
test failure.

The `build` step is there for a class of breakage nothing above it can see.
Upstream's `t3code:third-party-licenses` plugin runs in `generateBundle`, so it
is reachable only from a real `vp build`, and it hard-fails on any bundled
package whose license it cannot resolve — which is every dependency the fork
adds that upstream does not bundle. It is also the step that resolves the
module graph end to end, which is what an auto-merged import of a symbol
upstream has just made module-private needs: neither file conflicts, so nothing
earlier in the merge mentions it. Both breakages have reached `main` and been
caught by the image-build workflow, after the push and with the PR already
open. It costs about 1m20s, so `--fast` keeps it.

That heap is derived from the pod's cgroup cap, not hardcoded, and this is the
one number not to raise by hand. Node sizes its default heap from the host's
memory and never sees the cap, so `free` reporting 62GB on a 12GB pod is the
trap: a heap set to the whole cap lets one suite claim the entire budget, and
the kernel then evicts the pod rather than OOM-killing the process. An evicted
pod loses the run, the `node_modules` it installed, and the log that would have
said how far it got — strictly worse than the exit 137 the heap was raised to
avoid.

The full pass is about thirteen minutes and the test step is most of it. When
something fails, fix it and re-run `verify.mjs --fast`, which keeps every check
except the tests; run the full command again once it is green.

A test package that fails is retried alone before being reported: the packages
`pnpm test` runs share one sandbox's CPU and memory, and a merge on a loaded
machine reliably turns up a perf-budget miss or a timeout that has nothing to
do with the merge. A package that passes alone is reported `failed in the full
run, passed in isolation`, not silently green — read it, but it does not block
the merge on its own.

A package that fails that retry has its failing file run on its own before
anything is called confirmed. Dropping the other packages does not stop a
package contending with itself: `@t3tools/mobile` runs its 165 files
concurrently either way. On 2026-09-13 a highlighting test failed the full run
and the retry, passed in 1.5s as a single file, and the whole package passed on
a re-run — while the report said `Confirmed failing alone, not machine noise`,
which is the line a reader trusts to tell a regression from sandbox noise. The
step now says which of four things happened, and only the last two are red:

- `failed in the full run, passed in isolation` — the package passes once the
  others are not running.
- `Failed the retry, passed as a single file` — the package contends with
  itself. Not a merge regression.
- `Confirmed failing alone, not machine noise` — a single file failed by
  itself, and the file is named.
- `Failed the full run and the retry` with no file named — vitest printed no
  `FAIL <path>` line, so nothing could be run on its own. Re-run the package by
  hand; this is not confirmed in isolation.

`--sequential` and `--package` use the same ladder, for the same reason: one
package on its own is still its own files running concurrently.

A failing package that `docs/fork/gaps.md` already explains says so on its own
line — `known gap: <heading>`, with the predicate that decided it. The register
is where the reason lives, but it only works if you open it, and a merge reading
a red package has no cue to. So the marker is derived rather than remembered:
`verify.mjs` reads the `**Package:**` and `**Open while:**` slots out of the
register and runs the predicate, which exits nonzero only while the gap is
actually open. An entry without both slots prints nothing, so backfilling them
is incremental. **The marker does not make the step green** — a known gap is
still a failure, it just stops costing a diagnosis pass. See
_Marking a package this register already explains_ in `docs/fork/gaps.md` for
how to write the two slots.

Run this **before** the classification and documentation steps, not after them.
Its output is their input: the unsupported-method buckets are step 4's answer,
and the tripwire counts are what the tracker entry quotes. Writing three
documents and then discovering the merge dropped a delta means writing them
twice.

Re-run one check after a fix with `--only <name>`.

The test step outruns the ten-minute limit a shell call gets, which turns the
last step of a merge into a background job and a polling loop that an
interruption loses. In a Moatless sandbox, hand the whole pass to `moat cmd run`
instead. The sandbox owns the process and wakes you when it exits:

```bash
moat cmd run "node .agents/skills/fork-upstream-merge/scripts/verify.mjs"
```

Read the outcome back with `moat cmd logs <id>`, and do not poll it. Where that
CLI is absent, run the test step a package at a time:

```bash
node .agents/skills/fork-upstream-merge/scripts/verify.mjs --only test --package @t3tools/web
```

**If the sandbox has already been evicted once, switch to `--sequential`** and
stop re-running the parallel pass:

```bash
moat cmd run "node .agents/skills/fork-upstream-merge/scripts/verify.mjs --sequential"
```

The parallel test step's peak memory is what gets a loaded sandbox evicted, and
an eviction costs the whole pass — there is no partial result to keep, and the
`moat cmd` log dies with the pod, so a run that was interrupted cannot even be
read to find out how far it got. `--sequential` runs each test package alone,
which bounds that peak, keeps each phase short, and prints a
`PKG <name> PASS|FAIL` line as each package lands so a truncated log still says
what passed. It is slower when the machine can take the parallel run, and it is
the one that finishes when it cannot. The 2026-09-15 merge lost two full passes
to this before finishing sequentially.

Check `/sys/fs/cgroup/memory.max` before concluding a suite is at fault. That
merge's evictions were not the suites being heavy: the heap ceiling was
hardcoded at exactly the pod's cap, so any one of them was entitled to all of
it. `free` reports the host and will not show you this.

Reach for it on the second attempt, not the first — and do not hand-roll it as a
shell loop over `--package`. A loop that pipes each run through `tail` reports
`tail`'s exit code, which is always 0, so every package looks green including the
one that failed.

A check that is always red is a check nobody reads, so a derivation known to
report backwards is declared rather than tolerated: `unsupported-methods.mjs`
takes its exceptions from `unsupportedMethodExceptions` in
`docs/fork/inventory.json`, prints them under `KNOWN EXCEPTIONS`, and leaves
the exit code alone. `scripts.run` is the standing one. Each entry carries the
condition that retires it, and the script names an exception that has stopped
firing so it gets deleted rather than accumulating.

`duplicate-adds.mjs` reads `duplicateAddExceptions` from the same file the same
way, for the collisions its rule cannot see past. The standing one is
`packages/contracts/src/orchestration.test.ts`, where the fork's script-port
test and upstream's monogram test share a line of decode boilerplate at
different indentation: both tests are wanted, no edit is correct, and the check
compares trimmed lines. An entry names the `path` and the trimmed `line`, and
the check reports it stale when it scans that file and the line no longer
collides.

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
5. Title the PR `chore: merge upstream t3code to <short-sha>`, with no scope.
   Put the feature classification in the PR body or PR summary. Include
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
