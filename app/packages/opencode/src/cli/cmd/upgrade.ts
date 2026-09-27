import type { Argv } from "yargs"
import path from "path"
import { existsSync, readdirSync } from "node:fs"
import { cp, mkdir } from "node:fs/promises"
import { Flag } from "@opencode-ai/core/flag/flag"
import { hostDirectory } from "@opencode-ai/core/installation/host"
import { realUserEnv } from "@opencode-ai/core/installation/real-env"
import { OpenJobVersion } from "@opencode-ai/core/installation/version"
import { checkOpenJobUpdate } from "@opencode-ai/core/installation/openjob-update"
import { UI } from "../ui"

const INSTALLER_URL =
  process.env["OPENJOB_INSTALLER_URL"] ?? "https://raw.githubusercontent.com/steviejrdn/openjob/main/scripts/install"
const INSTALLER_PS1_URL =
  process.env["OPENJOB_INSTALLER_URL_PS1"] ??
  "https://raw.githubusercontent.com/steviejrdn/openjob/main/scripts/install.ps1"

// Framework-owned paths refreshed inside every existing user workspace. The
// personal files (01-07, search-queries.md, AGENTS.md, cv/, documents/, ...)
// are deliberately not in this list.
const FRAMEWORK_FILES = [
  "commands",
  "agents",
  "openjob.json",
  "skills/job-application-assistant/SKILL.md",
  "skills/job-application-assistant/08-application-forms.md",
  "skills/job-application-assistant/09-web-research.md",
  "skills/job-scraper/SKILL.md",
  "skills/upskill/SKILL.md",
]

async function refreshUserFrameworks() {
  const workspace = hostDirectory()
  if (!workspace) return
  const users = path.join(workspace, "users")
  const source = path.join(workspace, "scaffold", "openjob")
  if (!existsSync(users) || !existsSync(source)) return

  const names = readdirSync(users, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
  for (const name of names) {
    const target = path.join(users, name, ".openjob")
    if (!existsSync(target)) continue
    const backup = path.join(users, name, `.openjob.bak-${OpenJobVersion}`)
    await cp(target, backup, { recursive: true, force: true }).catch(() => {})
    for (const entry of FRAMEWORK_FILES) {
      const from = path.join(source, entry)
      if (!existsSync(from)) continue
      const to = path.join(target, entry)
      await mkdir(path.dirname(to), { recursive: true })
      await cp(from, to, { recursive: true, force: true }).catch(() => {})
    }
    const salary = path.join(workspace, "scaffold", "salary_lookup.py")
    if (existsSync(salary)) await cp(salary, path.join(users, name, "salary_lookup.py"), { force: true }).catch(() => {})
    UI.println(`  Refreshed framework for ${name} (backup: .openjob.bak-${OpenJobVersion})`)
  }
}

export const UpgradeCommand = {
  command: "update [target]",
  aliases: ["upgrade"],
  describe: "update OpenJob to the latest release (re-runs the installer)",
  builder: (yargs: Argv) => {
    return yargs
      .positional("target", {
        describe: "version to update to, for ex '0.1.1' or 'v0.1.1'",
        type: "string",
      })
      .option("check", {
        describe: "only check the current and latest version",
        type: "boolean",
        default: false,
      })
      .option("no-framework", {
        describe: "do not refresh the per-user framework copies",
        type: "boolean",
        default: false,
      })
  },
  handler: async (args: { target?: string; check?: boolean; "no-framework"?: boolean }) => {
    UI.empty()
    UI.println(UI.logo("  "))
    UI.empty()

    const check = await checkOpenJobUpdate({ force: true })
    UI.println(`  current: v${check.current}   latest: ${check.latest ? `v${check.latest}` : "unknown"}`)
    UI.empty()

    if (args.check) {
      UI.println(check.updateAvailable ? "  Update available. Run: openjob update" : "  OpenJob is up to date.")
      return
    }

    const target = args.target?.replace(/^v/, "") ?? "latest"

    if (process.platform === "win32") {
      // Windows locks the running executable, so the installer cannot replace
      // it in place. Point at the PowerShell installer instead.
      UI.println("  OpenJob cannot replace its own running .exe on Windows.")
      UI.println("  Re-run the installer in PowerShell:")
      UI.empty()
      UI.println(
        `  powershell -ExecutionPolicy Bypass -Command "curl.exe -fsSL ${INSTALLER_PS1_URL} -o $env:TEMP\\install-openjob.ps1; & $env:TEMP\\install-openjob.ps1"`,
      )
      UI.empty()
      return
    }

    UI.println(`  Updating to ${target === "latest" ? "latest" : `v${target}`}…`)
    UI.empty()

    const env = realUserEnv()
    env.OPENJOB_VERSION = target
    env.OPENJOB_INSTALL_DIR = path.dirname(process.execPath)
    if (Flag.OPENJOB_RUNTIME_DIR) env.OPENJOB_RUNTIME_DIR = Flag.OPENJOB_RUNTIME_DIR
    // Refresh the same host the user is running from, so a sandboxed HOME can
    // never relocate the workspace.
    const host = hostDirectory()
    if (host) env.OPENJOB_HOST_DIR = host

    const child = Bun.spawn(["bash", "-c", `curl -fsSL ${INSTALLER_URL} | bash`], {
      env,
      stdin: "inherit",
      stdout: "inherit",
      stderr: "inherit",
    })
    const code = await child.exited

    if (code !== 0) {
      UI.error("Update failed. Re-run the installer manually:")
      UI.empty()
      UI.println(`  curl -fsSL ${INSTALLER_URL} | bash`)
      process.exitCode = 1
      return
    }

    if (!args["no-framework"]) await refreshUserFrameworks()

    UI.empty()
    UI.println("  Update complete. Restart openjob to use the new version.")
    UI.empty()
  },
}
