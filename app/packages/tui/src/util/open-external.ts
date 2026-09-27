import os from "node:os"
import path from "node:path"

/**
 * Environment for external programs (file managers, GUI editors).
 *
 * OpenJob sandboxes `HOME`/`XDG_*` into its runtime, but external apps must see
 * the real user environment: Dolphin/Kate/VS Code read their configuration
 * (including the color scheme) from the real `~/.config`. Without this they
 * fall back to default themes.
 */
export function realUserEnv(): Record<string, string> {
  const home = process.env["OPENJOB_REAL_HOME"] ?? os.userInfo().homedir
  const env: Record<string, string> = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) env[key] = value
  }
  env.HOME = home
  env.XDG_CONFIG_HOME = process.env["OPENJOB_REAL_XDG_CONFIG_HOME"] ?? path.join(home, ".config")
  env.XDG_DATA_HOME = process.env["OPENJOB_REAL_XDG_DATA_HOME"] ?? path.join(home, ".local", "share")
  env.XDG_STATE_HOME = process.env["OPENJOB_REAL_XDG_STATE_HOME"] ?? path.join(home, ".local", "state")
  env.XDG_CACHE_HOME = process.env["OPENJOB_REAL_XDG_CACHE_HOME"] ?? path.join(home, ".cache")
  const runtimeDir = process.env["OPENJOB_REAL_XDG_RUNTIME_DIR"]
  if (runtimeDir) env.XDG_RUNTIME_DIR = runtimeDir
  return env
}

/** Opens a file or directory with the platform's default handler. */
export function openExternal(target: string) {
  const opener = process.platform === "darwin" ? "open" : process.platform === "win32" ? "explorer" : "xdg-open"
  return Bun.spawn([opener, target], { env: realUserEnv(), stdio: ["ignore", "ignore", "ignore"] })
}
