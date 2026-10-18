// Data source: BossAi's public job endpoints (boss.id, Indonesia). No
// authentication required. These are the same JSON endpoints the site's own
// search page and job pages call; `robots.txt` on api.bossjob.com explicitly
// allows `/jobs/`.
//
// Search: GET /jobs/search  (rich, paginated list with posting dates)
// Detail: GET /jobs/<id>    (full description, requirements, company, dates)
//
// Personal use only: keep volume low (a handful of requests, not a crawl).

export const API_ORIGIN = "https://api.bossjob.com"
export const SEARCH_URL = `${API_ORIGIN}/jobs/search`
export const DETAIL_URL = `${API_ORIGIN}/jobs`
export const SITE_ORIGIN = "https://boss.id"
export const SITE_LOCALE = "/id"
export const PAGE_SIZE = 20

// The backend is a multi-country service; these headers select the Indonesian
// (BossAi) tenant. Without Country-Id the API returns Philippines postings.
// See url-reference.md.
const COUNTRY_ID = "96"
const SITE_ID = "2"

export function writeError(error: string, code: string): void {
  process.stderr.write(JSON.stringify({ error, code }) + "\n")
}

const UA = "Mozilla/5.0 (compatible; bossai-search-cli/1.0)"

function apiHeaders(): Record<string, string> {
  return {
    "User-Agent": UA,
    Accept: "application/json",
    "Country-Id": COUNTRY_ID,
    "Site-Id": SITE_ID,
    "X-Server-Client": "jobseeker-client",
  }
}

/**
 * Fetch with exponential backoff on 429/5xx (max ~6 retries). Returns null on a
 * 404 rather than throwing, so callers can map it to a clean NOT_FOUND error.
 */
