import { describe, expect, test } from "bun:test"
import { Effect } from "effect"
import fs from "fs/promises"
import path from "path"
import yargs from "yargs"
import { tmpdir } from "../../fixture/fixture"
import { TuiThreadCommand, resolveThreadDirectory } from "../../../src/cli/cmd/tui"
import { cliIt } from "../../lib/cli-process"

describe("tui thread", () => {
  test("loads the TUI integration lazily", async () => {
    const source = await Bun.file(new URL("../../../src/cli/cmd/tui.ts", import.meta.url)).text()

    expect(source).toContain('await import("../tui/layer")')
    expect(source).toMatch(/await import\(["']@\/plugin\/tui\/runtime["']\)/)
    expect(source).not.toContain('import("./app")')
  })

  test("forwards the CLI environment to the TUI worker", async () => {
    const source = await Bun.file(new URL("../../../src/cli/cmd/tui.ts", import.meta.url)).text()

    expect(source).toMatch(/new Worker\(file, \{\s*env: Object\.fromEntries\(\s*Object\.entries\(process\.env\)/)
  })

  async function check(project?: string) {
    await using tmp = await tmpdir({
      git: true,
      init: async (dir) => {
        await fs.mkdir(path.join(dir, "scaffold", "openjob"), { recursive: true })
      },
    })
    const link = path.join(path.dirname(tmp.path), path.basename(tmp.path) + "-link")
    const type = process.platform === "win32" ? "junction" : "dir"

    try {
      await fs.symlink(tmp.path, link, type)
      expect(resolveThreadDirectory(project, link, tmp.path)).toBe(tmp.path)
    } finally {
      await fs.rm(link, { recursive: true, force: true }).catch(() => undefined)
    }
  }

  test("uses the real cwd when PWD points at a symlink", async () => {
    await check()
  })

  test("uses the real cwd after resolving a relative project from PWD", async () => {
    await check(".")
  })

  test("resolves a relative mini project from PWD when cwd differs", async () => {
    await using pwd = await tmpdir({ git: true })
    await using cwd = await tmpdir({
      git: true,
      init: async (dir) => {
        await fs.mkdir(path.join(dir, "scaffold", "openjob"), { recursive: true })
      },
    })

    expect(resolveThreadDirectory(".", pwd.path, cwd.path)).toBe(pwd.path)
    expect(resolveThreadDirectory(undefined, pwd.path, cwd.path)).toBe(cwd.path)
  })

  test("bare launches resolve to the host root, never the active user", async () => {
    await using tmp = await tmpdir({
      init: async (dir) => {
        await fs.mkdir(path.join(dir, "scaffold", "openjob"), { recursive: true })
        await fs.mkdir(path.join(dir, "users", "salma", ".openjob"), { recursive: true })
        await fs.writeFile(path.join(dir, "users", ".active"), "salma\n")
      },
    })

    expect(resolveThreadDirectory(undefined, tmp.path, tmp.path)).toBe(tmp.path)
  })

  test("a launch inside a user workspace resolves to the host root", async () => {
    await using tmp = await tmpdir({
      init: async (dir) => {
        await fs.mkdir(path.join(dir, "scaffold", "openjob"), { recursive: true })
        await fs.mkdir(path.join(dir, "users", "salma", ".openjob"), { recursive: true })
      },
    })
    const user = path.join(tmp.path, "users", "salma")

    expect(resolveThreadDirectory(undefined, user, user)).toBe(tmp.path)
  })

  test("an explicit project still opens the given directory", async () => {
    await using tmp = await tmpdir({
      init: async (dir) => {
        await fs.mkdir(path.join(dir, "scaffold", "openjob"), { recursive: true })
        await fs.mkdir(path.join(dir, "users", "salma", ".openjob"), { recursive: true })
      },
    })
    const user = path.join(tmp.path, "users", "salma")

    expect(resolveThreadDirectory(path.join("users", "salma"), tmp.path, tmp.path)).toBe(user)
    expect(resolveThreadDirectory(user, tmp.path, tmp.path)).toBe(user)
  })

  test("parses supported --no-replay forms", async () => {
    for (const option of ["--no-replay", "--no-replay=true", "--noReplay"]) {
      const args = await yargs([])
        .command({ ...TuiThreadCommand, handler: () => {} })
        .exitProcess(false)
        .parse(["--mini", option, "--replay-limit", "10"])

      expect(args.replay === false || args.noReplay === true).toBe(true)
      expect(args.replayLimit).toBe(10)
    }
  })

  test("preserves boolean negation for existing options", async () => {
    const args = await yargs([])
      .command({ ...TuiThreadCommand, handler: () => {} })
      .exitProcess(false)
      .parse(["--mdns", "--no-mdns"])

    expect(args.mdns).toBe(false)
  })

  cliIt.live("rejects mini-only options without --mini", ({ opencode }) =>
    Effect.gen(function* () {
      const result = yield* opencode.spawn(["--replay-limit", "10"])

      opencode.expectExit(result, 1)
      expect(result.stderr).toContain("--replay-limit requires --mini")
    }),
  )

  cliIt.live("routes attached sessions to mini mode", ({ opencode }) =>
    Effect.gen(function* () {
      const result = yield* opencode.spawn(["attach", "http://127.0.0.1:1", "--mini"])

      opencode.expectExit(result, 1)
      expect(result.stderr).toContain("--mini requires a TTY stdout")
    }),
  )

  cliIt.live("rejects network options in mini mode", ({ opencode }) =>
    Effect.gen(function* () {
      const result = yield* opencode.spawn(["--mini", "--port", "4096"])

      opencode.expectExit(result, 1)
      expect(result.stderr).toContain("--port cannot be used with --mini")
    }),
  )
})
