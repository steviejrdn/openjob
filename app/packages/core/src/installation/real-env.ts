import os from "node:os"
import path from "node:path"

/**
 * Environment for external programs (installers, file managers, GUI editors).
 *
 * OpenJob sandboxes `HOME`/`XDG_*` into its runtime, but external programs must
 * see the real user environment: they read their configuration (and, for the
 * installer, decide where the workspace lives) from the real home.
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
