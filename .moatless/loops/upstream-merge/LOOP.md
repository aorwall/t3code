---
# Fork-only, and listed in docs/fork/inventory.json as `moatless-loops`.
on: schedule
name: Upstream Merge
workspace: t3code
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

## Stack on an open merge PR

Look for a merge PR an earlier run left open:

```bash
moat gh pr list -R soaplabs/t3code --state open --json number,title,headRefName \
  --jq '.[] | select(.headRefName | startswith("merge/upstream-"))'
```

When one is open, stack this run on it rather than stopping: branch from its
head and open this run's PR against that branch. _Where this merge branches
from_ in the skill has the commands and the reason. Do not merge the open PR to
clear the way. When it has merged since the last run, sync `main` first — the
same section says why a stale one is not merely slower.

When `preflight.mjs` reports no new upstream commits, say so in one line and
stop. Nothing to merge is a normal result.

## Decide, never ask

Resolve each conflict with the verdict `preflight.mjs` printed for it, and
finish the run.

When a `decide` conflict has no answer you can defend from the inventory, or a
verification failure has no fix you can make, push the branch and open the PR
with `--draft`. Name what is unresolved in the body.

Do not merge the PR.
