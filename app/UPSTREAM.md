# Upstream

OpenJob vendors a snapshot of OpenCode in `app/`. This file records the fork
base and every file that differs from it, so a future upstream merge can be
scoped instead of guessed.

- **Upstream:** https://github.com/anomalyco/opencode
- **Base tag:** `v1.19.3` (newest 1.x GitHub release). Upstream's default branch
  is now `dev` and its `v2.0.x` tags are the unreleased OpenCode 2 rewrite
  (`packages/cli`, `packages/session-ui`, … and no `packages/opencode`): that is
  a product migration, not a rebase, so this fork stays on the 1.x line. The
  delta `v1.18.32 → v1.19.3` added no root-level file and no top-level
  directory.
- **Vendored:** snapshot (no upstream git history is kept in this repo). The
  snapshot commit is the second parent of the vendor merge commit.
- **Internal identifiers:** `@opencode-ai/*` package names and `OPENCODE_*`
  service/env names stay as-is on purpose; only the user-visible surface is
  renamed.
- **Displayed version:** repository-root `VERSION`, read by
  `packages/opencode/script/build.ts` (`define.OPENJOB_VERSION`) and by the dev
  launcher. Release tags must equal `VERSION`, because
  `.github/workflows/release.yml` hard-fails when they disagree.

## Removed from the snapshot

Upstream docs and infrastructure that would confuse the product surface: root
`README*.md` (nested package READMEs are kept), root `AGENTS.md`,
`CONTEXT.md`, `CONTRIBUTING.md`, `SECURITY.md`, `STATS.md`, `install`,
`screenshot-uk.png`, `artifacts/`, `.github/`, `.vscode/`,
`packages/opencode/script/build-node.ts`, and `.opencode/.gitignore` plus
`.opencode/themes/.gitignore` (upstream's own ignore files would hide the
vendored `.opencode/` tree from git).

## Patched files

Paths are `app/`-relative. `(new)` = fork-only file, `(removed)` = deleted from
the snapshot.

