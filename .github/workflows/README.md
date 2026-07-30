# Workflows are disabled in this fork

Every workflow here is suffixed `.disabled`. GitHub only reads `.yml`/`.yaml` in
this directory, so the suffix is all it takes — the files are otherwise
untouched.

## Why

None of them can do useful work in `soaplabs/t3code`, and their run history says
so — nine workflows, zero successful runs, ever:

| Workflow                          | Runner         | Outcome in this fork       |
| --------------------------------- | -------------- | -------------------------- |
| `ci.yml`                          | `blacksmith-*` | queued forever, never runs |
| `release.yml`                     | `blacksmith-*` | queued forever             |
| `deploy-relay.yml`                | `blacksmith-*` | queued forever             |
| `mobile-eas-preview.yml`          | `blacksmith-*` | skipped                    |
| `mobile-eas-production.yml`       | `blacksmith-*` | never triggered            |
| `mobile-showcase-screenshots.yml` | `blacksmith-*` | never triggered            |
| `pr-size.yml`                     | `ubuntu-24.04` | fails on every PR          |
| `pr-vouch.yml`                    | `ubuntu-24.04` | fails on every PR          |
| `issue-labels.yml`                | `ubuntu-24.04` | never triggered            |

Two separate causes:

- **Blacksmith runners.** Upstream runs CI on [Blacksmith](https://blacksmith.sh)
  rather than GitHub-hosted runners. This fork has no Blacksmith installation, so
  those jobs queue with no runner assigned and never start. They are not slow —
  they never run at all.
- **Upstream's contributor automation.** `pr-size` labels PRs by effective
  changed lines and `pr-vouch` gates external contributors against
  `.github/VOUCHED.td`. Both are for running a public OSS project and fail here
  before executing a single step. `issue-labels` maintains upstream's issue
  label taxonomy.

The practical effect was a permanent red X on every PR from workflows that could
never have passed, and no signal from the one that mattered.

## Re-enabling

Drop the suffix:

```bash
git mv .github/workflows/ci.yml.disabled .github/workflows/ci.yml
```

`ci.yml` also needs a runner it can actually reach. Either install Blacksmith on
the fork, or change `runs-on: blacksmith-8vcpu-ubuntu-2404` to
`runs-on: ubuntu-24.04` (and the macOS job to `macos-14`). Note that the second
option is a fork delta on a file upstream edits often, so it will want a row in
[the merge policy](../../docs/fork/upstream-merge-policy.md).

## Why renamed rather than deleted

Renaming keeps the content byte-identical, so when upstream edits one of these
files the merge follows the rename and applies the change to the `.disabled` path
instead of conflicting. Deleting them would raise a delete/modify conflict on
every upstream edit — and upstream edits `ci.yml` and `release.yml` regularly.

Until CI is restored, verification is local and manual:
`pnpm typecheck && pnpm test && pnpm lint && pnpm fmt:check`.
