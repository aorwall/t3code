---
# Fork-only, and listed in docs/fork/inventory.json as `moatless-loops`.
on: schedule
name: Upstream Merge
workspace: T3 Code Fork
agentType: claude-code
model: opus
tags:
  - upstream-merge
inactiveTtlDays: 1
skills:
  - fork-upstream-merge
schedule:
  cron: "0 0 4 * * * *"
  timezone: UTC
  message: "Merge upstream pingdotgg/t3code into the fork and open the PR."
---

# Upstream merge — take pingdotgg/t3code into the fork, open one PR

The `fork-upstream-merge` skill is loaded in this session and holds the
procedure. This prompt says only what an unattended run changes.

## Stop before you start

Look for a merge PR an earlier run left open:

```bash
moat gh pr list -R soaplabs/t3code --state open --json number,title,headRefName \
  --jq '.[] | select(.headRefName | startswith("merge/upstream-"))'
```

When one is open, say so in one line and stop. A second merge from the same base
drops the first one's resolutions, and a person still has to review both.

When `preflight.mjs` reports no new upstream commits, say so in one line and
stop. Nothing to merge is a normal result.

## Decide, never ask

Nobody watches a 04:00 schedule, so a run that stops for an answer stops until a
person finds it. Resolve each conflict with the verdict `preflight.mjs` printed
for it, and finish the run.

When a `decide` conflict has no answer you can defend from the inventory, or a
verification failure has no fix you can make, push the branch and open the PR
with `--draft`. Name what is unresolved in the body. A merge redone from scratch
is the most expensive outcome here.

Do not merge the PR.