| Area | File |
|---|---|
| Runtime dirs | `packages/core/src/global.ts` |
| Runtime flags / env isolation / auto-update off | `packages/core/src/flag/flag.ts` |
| Host directory + real-user env (new) | `packages/core/src/installation/host.ts`, `packages/core/src/installation/real-env.ts`, `packages/tui/src/util/open-external.ts` (new), `packages/tui/src/editor.ts`, `packages/tui/src/editor-zed.ts` |
| Update check (new) | `packages/core/src/installation/openjob-update.ts` |
| Version define | `packages/core/src/installation/version.ts` |
| v2 config discovery | `packages/core/src/config.ts` |
| Plugin plan path + builtin skill text | `packages/core/src/plugin/agent.ts`, `packages/core/src/plugin/skill.ts` |
| Config discovery | `packages/opencode/src/config/config.ts`, `packages/opencode/src/config/paths.ts`, `packages/opencode/src/config/tui.ts`, `packages/opencode/src/config/tui-migrate.ts` |
| Command registry (removed `/init`, `/review`) | `packages/opencode/src/command/index.ts` |
| CLI identity | `packages/opencode/src/index.ts`, `packages/opencode/src/cli/ui.ts`, `packages/opencode/src/cli/network.ts`, `packages/opencode/src/cli/cmd/tui.ts`, `packages/opencode/src/cli/error.ts` |
| CLI strings | `packages/opencode/src/cli/cmd/{attach,pr,run,providers,mcp,agent,serve,uninstall,web,debug/index,run/permission.shared,run/trace,run/variant.shared}.ts` |
| `openjob update` installer flow | `packages/opencode/src/cli/cmd/upgrade.ts` (upstream's `upgrade --major` is not adopted) |
| Misc path rename | `packages/opencode/src/agent/agent.ts`, `packages/opencode/src/session/session.ts`, `packages/opencode/src/skill/index.ts`, `packages/opencode/src/plugin/install.ts`, `packages/opencode/src/plugin/tui/runtime.ts`, `packages/opencode/src/installation/index.ts` |
| PDF pages + hidden-directory globs | `packages/opencode/src/tool/read.ts`, `packages/opencode/src/tool/read.txt`, `packages/opencode/src/tool/glob.ts`, `packages/core/src/tool/glob.ts`, `packages/core/src/ripgrep.ts` |
| Small-model fallback | `packages/opencode/src/provider/provider.ts` |
| Build | `packages/opencode/script/build.ts` (`OPENJOB_VERSION`, `openjob` binary, workspace tarball), `packages/script/src/index.ts` (`OPENJOB_VERSION`, tolerant `.github/TEAM_MEMBERS` read) |
| npm wrapper | `packages/opencode/bin/openjob` (new), `packages/opencode/package.json` |
| Dependency pins | `package.json` (keeps `packageManager: bun@1.4.2`), `packages/app/package.json` (`ghostty-web` resolved from npm instead of the upstream GitHub commit that disappeared) |
| TUI identity | `packages/tui/src/branding.ts` (new), `packages/tui/src/logo.ts`, `packages/tui/src/component/logo.tsx`, `packages/tui/src/routes/home.tsx`, `packages/tui/src/app.tsx` |
| TUI command surface | `packages/tui/src/prompt/commands.ts` (new), `packages/tui/src/component/prompt/{index,autocomplete}.tsx`, `packages/tui/src/routes/session/index.tsx`, `packages/tui/src/config/keybind.ts` |
| Built-in TUI plugins | `packages/tui/src/feature-plugins/builtins.ts` (plugin manager removed), `packages/tui/src/component/startup-loading.tsx` |
| TUI sidebar removed | `packages/tui/src/routes/session/sidebar.tsx` (removed), `packages/tui/src/feature-plugins/sidebar/*` (removed) |
| Multi-user | `packages/tui/src/util/users.ts` (new), `packages/tui/src/component/dialog-users.tsx` (new), `packages/tui/src/component/home-user-picker.tsx` (new), `packages/tui/src/component/use-user-actions.tsx` (new), `packages/tui/src/context/kv.tsx`, `packages/opencode/src/cli/cmd/tui.ts` (reopen loop + `users/.active`) |
| Multi-portal batch | `packages/tui/src/util/portal-batch.ts` (new), `packages/tui/src/routes/session/{index,permission,question}.tsx` |
| Auto-approve permission mode | `packages/tui/src/context/permission.tsx` |
| TUI spinner | `packages/tui/src/util/session-waiting.ts` (new) |
| TUI strings / theme | `packages/tui/src/attention.ts`, `packages/tui/src/component/{dialog-provider,dialog-status,error-component}.tsx`, `packages/tui/src/context/theme.tsx`, `packages/tui/src/theme/index.ts`, `packages/tui/src/feature-plugins/home/{tips-view,footer}.tsx`, `packages/tui/src/util/error.ts`, `packages/tui/src/util/presentation.ts` |
| Tests | `packages/core/test/config/config.test.ts`, `packages/core/test/location-layer.test.ts`, `packages/core/test/installation/openjob-update.test.ts` (new), `packages/opencode/test/fixture/fixture.ts`, `packages/opencode/test/permission-task.test.ts`, `packages/opencode/test/provider/provider.test.ts`, `packages/opencode/test/tool/read.test.ts`, `packages/opencode/test/tool/glob.test.ts`, `packages/opencode/test/tool/fixtures/sample.pdf` (new), `packages/opencode/test/config/config.test.ts`, `packages/opencode/test/config/tui.test.ts`, `packages/opencode/test/config/v2-compat.test.ts`, `packages/opencode/test/plugin/install.test.ts`, `packages/opencode/test/plugin/install-concurrency.test.ts`, `packages/opencode/test/plugin/trigger.test.ts`, `packages/opencode/test/plugin/workspace-adapter.test.ts`, `packages/opencode/test/cli/error.test.ts`, `packages/opencode/test/cli/tui/plugin-loader.test.ts`, `packages/opencode/test/cli/tui/plugin-toggle.test.ts`, `packages/opencode/test/cli/tui/thread.test.ts`, `packages/opencode/test/project/instance-bootstrap.test.ts`, `packages/opencode/test/server/httpapi-listen.test.ts`, `packages/opencode/test/server/httpapi-v2-pty.test.ts`, `packages/opencode/test/server/httpapi-exercise/index.ts`, `packages/opencode/test/session/prompt.test.ts`, `packages/opencode/test/session/llm-native-recorded.test.ts`, `packages/opencode/test/lib/cli-process.ts`, `packages/tui/test/app-lifecycle.test.tsx`, `packages/tui/test/theme.test.ts`, `packages/tui/test/util/users.test.ts` (new), `packages/tui/test/util/session-waiting.test.ts` (new), `packages/tui/test/util/portal-batch.test.ts` (new), `packages/tui/test/util/presentation.test.ts` (removed) |
| Fork metadata | `UPSTREAM.md` (new), `.github/TEAM_MEMBERS` (new), `bun.lock` |

## Intentional behavior differences

- Upstream's self-update machinery is vendored but **never wired**: the TUI
  updater factory (`createUpdater` in `cli/cmd/tui.ts`) is deleted, no `updater`
  is passed into `Tui.run`, `opencode.update` is denied in the palette
  (`packages/tui/src/prompt/commands.ts`), and `upgrade --major` /
  `Installation.upgradeMajor` stays unreachable from the CLI. `openjob update`
  re-runs the official installer instead. The TUI performs a once-per-version,
  notification-only version check against the OpenJob GitHub releases
  (`installation/openjob-update.ts`, toast in `app.tsx`); Source checkouts and
  preview builds never notify, and `OPENJOB_DISABLE_UPDATE_CHECK=1` turns it
  off. The same update refreshes `documents/README.md` inside every user
  workspace (`cli/cmd/upgrade.ts`): it is framework documentation, not personal
  data.
- The displayed version comes from repository-root `VERSION`; release tags must
  match it.
- `OPENCODE_DISABLE_AUTOUPDATE` is forced on.
- All inherited `OPENCODE_*` env vars are stripped at startup; `HOME` and
  `XDG_*` point into the OpenJob runtime.
- Project config stays enabled (`openjob.json`, `.openjob/`) unlike Ocarina's
  stricter isolation, because a job-search workspace is project-scoped.
- Auto-share is forced off: `config.ts` sets `autoshare: false` and turns
  `share: "auto"` into `"disabled"`. Upstream v1.19.3 removed the share/unshare
  commands itself; the palette denylist keeps those command ids unreachable
  either way.
- The TUI starts with auto-approve permission mode on
  (`packages/tui/src/context/permission.tsx`): every `permission.asked` event is
  auto-replied "once" so the job workflow runs without prompts. Explicit
  `deny` rules still apply, and the mode can be toggled off per session from
  the command palette. The `--auto`/`--yolo` flags are now redundant.
- External plugins are never loaded: the `openjob plugin` command is removed
  from the CLI (`index.ts`), `OPENCODE_PURE` is forced on for every code path
  (CLI, TUI worker, server), and the `@opencode-ai/plugin` authoring dependency
  is no longer auto-installed into config directories (`config.ts`). The
  upstream `cli/cmd/plug.ts` file stays in place for its tests but is not
  registered, and that install task still writes `opencode.json(c)` inside
  `.openjob/` (a file the fork's config discovery never reads — harmless while
  plugins cannot be loaded).
- The TUI session sidebar is removed entirely: it never renders (no auto sidebar
  on wide terminals), the `session.sidebar.toggle` command and `<leader>b`
  keybind are gone, and session content always uses the full terminal width.
  Its built-in plugins (`context`, `mcp`, `lsp`, `todo`, `files`, `footer`) are
  undeclared and deleted; the `sidebar_*` plugin slots stay in the plugin API.
- File glob searches include hidden directories (`.openjob/`, `.agents/`) and
  skip `.openjob.bak-*` framework backups. The whole OpenJob framework lives in
  hidden directories, so upstream's hidden-file exclusion made agents unable to
  find commands and skills with Glob, and a missing path could send them looking
  at the host root instead of the active user workspace.
- The built-in TUI plugin manager is removed
  (`packages/tui/src/feature-plugins/builtins.ts`), so the palette has no
  "Plugins" / "Install plugin" entries. The `feature-plugins/system/plugins.tsx`
  file stays unused, the `/status` dialog no longer shows a Plugins section
  (`component/dialog-status.tsx`), and the startup label reads "Loading
  workspace…" (`component/startup-loading.tsx`).
- The TUI supports multi-user workspaces: `users/<name>/` directories, a
  native `/users` command (list, switch, create), and a process re-exec in
  `cli/cmd/tui.ts` when a command returns `reason.type === "reopen"` (restarting
  the TUI in another directory; rebuilding the renderer in place crashes Bun).
  A bare `openjob` (or any launch inside `users/<name>`) resolves to the host
  root, never to the active user automatically; `/users` re-execs with an
  explicit directory, and always lists and creates users under the host root
  even when opened from inside a user workspace. Each user gets its own
  `.openjob` framework copy from `scaffold/openjob` (repo layout), and `users/`
  is gitignored.
- The palette's **Add job portal** action asks for portal URLs in a prompt
  dialog first (`packages/tui/src/app.tsx`). Spaces, commas, and new lines
  separate up to five portals (`packages/tui/src/util/portal-batch.ts`); each one
  gets its own session, starts on that portal instead of running the interview,
  and the session ids are remembered in kv so the sessions are treated as a
  batch. Missing model or failed session start now reports a toast instead of
  returning silently, and pasting more than five URLs reports that only the first
  five started.
- Portal sessions from that batch hide the chat composer
  (`packages/tui/src/routes/session/index.tsx`): answers go through the question
  and permission dialogs, which surface prompts from every portal session in the
  batch and can be answered from any of them.
- PDF pages are rendered to PNG for vision models when `pdftocairo` is available
  (`packages/opencode/src/tool/read.ts`).
- The built-in command palette/slash surface is trimmed via
  `packages/tui/src/prompt/commands.ts`.
- Testing note: with `OPENJOB_TRUSTED_TEST_PID` unset (the default), the fork
  strips every inherited `OPENCODE_*` variable, so `test/preload.ts`'s
  `OPENCODE_TEST_MANAGED_CONFIG_DIR`/`OPENCODE_CONFIG_CONTENT` isolation is gone
  before test modules and spawned CLI subprocesses read it. Managed-settings,
  autoshare and subprocess tests fail for that reason; they pass once the test
  process marks itself trusted (`OPENJOB_TRUSTED_TEST_PID=<test pid>`).