async function fetchWithBackoff(url: string): Promise<Response | null> {
  const maxRetries = 6
  let delay = 500
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, {
      headers: apiHeaders(),
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
    if (response.status === 404) return null
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status} ${response.statusText}`)
    }
    return response
  }
  throw new Error("Request failed after max retries")
}

/** Fetch + parse a JSON response. Returns null on 404. */
export async function jsonFetch<T>(url: string): Promise<T | null> {
  const response = await fetchWithBackoff(url)
  if (!response) return null
  return (await response.json()) as T
}

/** Fetch a job-detail payload, unwrapping the `{ code, message, data }` envelope. */
export async function detailFetch(url: string): Promise<Record<string, unknown> | null> {
  const body = await jsonFetch<Record<string, unknown>>(url)
  if (body === null) return null
  const data = (body as { data?: unknown }).data
  return data && typeof data === "object" ? (data as Record<string, unknown>) : null
}

export interface JobCard {
  id: string
  title: string
  company: string | null
  location: string | null
  date: string | null
  url: string | null
  employmentType: string | null
  workArrangement: string | null
  experience: string | null
  salary: string | null
  deadline: string | null
  isActive: boolean | null
}

export interface JobDetail extends JobCard {
  description: string | null
  requirements: string | null
  skills: string[]
  applyUrl: string | null
}

export interface SearchResponse {
  count: number
  page: number
  results: JobCard[]
}

function s(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null
}

function obj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {}
}

/** Parse a Unicode code point, dropping out-of-range values instead of throwing. */
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
    .replace(/&#(\d+);/g, (_, dec) => numericEntity(parseInt(dec, 10)))
    .replace(/&#[xX]([0-9a-fA-F]+);/g, (_, hex) => numericEntity(parseInt(hex, 16)))
    .replace(/&nbsp;/g, " ")
}

/**
 * Turn an HTML description/requirements blob into readable text: decode
 * entities, strip tags, and preserve paragraph/list breaks. BossAi ships
 * compact HTML with no whitespace between block tags, so the break insertion is
 * what keeps the output legible.
 */
export function htmlToText(input: unknown): string | null {
  const raw = typeof input === "string" ? input : null
  if (!raw) return null
  const withBreaks = raw
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/(p|li|ul|ol|div|h[1-6]|tr)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\n- ")
  const text = decodeHtmlEntities(withBreaks.replace(/<[^>]+>/g, ""))
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
  return text || null
}

/** Normalize an already-plain description blob (detail `job_description`). */
export function normalizeText(input: unknown): string | null {
  const raw = typeof input === "string" ? input : null
  if (!raw) return null
  const text = decodeHtmlEntities(raw)
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
  return text || null
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]

function pad2(n: number): string {
  return String(n).padStart(2, "0")
}

/**
 * Normalize the several date shapes the API uses into `YYYY-MM-DD`:
 *  - search: `20260130` (published_at_date) and `2026-01-30 11:31:53`
 *  - detail: `30 Jan 2026`
 * Unknown/invalid values fall back to the trimmed input, or null.
 */
export function normalizeDate(v: unknown): string | null {
  const sv = s(v)
  if (!sv) return null
  if (/^\d{8}$/.test(sv)) return `${sv.slice(0, 4)}-${sv.slice(4, 6)}-${sv.slice(6, 8)}`
  if (/^\d{4}-\d{2}-\d{2}/.test(sv)) return sv.slice(0, 10)
  const m = sv.match(/^(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})$/)
  if (m) {
    const mi = MONTHS.indexOf(m[2].slice(0, 3).toLowerCase())
    if (mi >= 0) return `${m[3]}-${pad2(mi + 1)}-${pad2(Number(m[1]))}`
  }
  return sv
}

/** Public job URL. `job_url` is a site-relative path such as `/job/slug-123`. */
export function jobUrl(path: unknown): string | null {
  const p = s(path)
  if (!p) return null
  if (/^https?:\/\//i.test(p)) return p
  const rel = p.startsWith("/") ? p : `/${p}`
  return `${SITE_ORIGIN}${SITE_LOCALE}${rel}`
}

/**
 * Build a display location from the search record: city (+ region when it adds
 * information), falling back to region/country. Fully remote roles carry no
 * city, so fall back to the work arrangement ("Remote").
 */
export function formatLocation(j: Record<string, unknown>): string | null {
  const city = s(j.job_location)
  const region = s(j.job_region)
  const country = s(j.job_country)
  const arrangement = s(j.work_arrangement)
  if (city && region && region.toLowerCase() !== city.toLowerCase()) return `${city}, ${region}`
  return city ?? region ?? (arrangement === "Remote" ? "Remote" : null) ?? country
}

function cardFromSearch(j: Record<string, unknown>): JobCard | null {
  const id = j.id != null ? String(j.id) : null
  const title = s(j.job_title)
  if (!id || !title) return null
  const status = s(j.status_key)
  return {
    id,
    title,
    company: s(j.company_name),
    location: formatLocation(j),
    date: normalizeDate(j.published_at_date) ?? normalizeDate(j.published_at),
    url: jobUrl(j.job_url),
    employmentType: s(j.job_type),
    workArrangement: s(j.work_arrangement),
    experience: s(j.xp_lvl),
    salary: s(j.salary_range_value),
    deadline: normalizeDate(j.expired_at),
    isActive: status ? status === "active" : null,
  }
}

/**
 * Parse the `/jobs/search` payload into normalized cards. Each record is parsed
 * independently, so one malformed entry cannot break the rest.
 */
export function parseSearchResponse(body: unknown): SearchResponse {
  const root = obj(body)
  const data = obj(root.data)
  const jobs = Array.isArray(data.jobs) ? (data.jobs as unknown[]) : []
  const results: JobCard[] = []
  for (const raw of jobs) {
    const card = cardFromSearch(obj(raw))
    if (card) results.push(card)
  }
  const count = typeof data.total_num === "number" ? data.total_num : results.length
  const page = typeof data.page === "number" ? data.page : 1
  return { count, page, results }
}

/** Parse a `/jobs/<id>` detail payload into a normalized detail record. */
export function parseJobDetail(data: Record<string, unknown>, fallbackId: string): JobDetail {
  const company = obj(data.company)
  const loc = obj(data.location)
  const arrangement = obj(data.work_arrangement)
  const xp = obj(data.xp_lvl)
  const status = s(data.status_key)
  const url = jobUrl(data.job_url)
  const apply = s(data.external_apply_url)

  const city = s(loc.value)
  const region = s(loc.region)
  const location = city && region && region.toLowerCase() !== city.toLowerCase() ? `${city}, ${region}` : city ?? region

  return {
    id: data.id != null ? String(data.id) : fallbackId,
    title: s(data.job_title) ?? "(untitled)",
    company: s(company.name),
    location,
    date: normalizeDate(data.published_at),
    url,
    employmentType: s(data.job_type_value),
    workArrangement: s(arrangement.name),
    experience: s(xp.value),
    salary: s(data.salary_range_value),
    deadline: normalizeDate(data.expired_at),
    isActive: status ? status === "active" : null,
    description: htmlToText(data.job_description_html) ?? normalizeText(data.job_description),
    requirements: htmlToText(data.job_requirements_html) ?? normalizeText(data.job_requirements),
    skills: Array.isArray(data.skills)
      ? (data.skills as unknown[])
          .map((v) => (typeof v === "string" ? v : s(obj(v).name)))
          .filter((v): v is string => v !== null)
      : [],
    applyUrl: apply ?? url,
  }
}
