import { existsSync, readdirSync, readFileSync } from "node:fs"
import { cp, mkdir, symlink, writeFile } from "node:fs/promises"
import path from "node:path"

export type UserInfo = {
  name: string
  directory: string
  active: boolean
}

// Shared framework entries symlinked into every user directory so the
// command files keep resolving `tools/...`, `.agents/...` and
// `salary_lookup.py` relative to the workspace root.
const SHARED_ENTRIES = ["tools", "salary_lookup.py", ".agents", "fonts"]

const USER_NAME = /^[a-z0-9][a-z0-9._-]*$/i

export function validUserName(name: string) {
  return USER_NAME.test(name) && name !== "." && name !== ".."
}

export function usersRoot(worktree: string | undefined, fallback: string): string {
  if (worktree && worktree !== "/") return worktree
  return fallback
}

export function usersDirectory(root: string) {
  return path.join(root, "users")
}

export function userDirectory(root: string, name: string) {
  return path.join(usersDirectory(root), name)
}

export function listUsers(root: string): UserInfo[] {
  const dir = usersDirectory(root)
  if (!existsSync(dir)) return []
  const active = readActiveUser(root)
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({
      name: entry.name,
      directory: path.join(dir, entry.name),
      active: entry.name === active,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export function readActiveUser(root: string): string | undefined {
  try {
    const value = readFileSync(path.join(usersDirectory(root), ".active"), "utf8").trim()
    return value || undefined
  } catch {
    return undefined
  }
}

export async function writeActiveUser(root: string, name: string) {
  const dir = usersDirectory(root)
  await mkdir(dir, { recursive: true })
  await writeFile(path.join(dir, ".active"), `${name}\n`)
}

async function linkOrCopy(source: string, target: string) {
  try {
    await symlink(path.relative(path.dirname(target), source), target)
    return
  } catch {
    // Windows without developer mode, or filesystems without symlink support.
    await cp(source, target, { recursive: true })
  }
}

/**
 * Creates `users/<name>/` with the personal data skeleton, copies the profile
 * starter and shared templates, and links the shared framework entries.
 */
export async function scaffoldUser(root: string, name: string): Promise<string> {
  if (!validUserName(name)) throw new Error(`Invalid user name: ${name}`)
  const target = userDirectory(root, name)
  if (existsSync(target)) throw new Error(`User already exists: ${name}`)

  for (const dir of [
    "cv",
    "cover_letters",
    "documents/cv",
    "documents/linkedin",
    "documents/diplomas",
    "documents/references",
    "documents/applications",
    "documents/postings",
    "documents/interview",
    "job_scraper",
    "company_research",
    "upskill",
    "templates",
  ]) {
    await mkdir(path.join(target, dir), { recursive: true })
  }

  const templateFiles: [source: string, destination: string][] = [
    ["scaffold/AGENTS.md.example", "AGENTS.md"],
    ["scaffold/documents/README.md", "documents/README.md"],
    ["scaffold/templates/README.md", "templates/README.md"],
    ["scaffold/cv/main_example.tex", "cv/main_example.tex"],
    ["scaffold/cover_letters/cover.cls", "cover_letters/cover.cls"],
    ["scaffold/cover_letters/cover_example.tex", "cover_letters/cover_example.tex"],
    ["SECURITY.md", "SECURITY.md"],
  ]
  for (const [source, destination] of templateFiles) {
    const from = path.join(root, source)
    if (!existsSync(from)) continue
    const to = path.join(target, destination)
    await mkdir(path.dirname(to), { recursive: true })
    await cp(from, to)
  }

  for (const entry of SHARED_ENTRIES) {
    const source = path.join(root, entry)
    if (!existsSync(source)) continue
    await linkOrCopy(source, path.join(target, entry))
  }

  return target
}
