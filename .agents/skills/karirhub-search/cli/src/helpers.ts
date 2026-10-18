// Data sources for Karirhub (karirhub.kemnaker.go.id), the Indonesian
// Ministry of Manpower's public job board. Two public, unauthenticated JSON
// endpoints back the site:
//
//   * Search  — Algolia index `karirhub_industrial_vacancies`, reached through
//               the site's own proxy host `api.algolia.kemnaker.go.id`. The
//               application id and search key below are the *public* search-only
//               credentials the site ships in its own client bundle; they grant
//               read-only search and nothing else.
//   * Detail  — `api.kemnaker.go.id/karirhub/vacancy/v2/published-industrial-vacancies/<id>`.
//
// `robots.txt` carries only content-signal comments (no `Disallow`), and both
// endpoints are public — no login, no token, no third-party fetching service.

export const ALGOLIA_HOST = "https://api.algolia.kemnaker.go.id"
export const ALGOLIA_APP_ID = "L3WWP72HSI"
export const ALGOLIA_SEARCH_KEY = "alps_6bdce80b58a0fa863d43f15cd5cbac204d6d76d227437d91"
export const SEARCH_INDEX = "karirhub_industrial_vacancies"

export const DETAIL_URL =
  "https://api.kemnaker.go.id/karirhub/vacancy/v2/published-industrial-vacancies"
export const CITIES_URL = "https://api.kemnaker.go.id/karirhub/onboarding/v2/cities"
export const PROVINCES_URL = "https://api.kemnaker.go.id/karirhub/onboarding/v2/provinces"
export const SITE_JOB_URL =
  "https://karirhub.kemnaker.go.id/lowongan-dalam-negeri/lowongan"

/** Results per page, matching the portal's own listing page. */
export const PAGE_SIZE = 20

const UA = "Mozilla/5.0 (compatible; karirhub-cli/1.0)"

export function writeError(error: string, code: string): void {
  process.stderr.write(JSON.stringify({ error, code }) + "\n")
}

/** Fetch with exponential backoff on 429/5xx. Returns "" on a 404. */
export async function jsonFetch(url: string, init: RequestInit = {}): Promise<string> {
  const maxRetries = 6
  let delay = 500
  const headers: Record<string, string> = {
    "User-Agent": UA,
    Accept: "application/json, text/plain, */*",
    ...((init.headers as Record<string, string> | undefined) ?? {}),
  }
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, {
      ...init,
      headers,
      redirect: "follow",
      signal: AbortSignal.timeout(20000),
    })
    if (response.status === 429 || response.status >= 500) {
      if (attempt === maxRetries) {
        throw new Error(`Request failed: ${response.status} ${response.statusText}`)
      }
      const jitter = Math.floor(Math.random() * 500)
      await new Promise((r) => setTimeout(r, delay + jitter))
      delay = Math.min(delay * 2, 8000)
      continue
    }
    if (response.status === 404) return ""
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status} ${response.statusText}`)
    }
    return response.text()
  }
  throw new Error("Request failed after max retries")
}

/** GET a URL and parse JSON; returns null on 404. */
export async function getJson<T = unknown>(url: string): Promise<T | null> {
  const text = await jsonFetch(url)
  if (!text) return null
  try {
    return JSON.parse(text) as T
  } catch {
    throw new Error(`Invalid JSON from ${url}`)
  }
}

export interface AlgoliaHit {
  [key: string]: unknown
}

export interface AlgoliaResult {
  hits: AlgoliaHit[]
  nbHits: number
  page: number
  nbPages: number
}

/** Run a single-index Algolia query through the site's proxy host. */
export async function algoliaSearch(params: URLSearchParams): Promise<AlgoliaResult> {
  const body = JSON.stringify({
    requests: [{ indexName: SEARCH_INDEX, params: params.toString() }],
  })
  const text = await jsonFetch(`${ALGOLIA_HOST}/1/indexes/*/queries`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Algolia-Application-Id": ALGOLIA_APP_ID,
      "X-Algolia-API-Key": ALGOLIA_SEARCH_KEY,
    },
    body,
  })
  let json: { results?: AlgoliaResult[]; message?: string }
  try {
    json = JSON.parse(text) as typeof json
  } catch {
    throw new Error("Algolia returned a non-JSON response")
  }
  const result = json.results?.[0]
  if (!result) throw new Error(json.message || "Algolia search returned no result")
  return result
}

export interface JobCard {
  id: string
  title: string
  company: string | null
  location: string | null
  date: string | null
  url: string
  jobType: string | null
  platformType: string | null
  platformLink: string | null
  expiresAt: string | null
}

export interface JobDetail extends JobCard {
  description: string | null
  qualification: string | null
  employmentType: string | null
  jobFunction: string | null
  industry: string | null
  salary: string | null
  applicants: number | null
}

function str(v: unknown): string | null {
  if (typeof v !== "string") return null
  const t = v.trim()
  return t.length > 0 ? t : null
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  return null
}

/** Unix seconds -> ISO 8601, or pass an existing date string through. */
export function toIso(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    const ms = value > 1e12 ? value : value * 1000
    return new Date(ms).toISOString()
  }
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value)
    if (Number.isFinite(n)) {
      const ms = n > 1e12 ? n : n * 1000
      return new Date(ms).toISOString()
    }
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? value.trim() : parsed.toISOString()
  }
  return null
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
}

