/**
 * OpenJob's deliberately narrow command surface.
 *
 * Slash commands: only the built-in TUI slashes listed here are offered in the
 * `/` menu. Server-side commands from the workspace (`openjob.json`,
 * `.openjob/commands/`, skills) always pass through, so the job workflow keeps
 * working.
 *
 * Palette: command ids listed below stay registered (keybinds and internal
 * callers keep resolving) but never render in the command palette.
 */
export const OPENJOB_SLASH_ALLOWLIST = new Set([
  "connect",
  "provider",
  "models",
  "model",
  "mo",
  "help",
  "new",
  "clear",
  "sessions",
  "resume",
  "continue",
  "themes",
  "theme",
  "users",
  "user",
  "exit",
  "quit",
  "q",
  "status",
])

export const OPENJOB_PALETTE_DENYLIST = new Set([
  // Coding-agent surfaces that are not part of a job search.
  "agent.list",
  "agent.cycle",
  "agent.cycle.reverse",
  "mcp.list",
  "console.org.switch",
  "opencode.debug",
  "app.debug",
  "app.console",
  "app.heap_snapshot",
  "docs.open",
  "diff.open",
  "workspace.list",
  "workspace.copy_path",
  "variant.cycle",
  "variant.list",
  "prompt.editor",
  "prompt.skills",
  "workspace.set",
  "session.move",
  // Publishing / export surfaces.
  "share",
  "unshare",
  "export",
  "session.export",
  "session.share",
  "fork",
])

export function isOpenJobSlashCommand(name: string) {
  return OPENJOB_SLASH_ALLOWLIST.has(name)
}

export function isOpenJobPaletteCommand(id: string) {
  return !OPENJOB_PALETTE_DENYLIST.has(id)
}
