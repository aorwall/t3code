# T3 Code

T3 Code is a minimal GUI for coding agents. Upstream, a Node WebSocket server wraps provider CLIs (Codex, Claude Code, Cursor, Grok, OpenCode, Antigravity) and serves web, desktop, and mobile clients.

## This fork

This is a fork of `pingdotgg/t3code`, and it ships something different from what upstream ships. **The web client here is the UI for the Moatless backend.** It speaks the same `/ws` contract, but the server on the other end is Moatless in Rust, not `apps/server`: a thread is a Moatless Task, work runs in that Task's Sandbox, and messages arrive from Slack, GitHub, Linear, Telegram and other Tasks as well as the composer.

So most of what upstream's product is built around is not this fork's product. The bundled Node server, device pairing, Clerk, T3 Connect, the Electron app, and the native mobile app all stay in the tree — we merge upstream constantly and they have to keep compiling — but none of them is a target you have to keep working. What the fork does ship:

- **Auth.** A Moatless cookie session and a fork-only `/login`. No T3 backend session exchange, no pairing.
- **Backend contract.** The client may assume only what Moatless implements. Methods it does not serve declare `UnsupportedMethodError` — see [docs/internals/client-server-contract.md](./docs/internals/client-server-contract.md).
- **Fork-only surfaces.** Sandbox lifecycle, hosted iframe preview, message-origin chips, and a surface-gating registry in `apps/web/src/fork/features.ts` that hides what the server's descriptor lists in `unsupportedSurfaces`. The same build runs against a T3 server, which lists nothing and has no `moatlessApi`, so it gets upstream's UI and pairing.
- **A browser on a phone.** Upstream's phone story is the native app; ours is `apps/web` reached from mobile Safari or Chrome, which is why the sidebar drawer and touch context menus exist.
- **CI.** Every workflow inherited from upstream is disabled in GitHub, not in the tree.

Upstream owns most files here and works in them steadily, and every line of ours inside one of their files is a conflict we pay for at each merge. So make fork changes surgically:

- **Mark every hunk in an upstream file with `// Fork:`. No exceptions.** One short line above the hunk saying why it is there — an added import, a changed condition, a new branch, an extra element in a list. This is not documentation, it is the merge's only signal: at the next upstream merge someone resolves a conflict in a file they did not write, and an unmarked hunk is indistinguishable from upstream's own code, so it gets dropped or defended by accident. Do it as you write the hunk, not in a cleanup pass.
- **Say in a fork-only file that the file is ours,** in the module's doc comment, and record its path in [docs/fork/inventory.json](./docs/fork/inventory.json) — a fork-only file nobody listed is a file the merge scripts cannot check. Which files are upstream's is a fact, not a feeling: `git cat-file -e <upstream-ref>:<path>`.
- **Reach it from upstream files through the smallest hook you can find.** A call, a gate read from `apps/web/src/fork/features.ts`, one element in a list, one optional prop — additive, and never re-indenting an upstream block, because a re-indented block turns a nearby upstream edit into a conflict.
- **Prefer a toggle to a rewrite.** Something the fork must not show gets hidden by a flag, not deleted. Something it must do differently gets a branch above upstream's, and their file keeps its name, its exports and its shape.
- **Write the delta down so it can be re-stated, not re-merged.** The inventory records behavior that must survive; the point is to reapply it on top of an upstream rewrite, not to defend our version of their file.
- **Shrink the delta when upstream catches up.** The convergence watch list says what to drop when upstream ships an equivalent.

Before merging upstream, deciding whether a file is ours or theirs, or making a change that grows the fork delta, use the project-local `fork-upstream-merge` skill. Durable ownership rules live as data in [docs/fork/inventory.json](./docs/fork/inventory.json), applied by the scripts in `.agents/skills/fork-upstream-merge/scripts/` and explained in [docs/fork/upstream-merge-inventory.md](./docs/fork/upstream-merge-inventory.md); dated decisions in [docs/fork/upstream-merge-log.md](./docs/fork/upstream-merge-log.md), and what is still missing on either side of the seam — backend methods Moatless does not serve, work this fork owes — in [docs/fork/gaps.md](./docs/fork/gaps.md).

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
- **The other clients.** `apps/desktop` wraps web, `apps/mobile` is React Native, and shared logic lives in `packages/client-runtime` — so a change there is not web-only. They are not fork targets, but they have to keep compiling for the next merge, and CI does not typecheck them: run `vp run --filter <package> typecheck` yourself on any of them you change.
- **Contracts.** Anything crossing the wire is typed in `packages/contracts`, and the implementation on the other end is Moatless. A schema change that no Moatless RPC serves is a button that returns an error.
- **Reverse states.** If you added a way in, add the way out and the way to see it. Snooze needs unsnooze, close needs reopen. A one-way door is a bug.
- **Docs.** `docs/` splits by audience: user-visible behavior in `docs/user/` (shipped-product voice, no repo tooling or source paths), architecture and contributor changes in `docs/internals/`, runbooks in `docs/operations/`, new vocabulary in `docs/internals/glossary.md`.