/** The human-facing job page. The portal ignores the slug, so any is valid. */
export function jobUrl(title: string, id: string): string {
  const slug = slugify(title) || "lowongan"
  return `${SITE_JOB_URL}/${slug}-${id}`
}

/** Pull the vacancy UUID out of a bare id or a full Karirhub job URL. */
export function normalizeId(input: string): string | null {
  const m = input.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)
  return m ? m[0] : null
}

export function parseHit(hit: AlgoliaHit): JobCard {
  const id = str(hit.id) ?? str(hit.objectID) ?? ""
  const title = str(hit.title) ?? "(untitled)"
  return {
    id,
    title,
    company: str(hit.company_name),
    location: str(hit.city_name),
    date: toIso(hit.published_at ?? hit.created_at),
    url: jobUrl(title, id),
    jobType: str(hit.job_type_name),
    platformType: str(hit.platform_type),
    platformLink: str(hit.platform_link),
    expiresAt: toIso(hit.expires_at),
  }
}

/**
 * Convert a description/qualification HTML fragment into readable text:
 * entities decoded, tags stripped, list items bulleted, paragraph and list
 * breaks preserved as newlines.
 */
export function htmlToText(html: string | null | undefined): string | null {
  if (!html || typeof html !== "string") return null
  const withBreaks = html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\s*li[^>]*>/gi, "\n- ")
    .replace(/<\s*\/\s*(p|div|li|ul|ol|h[1-6]|tr)\s*>/gi, "\n")
  const text = decodeHtmlEntities(withBreaks.replace(/<[^>]+>/g, " "))
  const cleaned = text
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
  return cleaned.length > 0 ? cleaned : null
}

function numericEntity(cp: number): string {
  return cp >= 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : ""
}

export function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, dec) => numericEntity(parseInt(dec, 10)))
    .replace(/&#[xX]([0-9a-fA-F]+);/g, (_, hex) => numericEntity(parseInt(hex, 16)))
}

interface RawDetail {
  id?: unknown
  title?: unknown
  published_at?: unknown
  expires_at?: unknown
  description?: unknown
  qualification?: unknown
  platform_type?: unknown
  platform_link?: unknown
  total_applicants?: unknown
  show_salary?: unknown
  min_salary_amount?: unknown
  max_salary_amount?: unknown
  min_salary_currency?: unknown
  max_salary_currency?: unknown
  employer?: { name?: unknown; employerable?: { industry?: { name?: unknown } } }
  region?: { name?: unknown }
  job_type?: { name?: unknown }
  job_function?: { name?: unknown }
}

