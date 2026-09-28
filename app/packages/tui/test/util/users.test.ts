import { describe, expect, test } from "bun:test"
import { existsSync } from "node:fs"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { usersRoot } from "../../src/util/users"

async function tmpdir() {
  return fs.mkdtemp(path.join(os.tmpdir(), "openjob-users-"))
}

describe("usersRoot", () => {
  test("a user workspace climbs to its host root", async () => {
    const root = await tmpdir()
    try {
      const user = path.join(root, "users", "stevie")
      await fs.mkdir(path.join(user, ".openjob"), { recursive: true })
      expect(usersRoot(user)).toBe(root)
    } finally {
      await fs.rm(root, { recursive: true, force: true })
    }
  })

  test("a host root stays put", async () => {
    const root = await tmpdir()
    try {
      expect(existsSync(path.join(root, ".openjob"))).toBe(false)
      expect(usersRoot(root)).toBe(root)
    } finally {
      await fs.rm(root, { recursive: true, force: true })
    }
  })
})
