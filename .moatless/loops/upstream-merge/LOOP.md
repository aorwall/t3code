---
# Fork-only, and listed in docs/fork/inventory.json as `moatless-loops`.
# Moatless reads this file with `moat repos sync-config`: the frontmatter is the
# loop config, and the markdown body is the prompt every run starts from.
on: schedule
name: Upstream Merge
agentType: claude-code
model: opus
tags:
  - upstream-merge
inactiveTtlDays: 1
skills:
  - fork-upstream-merge
schedule:
  # 7 fields: sec min hour day-of-month month day-of-week year. Evaluated in UTC
  # by the runner, so `timezone` records the intent rather than shifting the fire
  # time. 04:00 is upstream's quietest hour inside the 00:00-05:00 window: over
  # the 90 days to 2026-09-08, pingdotgg/t3code `main` took 59 commits in it
  # against 92 to 135 in every other hour there, and 04:00 stayed the trough in
  # each of the three 30-day windows while upstream's rate doubled. It also
  # clears the moatless-repo schedules at 03:00 and 06:00 UTC, whose sandboxes
  # contend for the same cluster CPU that `verify.mjs` needs.
  cron: "0 0 4 * * * *"
  timezone: UTC
  message: "Merge upstream pingdotgg/t3code into the fork and open the PR."
---

# Upstream merge — take pingdotgg/t3code into the fork, open one PR

The `fork-upstream-merge` skill is loaded in this session and holds the whole
procedure. Follow it. This prompt adds what the schedule needs on top: when to
stop before starting, what this sandbox needs first, and what the run reports.

## Stop before you start

Look for a merge PR an earlier run left open:

```bash
moat gh pr list -R soaplabs/t3code --state open --json number,title,headRefName \
  --jq '.[] | select(.headRefName | startswith("merge/upstream-"))'
```

When one is open, say so in one line and stop. A second merge from the same base
drops the first one's resolutions, and a human still has to review both.

When `preflight.mjs` reports no new upstream commits, say so in one line and
stop. Nothing to merge is a normal result.

## Prepare the sandbox

A fresh clone has only `origin`, so add the remote `preflight.mjs` asks for, and
branch on the date:

```bash
git remote add upstream https://github.com/pingdotgg/t3code.git
git switch -c merge/upstream-$(date -u +%Y-%m-%d)
```

Run `vp i` before `regen-route-tree.mjs`, `merge-stats.mjs` and `verify.mjs`.
Those three need the install.

## Run the long steps as sandbox commands

`verify.mjs` runs about thirteen minutes and a shell call is killed at ten. Hand
it to the sandbox, which owns the process and wakes you when it exits:

```bash
moat cmd run "node .agents/skills/fork-upstream-merge/scripts/verify.mjs"
```

Read the outcome back with `moat cmd logs <id>`. Do not poll it, and do not
start it from a Bash call with `&`: the idle reaper stops the pod under an
unregistered process.

## Decide, never ask

Nobody watches a 04:00 schedule, so a run that stops for an answer stops until a
person finds it. Resolve each conflict with the verdict `preflight.mjs` printed
for it, and finish the run.

When a `decide` conflict has no answer you can defend from the inventory, or a
verification failure has no fix you can make, push the branch and open the PR as
a draft with `--draft`. Name what is unresolved in the body. A merge redone from
scratch is the most expensive outcome here.

## Open one PR

Title: `chore: merge upstream t3code to <short-sha>`, with no scope. Create it
with `moat gh pr create`. The body carries:

- the three summary lines `merge-stats.mjs` printed,
- each conflict and the verdict that resolved it,
- the three feature-classification buckets, each named even when empty,
- each verification failure, with the caveat the skill attaches to it,
- the model and harness that did the work.

Do not merge the PR, and do not touch a PR from an earlier run.