function formatSalary(data: RawDetail): string | null {
  if (data.show_salary === false) return null
  const min = num(data.min_salary_amount)
  const max = num(data.max_salary_amount)
  if ((min === null || min === 0) && (max === null || max === 0)) return null
  const currency = str(data.min_salary_currency) ?? str(data.max_salary_currency) ?? "IDR"
  const fmt = (n: number) => n.toLocaleString("id-ID")
  if (min !== null && max !== null && min !== max) return `${currency} ${fmt(min)} – ${fmt(max)}`
  const one = max ?? min
  return one !== null ? `${currency} ${fmt(one)}` : null
}

export function parseDetail(data: RawDetail): JobDetail {
  const id = str(data.id) ?? ""
  const title = str(data.title) ?? "(untitled)"
  const applicants = num(data.total_applicants)
  return {
    id,
    title,
    company: str(data.employer?.name),
    location: str(data.region?.name),
    date: toIso(data.published_at),
    url: jobUrl(title, id),
    jobType: str(data.job_type?.name),
    platformType: str(data.platform_type),
    platformLink: str(data.platform_link),
    expiresAt: toIso(data.expires_at),
    description: htmlToText(str(data.description)),
    qualification: htmlToText(str(data.qualification)),
    employmentType: str(data.job_type?.name),
    jobFunction: str(data.job_function?.name),
    industry: str(data.employer?.employerable?.industry?.name),
    salary: formatSalary(data),
    applicants,
  }
}

interface RawRegion {
  id?: unknown
  name?: unknown
}

export interface LocationFilter {
  kind: "city" | "province"
  ids: string[]
  names: string[]
}

function normRegion(name: string): string {
  return name
    .toLowerCase()
    .replace(/^(kota administrasi|kota adm\.?|kota|kabupaten|kab\.?|adm\.?)\s+/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function tokenStarts(name: string, keyword: string): boolean {
  return new RegExp(`(^|[^a-z0-9])${escapeRegex(keyword)}`).test(name)
}

async function fetchRegions(url: string, keyword: string): Promise<RawRegion[]> {
  const q = new URLSearchParams({ keyword, limit: "10" })
  const json = await getJson<{ data?: RawRegion[] }>(`${url}?${q.toString()}`)
  return json?.data ?? []
}

/**
 * Resolve a place name (e.g. "Jakarta", "Bandung", "Jawa Timur") to the
 * `locations:city:<id>` / `locations:province:<id>` facet values the Algolia
 * index exposes. Prefers an exact name match (after stripping Kota/Kab.
 * prefixes), then a token-start match; prefers a province over its cities so
 * "-l Jakarta" covers the whole metro rather than one administrative city.
 * Returns null when nothing matches.
 */
export async function resolveLocation(input: string): Promise<LocationFilter | null> {
  const keyword = normRegion(input)
  if (!keyword) return null
  const [cities, provinces] = await Promise.all([
    fetchRegions(CITIES_URL, input),
    fetchRegions(PROVINCES_URL, input),
  ])

  const pick = (rows: RawRegion[], predicate: (n: string) => boolean): RawRegion[] =>
    rows.filter((r) => typeof r.name === "string" && r.id && predicate(normRegion(r.name)))

  const exact = (n: string) => n === keyword
  const starts = (n: string) => tokenStarts(n, keyword)

  for (const predicate of [exact, starts]) {
    const provinceMatches = pick(provinces, predicate)
    if (provinceMatches.length > 0) return toFilter("province", provinceMatches)
    const cityMatches = pick(cities, predicate)
    if (cityMatches.length > 0) return toFilter("city", cityMatches)
  }
  return null
}

function toFilter(kind: "city" | "province", rows: RawRegion[]): LocationFilter {
  const seen = new Set<string>()
  const ids: string[] = []
  const names: string[] = []
  for (const row of rows) {
    const id = String(row.id)
    if (seen.has(id)) continue
    seen.add(id)
    ids.push(id)
    names.push(String(row.name))
    if (ids.length >= 5) break
  }
  return { kind, ids, names }
}
