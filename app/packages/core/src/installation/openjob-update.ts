import path from "path"
import semver from "semver"
import { Global } from "../global"
import { Flag } from "../flag/flag"
import { OpenJobVersion } from "./version"

const REPO = "steviejrdn/openjob"
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000

export type UpdateCheck = {
  current: string
  latest?: string
  updateAvailable: boolean
}

function cacheFile() {
  return path.join(Global.Path.state, "openjob-update.json")
}

type Cache = { checkedAt: number; latest?: string }

async function readCache(): Promise<Cache | undefined> {
  try {
    const file = Bun.file(cacheFile())
    if (!(await file.exists())) return
    const data = (await file.json()) as Cache
    if (typeof data?.checkedAt !== "number") return
    return data
  } catch {
    return
  }
}

async function writeCache(cache: Cache) {
  try {
    await Bun.write(cacheFile(), JSON.stringify(cache, null, 2))
  } catch {
    // The update check is best-effort: a read-only state dir is not an error.
  }
}

async function fetchLatest(): Promise<string | undefined> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)
  try {
    const response = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { accept: "application/vnd.github+json", "user-agent": `openjob/${OpenJobVersion}` },
      signal: controller.signal,
    })
    if (response.ok) {
      const data = (await response.json()) as { tag_name?: unknown }
      if (typeof data?.tag_name === "string") return data.tag_name.replace(/^v/, "")
    }
    // Fallback for environments where the API is unreachable: follow the
    // releases/latest redirect and read the tag from the final URL.
    const redirect = await fetch(`https://github.com/${REPO}/releases/latest`, {
      redirect: "follow",
      signal: controller.signal,
    })
    const match = redirect.url?.match(/\/releases\/tag\/v?([^/?#]+)/)
    if (match) return decodeURIComponent(match[1])
  } catch {
    return
  } finally {
    clearTimeout(timeout)
  }
}

function isNewer(latest: string | undefined, current: string) {
  if (!latest || !semver.valid(latest) || !semver.valid(current)) return false
  try {
    return semver.gt(latest, current)
  } catch {
    return false
  }
}

/**
 * Checks the latest OpenJob release without ever updating anything.
 *
 * Returns `updateAvailable: false` for local/dev builds and when
 * OPENJOB_DISABLE_UPDATE_CHECK is set. Results are cached for a day so callers
 * do not hit GitHub on every launch; `force` skips the cache.
 */
export async function checkOpenJobUpdate(input: { force?: boolean } = {}): Promise<UpdateCheck> {
  const current = OpenJobVersion
  if (!input.force) {
    if (current === "dev") return { current, updateAvailable: false }
    if (Flag.OPENJOB_DISABLE_UPDATE_CHECK) return { current, updateAvailable: false }
    const cache = await readCache()
    if (cache && Date.now() - cache.checkedAt < CHECK_INTERVAL_MS) {
      return { current, latest: cache.latest, updateAvailable: isNewer(cache.latest, current) }
    }
  }
  const latest = await fetchLatest()
  await writeCache({ checkedAt: Date.now(), latest })
  return { current, latest, updateAvailable: isNewer(latest, current) }
}
