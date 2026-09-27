# Upstream

OpenJob vendors a snapshot of OpenCode in `app/`. This file records the fork
base and every file that differs from it, so a future upstream merge can be
scoped instead of guessed.

- **Upstream:** https://github.com/anomalyco/opencode
- **Base tag:** `v1.18.32`
- **Vendored:** snapshot (no upstream git history is kept in this repo)
- **Internal identifiers:** `@opencode-ai/*` package names and `OPENCODE_*`
  service/env names stay as-is on purpose; only the user-visible surface is
  renamed.

## Removed from the snapshot

Upstream docs and infrastructure that would confuse the product surface:
`README*.md`, `CONTRIBUTING.md`, `AGENTS.md`, `CONTEXT.md`, `SECURITY.md`,
`STATS.md`, `screenshot-uk.png`, `artifacts/`, `.github/`, `install`.

## Patched files

| Area | File |
|---|---|
| Runtime dirs | `packages/core/src/global.ts` |
| Runtime flags / env isolation / auto-update off | `packages/core/src/flag/flag.ts` |
| v2 config discovery | `packages/core/src/config.ts` |
| Version define | `packages/core/src/installation/version.ts` |
| Plugin plan path + builtin skill text | `packages/core/src/plugin/agent.ts`, `packages/core/src/plugin/skill.ts` |
| Config discovery | `packages/opencode/src/config/config.ts`, `packages/opencode/src/config/paths.ts`, `packages/opencode/src/config/tui.ts`, `packages/opencode/src/config/tui-migrate.ts` |
| Command registry (removed `/init`, `/review`) | `packages/opencode/src/command/index.ts` |
| CLI identity | `packages/opencode/src/index.ts`, `packages/opencode/src/cli/ui.ts`, `packages/opencode/src/cli/cmd/tui.ts`, `packages/opencode/src/cli/error.ts` |
| CLI strings | `packages/opencode/src/cli/cmd/{attach,pr,run,providers,mcp,agent,debug/index,run/permission.shared,run/trace,run/variant.shared,upgrade}.ts` |
| Misc path rename | `packages/opencode/src/agent/agent.ts`, `packages/opencode/src/session/session.ts`, `packages/opencode/src/skill/index.ts`, `packages/opencode/src/plugin/install.ts`, `packages/opencode/src/plugin/tui/runtime.ts`, `packages/opencode/src/installation/index.ts` |
| Build | `packages/opencode/script/build.ts` |
| npm wrapper | `packages/opencode/bin/openjob` (new), `packages/opencode/package.json` |
| TUI identity | `packages/tui/src/branding.ts` (new), `packages/tui/src/logo.ts`, `packages/tui/src/component/logo.tsx`, `packages/tui/src/routes/home.tsx`, `packages/tui/src/app.tsx` |
| TUI command surface | `packages/tui/src/prompt/commands.ts` (new), `packages/tui/src/component/prompt/{index,autocomplete}.tsx`, `packages/tui/src/routes/session/index.tsx`, `packages/tui/src/config/keybind.ts` |
| Built-in TUI plugins | `packages/tui/src/feature-plugins/builtins.ts` (plugin manager removed), `packages/tui/src/component/startup-loading.tsx` |
| Multi-user | `packages/tui/src/util/users.ts` (new), `packages/tui/src/component/dialog-users.tsx` (new), `packages/opencode/src/cli/cmd/tui.ts` (reopen loop + `users/.active`) |
| TUI strings | `packages/tui/src/attention.ts`, `packages/tui/src/component/{dialog-provider,dialog-status,error-component}.tsx`, `packages/tui/src/context/theme.tsx`, `packages/tui/src/feature-plugins/home/tips-view.tsx`, `packages/tui/src/util/error.ts` |

## Intentional behavior differences

- `OPENCODE_DISABLE_AUTOUPDATE` is forced on; `openjob upgrade` points at the
  OpenJob installer instead of self-updating.
- All inherited `OPENCODE_*` env vars are stripped at startup; `HOME` and
  `XDG_*` point into the OpenJob runtime.
- Project config stays enabled (`openjob.json`, `.openjob/`) unlike Ocarina's
  stricter isolation, because a job-search workspace is project-scoped.
- Auto-share is forced off.
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
  registered.
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
  `resolveThreadDirectory` honors `users/.active` for bare launches. Per-user
  data is gitignored.
- The built-in command palette/slash surface is trimmed via
  `packages/tui/src/prompt/commands.ts`.