## Documentation

Most code changes do not need an internal documentation change. Agents can read the code.

- `docs/internals/` is for architectural decisions and their reasons, constraints that span components, and implementation traps that are hard to discover from the source. Before adding a paragraph, ask what a maintainer would get wrong without it. If reading the relevant code answers the question, leave it out.
- Do not document every feature, enumerate fields or methods, narrate control flow, maintain file catalogs, or append PR summaries. Types, tests, and code already record the implementation. The glossary defines shared vocabulary; it is not a feature index.
- A local reason the code can't show goes in a short nearby code comment. Use an internal doc when the reasoning crosses boundaries or needs context the code cannot carry well. Link to the relevant source instead of copying it.
- When a documented decision or constraint changes, rewrite or remove the affected text. Do not append another account of the new behavior. A new internal page needs a distinct, durable reason to exist.
- `docs/user/` helps users accomplish tasks. Give each major feature a concise section explaining what it does, how to start, and anything unintuitive. A settings path is useful; descriptions of visible buttons, icons, layouts, animations, or every UI state are not. Before adding text, ask what task or decision it helps the user with.
- Keep user docs in the shipped product's voice, without implementation details or contributor tooling. Update the relevant feature section when how to use it changes. A UI tweak does not need a documentation entry, and a new control does not need its own page.
- `docs/operations/` holds maintainer setup, release, and debugging procedures. Keep instructions for operating an installed T3 Code server in the user guides.

## Plans and work artifacts

- Do not commit implementation plans, research notes, or agent scratch files. Keep temporary working material outside the worktree. `.plans/` is gitignored only as a safety net for legacy tooling.
- Track active maintainer work in the GitHub issue or project item that owns it. External proposals follow `CONTRIBUTING.md` and belong in Ideas discussions.
- A merged PR is the implementation record. Close or update its tracking item when the work lands; do not preserve a second checklist in the repository.

## How it works

Clients send typed WebSocket requests. The server turns them into _commands_. The _orchestrator_ (`apps/server/src/orchestration-v2/Orchestrator.ts`) serializes commands and decides _events_ without doing any I/O. The _event sink_ commits those events, the _projections_ the UI reads, the _command receipt_, and _outbox_ effects in one transaction. The _effect worker_ then runs the effects, such as starting a provider turn or capturing a checkpoint, and feeds results back as commands. Provider CLIs run as subprocesses; per-provider _adapters_ translate their native protocols into orchestration events. Each turn ends with a _checkpoint_, a hidden git ref, so the app can diff and restore.

Architecture and its constraints: `docs/internals/overview.md`. Glossary: `docs/internals/glossary.md`
That describes `apps/server`. It is also the vocabulary the wire is written in, so it is what Moatless implements on the other side of `/ws` — read it as the contract's model, not as the code running behind the fork's client.

- `apps/server` — WebSocket, orchestration, providers, checkpointing. Effect-heavy: read [Effect services](docs/internals/effect-services.md) before adding server code, and `.repos/effect-smol/LLMS.md` for the Effect library itself. Server features are services and transports stay thin: a `ws.ts` handler, HTTP route or MCP tool decodes input, calls one service method, and maps errors.
- `apps/web` — React/Vite UI. `apps/desktop` wraps it, `apps/mobile` is React Native, `apps/marketing` is the site.
- `packages/contracts` — Effect/Schema contracts plus small derived helpers. No heavy runtime logic.
- `packages/shared` — shared runtime utils, subpath exports, no barrel.
- `packages/client-runtime` — client code shared by web and mobile.
- `.repos/` — vendored read-only references. Prefer their patterns over invented ones. Never edit or import from them; sync with `vpr sync:repos` when bumping the matching dependency. If it is missing (sparse checkout), read a file with `git show origin/main:.repos/<path>`.

