# T3 Code

T3 Code is a minimal GUI for coding agents. Upstream, a Node WebSocket server wraps provider CLIs (Codex, Claude Code, Cursor, Grok, OpenCode) and serves web, desktop, and mobile clients.

## This fork

This is a fork of `pingdotgg/t3code`, and it ships something different from what upstream ships. **The web client here is the UI for the Moatless backend.** It speaks the same `/ws` contract, but the server on the other end is Moatless in Rust, not `apps/server`: a thread is a Moatless Task, work runs in that Task's Sandbox, and messages arrive from Slack, GitHub, Linear, Telegram and other Tasks as well as the composer.

So most of what upstream's product is built around is not this fork's product. The bundled Node server, device pairing, Clerk, T3 Connect, the Electron app, and the native mobile app all stay in the tree — we merge upstream constantly and they have to keep compiling — but none of them is a target you have to keep working. What the fork does ship:

- **Auth.** A Moatless cookie session and a fork-only `/login`. No T3 backend session exchange, no pairing.
- **Backend contract.** The client may assume only what Moatless implements. Methods it does not serve declare `UnsupportedMethodError` — see [docs/internals/client-server-contract.md](./docs/internals/client-server-contract.md).
- **Fork-only surfaces.** Thread servers and sandbox lifecycle, hosted iframe preview, message-origin chips, and a surface-gating registry in `apps/web/src/fork/` that hides what Moatless cannot serve.
- **A browser on a phone.** Upstream's phone story is the native app; ours is `apps/web` reached from mobile Safari or Chrome, which is why the sidebar drawer and touch context menus exist.
- **CI.** Every workflow inherited from upstream is disabled in GitHub, not in the tree.

Upstream owns most files here and works in them steadily, and every line of ours inside one of their files is a conflict we pay for at each merge. So make fork changes surgically:

- **Put the code somewhere upstream does not have.** `apps/web/src/fork/`, `docs/fork/`, a new module beside the upstream one. A fork-only path merges for free.
- **Reach it from upstream files through the smallest hook you can find.** A call, a gate read from `apps/web/src/fork/features.ts`, one element in a list — additive, and never re-indenting an upstream block, because a re-indented block turns a nearby upstream edit into a conflict.
- **Prefer a toggle to a rewrite.** Something the fork must not show gets hidden by a flag, not deleted. Something it must do differently gets a branch above upstream's, leaving upstream's path intact.
- **Write the delta down so it can be re-stated, not re-merged.** The inventory records behavior that must survive; the point is to reapply it on top of an upstream rewrite, not to defend our version of their file.
- **Shrink the delta when upstream catches up.** The convergence watch list says what to drop when upstream ships an equivalent.

Before merging upstream, deciding whether a file is ours or theirs, or making a change that grows the fork delta, use the project-local `fork-upstream-merge` skill. Durable ownership rules live in [docs/fork/upstream-merge-inventory.md](./docs/fork/upstream-merge-inventory.md), dated decisions in [docs/fork/upstream-merge-log.md](./docs/fork/upstream-merge-log.md).

## Words we use precisely

**Environment** is one server the client is connected to plus the machine, filesystem, provider credentials, and state it owns — here, a Moatless deployment. **Project** is an environment-local workspace record rooted at a directory. **Thread** is the durable conversation and work history for a project; against Moatless it is a Task. **Turn** is one user-to-agent cycle including follow-up work like checkpointing. **Provider** is the agent runtime on the other end. **T3 home** is the bundled server's base data directory.

Full glossary with file links: [docs/internals/glossary.md](./docs/internals/glossary.md).

## The three ways to hurt yourself

Contributions here mostly come from agents driven through T3 Code itself, often remotely, so be careful with data, dev servers, and anything else that could damage the instance the contributor is working in.

