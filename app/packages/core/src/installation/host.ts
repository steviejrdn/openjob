import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { Global } from "../global"

/**
 * An OpenJob host is a directory that carries the shared framework: either the
 * source layout (`scaffold/openjob`) or a user workspace (`.openjob`).
 */
export function isHostDirectory(directory: string): boolean {
  return fs.existsSync(path.join(directory, ".openjob")) || fs.existsSync(path.join(directory, "scaffold", "openjob"))
}

/**
 * Resolves the installed host workspace:
 *  1. the path recorded by the installer (`${runtime}/host`),
 *  2. `~/OpenJob` (the visible default),
 *  3. the legacy `${runtime}/workspace`.
 *
 * The real home comes from the OS user database because OpenJob overrides
 * `$HOME` to its runtime sandbox.
 */
export function hostDirectory(): string | undefined {
  try {
    const recorded = fs.readFileSync(path.join(Global.Path.runtime, "host"), "utf8").trim()
    if (recorded && isHostDirectory(recorded)) return recorded
  } catch {
    // no marker (source checkout or a pre-0.1.3 install)
  }
  const visible = path.join(os.userInfo().homedir, "OpenJob")
  if (isHostDirectory(visible)) return visible
  const legacy = path.join(Global.Path.runtime, "workspace")
  if (isHostDirectory(legacy)) return legacy
  return undefined
}
