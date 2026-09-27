import { existsSync, readdirSync, readFileSync } from "node:fs"
import { cp, mkdir, symlink, writeFile } from "node:fs/promises"
import path from "node:path"

export type UserInfo = {
  name: string
  directory: string
  active: boolean
}

// Shared framework entries symlinked into every user directory so the
// command files keep resolving `tools/...`, `.agents/...` and fonts relative
// to the workspace root. Portal CLIs under `.agents/` are shared on purpose:
// `/add-portal` writes there and every user sees the added portal.
const SHARED_ENTRIES = ["tools", ".agents", "fonts"]

// Same header /outcome and /apply create on demand, so a fresh workspace is
// complete for /scrape and /rank from the first run.
const TRACKER_HEADER =
  "date,company,sector,role,role_type,channel,status,contact_person,fit_rating,notes,cv_file,cover_letter_file,source,deadline"

// Framework sources in the repo live under `scaffold/`; the release bundle
// keeps the same layout, so the fallbacks cover legacy/standalone copies.
const FRAMEWORK_SOURCES = ["scaffold/openjob", ".openjob"]

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

  const templateFiles: { destination: string; sources: string[] }[] = [
    { destination: "AGENTS.md", sources: ["scaffold/AGENTS.md.example", "AGENTS.md.example"] },
    { destination: "documents/README.md", sources: ["scaffold/documents/README.md", "documents/README.md"] },
    { destination: "templates/README.md", sources: ["scaffold/templates/README.md", "templates/README.md"] },
    { destination: "cv/main_example.tex", sources: ["scaffold/cv/main_example.tex", "cv/main_example.tex"] },
    {
      destination: "cover_letters/cover.cls",
      sources: ["scaffold/cover_letters/cover.cls", "cover_letters/cover.cls"],
    },
    {
      destination: "cover_letters/cover_example.tex",
      sources: ["scaffold/cover_letters/cover_example.tex", "cover_letters/cover_example.tex"],
    },
    { destination: "salary_lookup.py", sources: ["scaffold/salary_lookup.py", "salary_lookup.py"] },
    { destination: "SECURITY.md", sources: ["SECURITY.md"] },
  ]
  for (const { destination, sources } of templateFiles) {
    const from = sources.map((source) => path.join(root, source)).find((source) => existsSync(source))
    if (!from) continue
    const to = path.join(target, destination)
    await mkdir(path.dirname(to), { recursive: true })
    await cp(from, to)
  }

  // Per-user framework copy: commands, skills, agents and default_agent config
  // live inside the user directory, so /setup personalizes only this user's
  // profile and no state is shared between users.
  const framework = FRAMEWORK_SOURCES.map((source) => path.join(root, source)).find((source) => existsSync(source))
  if (framework) await cp(framework, path.join(target, ".openjob"), { recursive: true })

  await writeFile(path.join(target, "job_search_tracker.csv"), `${TRACKER_HEADER}\n`)

  for (const entry of SHARED_ENTRIES) {
    const source = path.join(root, entry)
    if (!existsSync(source)) continue
    await linkOrCopy(source, path.join(target, entry))
  }

  return target
}