1. **Killing by pattern.** Never `pkill -f`, `pgrep | kill`, or `kill` a PID you found by matching a name, path, or worktree string. Your own agent process has this worktree's path in its argv, and this machine runs several other dev servers at once. Kill only a PID you captured at spawn, or the owner of your port from `ss -H -ltnp` after confirming `/proc/<pid>/cwd` is your worktree.
2. **Writing to the live install.** `~/.t3/userdata` is the developer's real T3 Code database, in use while you work. Reading it and copying from it are fine, and a good way to get real test data. Never start a server against it, never open it read-write, never clean it up.
3. **Baking in origins.** Never set `VITE_HTTP_URL` or `VITE_WS_URL` for dev. Dev is single-origin and Vite proxies `/api`, `/ws`, `/oauth`, and `/.well-known`. Setting them bakes localhost into the bundle and silently breaks every remote browser.

## Hit every surface

The most common defect in this repo is a change that works on the path you tested and is missing everywhere else. Before calling frontend work done, walk this list and say which entries applied:

- **Entry points.** A behavior reachable from the chat view is usually also reachable from Settings, the command palette, and a keybinding.
- **Viewports.** The fork's one client is `apps/web`, and it is used from a desktop browser and from a phone browser. A pointer-only affordance is half a feature here.
- **The other clients.** `apps/desktop` wraps web, `apps/mobile` is React Native, and shared logic lives in `packages/client-runtime` — so a change there is not web-only. They are not fork targets, but they have to keep compiling for the next merge.
- **Contracts.** Anything crossing the wire is typed in `packages/contracts`, and the implementation on the other end is Moatless. A schema change that no Moatless RPC serves is a button that returns an error.
- **Reverse states.** If you added a way in, add the way out and the way to see it. Snooze needs unsnooze, close needs reopen. A one-way door is a bug.
- **Docs.** `docs/` splits by audience: user-visible behavior in `docs/user/` (shipped-product voice, no repo tooling or source paths), architecture and contributor changes in `docs/internals/`, runbooks in `docs/operations/`, new vocabulary in `docs/internals/glossary.md`.

## How it works

Clients send typed WebSocket requests. The server turns them into _commands_, a pure _decider_ turns commands into persisted _events_, and a _projector_ derives the read model the UI renders. Provider CLIs run as subprocesses; per-provider _adapters_ translate their native protocols into orchestration events. Side effects run in queue-backed _reactors_ that emit _receipts_ when milestones land. Each turn ends with a _checkpoint_, a hidden git ref, so the app can diff and restore.

That describes `apps/server`. It is also the vocabulary the wire is written in, so it is what Moatless implements on the other side of `/ws` — read it as the contract's model, not as the code running behind the fork's client.

- `apps/server` — WebSocket, orchestration, providers, checkpointing. Effect-heavy: read `.repos/effect-smol/LLMS.md` before writing Effect code.
- `apps/web` — React/Vite UI. `apps/desktop` wraps it, `apps/mobile` is React Native, `apps/marketing` is the site.
- `packages/contracts` — Effect/Schema contracts plus small derived helpers. No heavy runtime logic.
- `packages/shared` — shared runtime utils, subpath exports, no barrel.
- `packages/client-runtime` — client code shared by web and mobile.
- `.repos/` — vendored read-only references. Prefer their patterns over invented ones. Never edit or import from them; sync with `vpr sync:repos` when bumping the matching dependency.

Complexity belongs at the adapter boundary: orchestration stays pure, UI stays dumb.

## Dev servers

`vp i` installs. Worktrees get this from the t3.json setup script; if module resolution looks broken, it probably did not run. Ports derive from the worktree path and are stable across restarts, but read the real ones from the `[dev-runner]` line since occupied ports shift, and stop what you started by the PID you tracked — see rule 1.

**Against Moatless**, which is what fork work usually means: point the dev proxy at a running Moatless backend and start the web app alone.

