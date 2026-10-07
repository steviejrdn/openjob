/**
 * OpenJob's deliberately narrow command surface.
 *
 * Slash commands: host mode is a launcher with no prompt, so it has no slash
 * commands. A user workspace keeps only the workflow shortcuts; every other
 * command lives in the ctrl+p command palette.
 *
 * Server-side commands (`.openjob/commands/`) are gated by
 * `isOpenJobServerSlashCommand`; `add-portal` is host-only and `expand` is
 * palette-only.
 *
 * Palette: command ids listed below stay registered (keybinds and internal
 * callers keep resolving) but never render in the command palette.
 */
// Host mode is a launcher (no prompt), so it has no slash commands at all. A
// user workspace keeps only the workflow shortcuts; every other command lives
// in the ctrl+p palette.
export const OPENJOB_SLASH_ALLOWLIST_HOST = new Set<string>([])
export const OPENJOB_SLASH_ALLOWLIST_USER = new Set(["new", "sessions"])

// Server commands (from `.openjob/commands`) that stay in the `/` menu inside a
// user workspace. `add-portal` is host-only; `expand` is palette-only.
export const OPENJOB_SERVER_SLASH_ALLOWLIST_USER = new Set([
  "add-template",
  "apply",
  "html-report",
  "interview",
  "outcome",
  "rank",
  "reset",
  "scrape",
  "setup",
  "upskill",
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

export function isOpenJobSlashCommand(name: string, userMode: boolean) {
  return (userMode ? OPENJOB_SLASH_ALLOWLIST_USER : OPENJOB_SLASH_ALLOWLIST_HOST).has(name)
}

export function isOpenJobServerSlashCommand(name: string, userMode: boolean) {
  return userMode && OPENJOB_SERVER_SLASH_ALLOWLIST_USER.has(name)
}

export function isOpenJobPaletteCommand(id: string) {
  return !OPENJOB_PALETTE_DENYLIST.has(id)
}
