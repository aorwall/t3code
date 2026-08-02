# Workflows in this fork

One workflow runs here. Every workflow inherited from upstream sits on disk
exactly as upstream wrote it and is switched off in GitHub's Actions settings
instead — `state: disabled_manually` on the workflow, not a change to the file.

That state lives in GitHub, not in this repository, so it does not survive a
re-fork and a clone cannot show it to you. Read it back with:

```bash
gh api repos/soaplabs/t3code/actions/workflows \
  --jq '.workflows[] | [.state, .path] | @tsv'
```

Everything except `build-moatless-t3-image.yml` must report
`disabled_manually`.

## The one that runs

| Workflow                      | Runner                                                   | What it does                                                                                                 |
| ----------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `build-moatless-t3-image.yml` | `vars.DOCKER_BUILD_RUNNER`, else `staging-runners-large` | Builds `apps/web` into a static nginx image and publishes `aorwall/moatless-t3` for the Moatless Helm chart. |

It is fork-only — upstream has no equivalent, so there is nothing for a merge to
conflict with. Pull requests build without publishing, which is also the only
place `docker/nginx.conf` is executed before it reaches a cluster. See
[`docker/README.md`](../../docker/README.md).

To publish it needs `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN` on this
repository, with write access to the `aorwall` namespace. Neither is read on the
pull request path.

Write access to the _namespace_, not to a list of repositories — the first push
has to create `aorwall/moatless-t3`, and a repository-scoped token cannot name a
repository that does not exist yet. That failure is easy to misread: `docker
login` succeeds, because logging in only proves who you are, and the job dies
later at the push with `401 Unauthorized: access token has insufficient scopes`.
It is the token's scopes, not the username, not the secret being absent.

## Runners: only self-hosted ones start here

`staging-runners-large` is an org-scoped ARC scale set defined in
[soaplabs/soap-platform-gitops](https://github.com/soaplabs/soap-platform-gitops)
under `apps/nonprod/arc-runner-large-set` — 4 CPU and 8 GiB with a DinD sidecar,
the set intended for image builds. Because it is scoped to the org rather than a
repository list, this fork can use it with nothing to configure.

It is the default here because **GitHub-hosted runners do not work in this
repository at all**. Every
`ubuntu-*` job in its history — `pr-size`, `pr-vouch`, and the first attempt at
this workflow — fails in about 30 seconds with `runner_name` empty and not one
step recorded, which is the shape of a job that was never dispatched rather than
one that ran and failed:

```bash
gh api repos/soaplabs/t3code/actions/runs/<id>/jobs \
  --jq '.jobs[] | {name, conclusion, runner_name, steps: (.steps | length)}'
```

So there are two distinct runner problems in this repository, not one:
Blacksmith labels nothing answers, and GitHub-hosted labels that are answered by
nothing either. Any workflow re-enabled here has to name a self-hosted set.

Two properties of that set are worth knowing before debugging a red run:

- **Its nodes are spot.** A job can disappear mid-step with no logs uploaded,
  which looks like a build that hung rather than one that was preempted. Re-run
  before investigating.
- **Its egress allowlist permits only 443/TCP.** Anything a build fetches over
  plain HTTP — Debian's default apt sources, for one — hangs until it times out
  instead of failing fast.

## Why the rest are disabled

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
- **GitHub-hosted runners.** `pr-size` and `pr-vouch` ask for `ubuntu-24.04`,
  and nothing answers that label here either — see the section above. They are
  also upstream's contributor automation and would not be wanted regardless:
  `pr-size` labels PRs by effective changed lines, `pr-vouch` gates external
  contributors against `.github/VOUCHED.td`, and `issue-labels` maintains
  upstream's issue label taxonomy. (An earlier version of this file put their
  failures down to that second reason alone. They never reached the code that
  would have made it true.)

The practical effect was a permanent red X on every PR from workflows that could
never have passed, and no signal from the one that mattered.

## Re-enabling

Flip the switch, no commit involved:

```bash
gh workflow enable ci.yml --repo soaplabs/t3code
```

`ci.yml` also needs a runner it can actually reach. Either install Blacksmith on
the fork, or change `runs-on: blacksmith-8vcpu-ubuntu-2404` to
`runs-on: staging-runners-large` — not to `ubuntu-24.04`, which does not start
here. The macOS job has no self-hosted equivalent and stays off either way.
Note that the second option is a fork delta on a file upstream edits often, so
it will want a row in
[the merge inventory](../../docs/fork/upstream-merge-inventory.md).

## Why switched off in GitHub rather than renamed or deleted

Deleting raises a delete/modify conflict on every upstream edit, and upstream
touched this directory 26 times in the last 60 days.

Renaming to `*.yml.disabled` avoided that — content stayed byte-identical, so
git read it as a pure rename. It also put a fork delta on all nine paths and
depended on nobody editing one enough for rename detection to stop firing.

Switching them off in GitHub costs nothing at merge time. The price is that the
state is invisible here, which is what the check at the top is for.

**A workflow upstream adds later arrives switched on.** Neither this nor the
rename covers a file that did not exist when the decision was made, and upstream
has added four in five months. The check in
[the merge inventory](../../docs/fork/upstream-merge-inventory.md) catches it.

Until CI is restored, verification is local and manual:
`pnpm typecheck && pnpm test && pnpm lint && pnpm fmt:check`. The image workflow
does not stand in for that — it proves `apps/web` builds and the nginx config
parses, and nothing about the rest of the monorepo.