- `T3CODE_DEV_PROXY_TARGET=http://localhost:8080 pnpm dev:web`, or put `T3CODE_PROXY_TARGET_OVERRIDE` in the gitignored `.env.local` for a persistent target.
- Naming a target also forces single-origin mode, so everything stays same-origin on the Vite port. Do not work around that with `VITE_*` — see rule 3.
- Log into Moatless in the same browser first. The session is a host-scoped cookie reused across local ports; there is no pairing step and no token to hand over.
- Full setup, including the backend's Compose overlay: [docs/user/moatless-local-development.md](./docs/user/moatless-local-development.md).

**Against the bundled server**, for work in `apps/server` or anything you need upstream's runtime to exercise: `vp run dev` starts server and web. In a worktree, state defaults to that worktree's gitignored `.t3`, which deliberately outranks an ambient `T3CODE_HOME` so you cannot land on shared state by accident; an explicit `--home-dir` still wins. Here the web app does require pairing — hand over the pairing URL, not the bare origin. `--share` publishes over the tailnet; do not open that URL yourself, send it to the user with the pairing code included.

## Test data

Only for the bundled server. An empty database is a bad test, so seed your worktree's `.t3/userdata` with a copy of real data from `~/.t3/userdata` or `~/.t3/dev` instead of pointing at live state. Snapshot with `VACUUM INTO`, which is safe while a server has the source open and yields one consistent file:

```bash
mkdir -p .t3/userdata
rm -f .t3/userdata/state.sqlite*  # VACUUM INTO refuses to overwrite
bun -e "new (require('bun:sqlite').Database)(process.env.HOME + '/.t3/userdata/state.sqlite', { readonly: true }).run(\"VACUUM INTO '.t3/userdata/state.sqlite'\")"
```

A plain `cp` is only safe when no server has the source open, and must bring the `-wal` and `-shm` siblings along — a live file copy is a corrupt copy. Bring `secrets` and `settings.json` only if the flow under test needs them. Copy in, never symlink: data flows into your sandbox, never back out.

## Verifying

- Smallest proof that the change works: `vp test run <files>` for what you touched, targeted lint and typecheck for the scope you changed.
- **Do not run repo-wide checks.** No `vp check`, no `vp run -r test`, no `vp run -r typecheck` unless asked. CI owns the full suite.
- Backend behavior changes ship with focused tests for that behavior.
- The server is event-sourced and its async flows emit typed receipts. Wait on receipts and worker drains, never on sleeps or polling. A test that needs a timeout to pass is wrong.
- Never drive a browser, simulator, or computer use without the developer asking for it. When they do ask for an integrated pass, use the `test-t3-app` (web) or `test-t3-mobile` (mobile) skill, once, from the primary agent after integrating. Subagents do not launch their own dev servers. Both skills are upstream's and still assume the bundled server and its pairing URLs, so against Moatless take the pairing half of `test-t3-app` as stale.

## Pull requests

- Conventional commit titles, plain language: `fix(web): new threads no longer spike CPU`.
- Body: the problem in a sentence or two, then how you fixed it. End with the model and harness that did the work.
- Rebase onto latest main before opening — stale branches conflict and burn a review round.
- UI changes need before/after images; motion or timing needs a short video.
- One concern per PR. If the description says "also", split it.
- When babysitting: poll checks and comments newer than the last push, verify each bot finding against the source, fix real ones, dismiss false positives with a written reason. Stay quiet when nothing is new, stop when the bots are green on the latest commit.

## Taste

Ambitious ideas, simple systems, software that feels obvious. Do not preserve complexity just because it already exists, and do not introduce machinery because it looks architecturally impressive. Understand the real constraint, then fight for the smallest model that makes the correct behavior unsurprising. Measure twice, cut once — and yagni.

People drive agents through this UI all day and notice a dropped frame, a lying spinner, and a stale label. Upstream's performance discipline is worth keeping: watch what you send over the socket, how long lists render, and what the GPU is asked to paint. No continuously repainting animations — they peg the GPU on high-refresh displays.

Security matters but is not worth over-indexing on for dev-mode and maintainer-only features.

These are good defaults, not hard rules — the developer's preferences override anything here. If a rule fights the task in front of you, say so and get a human sign-off before breaking it.