Complexity belongs at the adapter boundary: orchestration stays pure, UI stays dumb.

## Dev servers

`vp i` installs. Worktrees get this from the t3.json setup script; if module resolution looks broken, it probably did not run. Setup runs in the background: while `.t3/setup-running` names a live PID, wait for it and do not run `vp i`. It ends with `.t3/setup-done` or `.t3/setup-failed` (with the error tail); with no marker at all, setup never ran here, so run `vp i` yourself. Ports derive from the worktree path and are stable across restarts, but read the real ones from the `[dev-runner]` line since occupied ports shift, and stop what you started by the PID you tracked — see rule 1. Need a second checkout? `git worktree add` it next to this worktree, not in `/tmp`, and remove it when done.

**Against Moatless**, which is what fork work usually means: point the dev proxy at a running Moatless backend and start the web app alone.

- `T3CODE_DEV_PROXY_TARGET=http://localhost:8080 pnpm dev:web`, or put `T3CODE_PROXY_TARGET_OVERRIDE` in the gitignored `.env.local` for a persistent target.
- Naming a target also forces single-origin mode, so everything stays same-origin on the Vite port. Do not work around that with `VITE_*` — see rule 3.
- Log into Moatless in the same browser first. The session is a host-scoped cookie reused across local ports; there is no pairing step and no token to hand over.
- Full setup, including the backend's Compose overlay: [docs/user/moatless-local-development.md](./docs/user/moatless-local-development.md).

**Against the bundled server**, for work in `apps/server` or anything you need upstream's runtime to exercise: `vp run dev` starts server and web. In a worktree, state defaults to that worktree's gitignored `.t3`, which deliberately outranks an ambient `T3CODE_HOME` so you cannot land on shared state by accident; an explicit `--home-dir` still wins. Here the web app does require pairing. Sharing over the tailnet is three steps: run `vp run dev --share` in the background, wait for the `pairingUrl:` line in its output, then give that full URL to an unpaired browser. Do not wire up `tailscale serve` by hand, open the URL yourself, or consume the user's pairing link. If a normal one-time token was consumed, mint a fresh one with `node apps/server/src/bin.ts pair`; it carries standard scopes, while the startup URL carries admin scopes needed for Connections settings. A browser holding the reusable dev cookie can use the bare origin: that comes from a fixed `T3CODE_DEV_AUTH_TOKEN` in the main checkout's gitignored `.env`, which the `t3.json` setup links into worktrees. Never commit or publish that token or a startup URL.

## Test data

Only for the bundled server. An empty database is a bad test. Seed your worktree's `.t3` with a copy of real data instead of pointing at live state:

- The first `vp run dev` in a worktree does this for you when its database is missing and the source is at most 500 MiB. Larger sources warn and dev starts with an empty database. `--no-seed` or `T3CODE_DEV_SEED=0` skips seeding. Manual migration still accepts larger sources and may use substantial disk space before pruning.
- Run `vp run migrate-dev-db` with your dev server stopped to refresh. It rebuilds `<worktree>/.t3/userdata/statev2.sqlite` from a read-only snapshot of `~/.t3/userdata/statev2.sqlite`, the developer's real data. It keeps recent projects and their stopped threads, and drops scheduled tasks, pending work, and auth sessions, so your dev server never runs the developer's agents. Raise `--projects` and `--threads-per-project` for more data.
- Refresh `statev2.sqlite`, not `state.sqlite`. The server copies the V1 `state.sqlite` only when `statev2.sqlite` is missing.
- Bring `secrets` and `settings.json` only if the flow under test needs them.
- Copy in, never symlink. Data flows one way: into your sandbox, never back out.

## Verifying

- Smallest proof that the change works: `vp test run <files>` for what you touched (for big files, add `-t "<name>"`), targeted lint and typecheck for the scope you changed. `vp run check:changed` runs the fast checks for changed files in one pass.
- Run `node -e` snippets from `apps/server` or the owning package. `effect` does not resolve from the repo root.
- Test meaningful logic or observable behavior. Do not render components to static markup to assert props or attributes, or add tests that merely assert callback wiring or mirror the implementation.
- **Typecheck with `tsc`, never `tsc-rs`.** Upstream's Rust port is an unofficial, vibe-coded early release whose results we do not trust; when an upstream merge reintroduces it in a `typecheck` script or a `run.tasks.typecheck` entry in a `vite.config.ts`, switch it back. See [development.md](./docs/operations/development.md).
- **Do not run repo-wide checks.** No `vp check`, no `vp run -r test`, no `vp run -r typecheck` unless asked. But know what does and does not cover you: every workflow inherited from upstream is disabled in GitHub, so CI does not run the full suite. What runs on a push to `main` is `Typecheck` (fork-only, `.github/workflows/typecheck.yml`) and `Build & push moatless-t3` — types for `apps/web` and the workspace packages it imports, the `@t3tools/contracts` tests, and a production build. **Nothing runs any other test suite anywhere but your machine**, so a behavior change is verified by the targeted `vp test run` you did or it is not verified at all.
- Regenerate `apps/web/src/routeTree.gen.ts` with `node .agents/skills/fork-upstream-merge/scripts/regen-route-tree.mjs` after adding, deleting, or renaming anything under `apps/web/src/routes/`. `@tanstack/router-plugin` only exposes the generator as a Vite plugin, so without that script the file is reachable only by starting the dev server; a stale one fails typecheck with an opaque `not assignable to keyof FileRoutesByPath`.
- Backend behavior changes ship with focused tests for that behavior.
- Proof for a bug fix depends on the bug. Logic, data, state, and protocol bugs get a failing test first (the fewest that fail on `main` for that reason, in the module's existing test file), then the fix. Purely visual bugs (spacing, colour, alignment, a layout shift) get before/after captures as their proof and no test: do not add UI tests for nitpicks, and do not ask for one in review when a capture already shows it. A server-only fix with no visible surface ships the test plus a short runtime transcript.
- The server is event-sourced, and side effects run after the command commits. In tests, drain the effect worker (`OrchestrationEffectWorkerV2.drain`) or await the specific persisted event or `Deferred` that marks the milestone. Never wait on sleeps or polling. A test that needs a timeout to pass is wrong. Concretely:
  - `it.effect` runs on a `TestClock`; `Effect.sleep` only advances through `TestClock.adjust`. `it.live` is wall-clock and only for subprocess or network fixtures.
  - No `yieldNow` or `sleep` polling loops. Await the `Deferred`, take from the `Queue`, or drain the worker.
  - No per-test timeout argument or `retry`. The project timeout is the ceiling, and flaky tests are fixed, not retried.
  - No `performance.now()` or `Date.now()` deltas. Assert on events and counts, not elapsed time.
  - Browser tests assert through `expect.element` or `vi.waitFor`, never `requestAnimationFrame` or `transitionend`.
  - `vi.mock` factories must not spread a real module that pulls in Shiki or the diff workers.
  - `it.skip` and friends need a tracking issue on the line above: `// quarantine: #1234 <why>`.
  - Lint enforces this: `t3code/no-test-timeout-or-unreasoned-skip`, `t3code/no-frame-waits-in-browser-tests`, `t3code/no-wall-clock-in-tests`, `t3code/no-real-time-wait-in-tests`, `t3code/no-polling-loop-in-tests`.
- Web browser tests are `*.browser.test.tsx` or `*.browser.test.ts` and render with `await using screen = await render(...)` from `apps/web/test/render.tsx`. `t3code/require-disposable-render` errors on the old patterns.
  - Acquire what the test drives after mounting (fake timers it advances, spies it sets up after mounting) after the render, so it disposes before the unmount. Anything the first render reads comes before it.
  - A helper that renders and then waits or clicks puts the screen in an `AsyncDisposableStack` and `move()`s it out only on success, so a failed wait still unmounts.
  - `rerender` needs a fresh element on every call.
  - No lifecycle hooks and no module-level mutable state. Shared mock state that `vi.mock` factories read is reset by a `setup()` call at the top of the test.
  - `router` is on by default. Pass `router: false` only with a one-line comment saying why.

  ```tsx
  it("saves on Enter", async () => {
    const onSave = vi.fn();
    using _now = vi.spyOn(Date, "now").mockReturnValue(0);
    await using screen = await render(<TitleEditor onSave={onSave} />, { router: "/threads/1" });
    await userEvent.type(screen.getByRole("textbox"), "Title{Enter}");
    expect(onSave).toHaveBeenCalledWith("Title");
  });
  ```

- Never drive a browser, simulator, or computer use without the developer asking for it. When they do ask for an integrated pass, use the `test-moatless-web` (web) or `test-t3-mobile` (mobile) skill, once, from the primary agent after integrating; `test-t3-app` covers only driving the Browser panel, since its pairing steps target the bundled server. Subagents do not launch their own dev servers. For an authorized mobile pass, a missing or outdated native client is an install step rather than a blocker: `vp run mobile:install <ios|android> [device-id]` on the device host before Metro installs the cached dev client for this checkout's native fingerprint, and builds only when no machine has built it yet — prefer it over `expo run:*`, `xcodebuild`, or `gradlew`.

## Evals

`evals/` checks how real models behave with T3 Code's model-facing text: agent instructions, MCP tool descriptions and schemas, and generated titles. Before you change that text, read [evals/README.md](evals/README.md) and run the evals it names. When you fix a model behavior bug, add a case that fails before the fix.

## Pull requests

- Conventional commit titles, plain language: `fix(web): new threads no longer spike CPU`.
- Body: the problem in a sentence or two, then how you fixed it. End with the model and harness that did the work.
- UI changes need before/after images; motion or timing needs a short video.
- Upload PR evidence to GitHub. Never commit PR-only screenshots or assets such as `.github/pr-assets/`.
- One concern per PR. If the description says "also", split it.
- When babysitting: poll checks and comments newer than the last push, verify each bot finding against the source, fix real ones, dismiss false positives with a written reason. Stay quiet when nothing is new, stop when the bots are green on the latest commit.

## Taste

Ambitious ideas, simple systems, software that feels obvious. Do not preserve complexity just because it already exists, and do not introduce machinery because it looks architecturally impressive. Understand the real constraint, then fight for the smallest model that makes the correct behavior unsurprising. Measure twice, cut once — and yagni.

Complexity belongs at the adapter boundary: orchestration stays pure and the UI stays dumb. Prefer inferred types to annotations, and treat `any` as the enemy. Default to no comment. Write one only for a constraint, an external quirk, or an invariant the code cannot show, in one line where you can and four at most. Comments do not restate names or signatures, narrate steps, record history, or explain the fix you just made — the PR carries that — and `t3code/no-low-value-comments` fails lint on the length cap and the mechanical cases.

Server features are services and transports stay thin: a `ws.ts` RPC handler, HTTP route, or MCP tool decodes input, calls one service method, and maps errors — see [Effect services](docs/internals/effect-services.md).

React effects are for synchronizing with something outside React. Derive in render and act in handlers instead of syncing state. `t3code/react-effect-budget` holds each file to its count in `scripts/effect-budget.json`; a new effect states its reason with `// oxlint-disable-next-line t3code/react-effect-budget -- <why>`.

Client mutations use `createEnvironmentRpcCommand`. Add a protected method to `CLIENT_GUARDED_RPC_SCOPES` in contracts, and use the command's `permissionAtom` for UI availability. Grants are checked at execution against the destination environment, and the server remains authoritative. Keep raw RPC clients inside `rpc/`, and extend the permission behavior tests when you add a protected method.

`apps/web/src/components/ui` exports own their look. Pick a `variant` or a `size`; do not restyle one with `className`. If none fits and the look is a generic concept, add a variant to the component; a look that belongs to one feature stays in that feature's own component, not in `components/ui`. Layout classes — width, flex, margin, position — belong on the parent. `shadcn/no-restyle` fails `vp lint` on violations.

Reusable Effect functions use `Effect.fn("Service.operation")` with a stable span name, not a function wrapping `Effect.gen`. Keep `Effect.gen` for inline programs and layer construction. Use `Effect.fnUntraced` only when spans would be too frequent — stream chunks, per-event projection, tight loops — or would duplicate an existing tracing boundary, and explain that choice nearby. Named `Effect.fn` creates a span; the unnamed form does not. Preserve existing span names and options, and pass combinators as additional function-builder arguments.

People drive agents through this UI all day and notice a dropped frame, a lying spinner, and a stale label. Upstream's performance discipline is worth keeping: watch what you send over the socket, how long lists render, and what the GPU is asked to paint. No continuously repainting animations — they peg the GPU on high-refresh displays.

Security matters but is not worth over-indexing on for dev-mode and maintainer-only features.

These are good defaults, not hard rules — the developer's preferences override anything here. If a rule fights the task in front of you, say so and get a human sign-off before breaking it.
