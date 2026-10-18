// Data source: Kalibrr's public job-board endpoints. No authentication required.
//
// Search hits a JSON API (`/kjs/job_board/search`) that returns the full board as
// structured data. Detail is not exposed as a standalone JSON endpoint, so we fetch
// the server-rendered job page and parse the Next.js `__NEXT_DATA__` blob that the
// page ships with — no HTML class-chasing needed.
//
// Personal use only: keep volume low (a handful of requests, not a crawl).

export const SEARCH_URL = "https://www.kalibrr.com/kjs/job_board/search"
export const SITE_ORIGIN = "https://www.kalibrr.id"
export const DETAIL_LOCALE = "/id-ID"
export const PAGE_SIZE = 15

export function writeError(error: string, code: string): void {
  process.stderr.write(JSON.stringify({ error, code }) + "\n")
}

const UA = "Mozilla/5.0 (compatible; kalibrr-search-cli/1.0)"

/**
 * Fetch with exponential backoff on 429/5xx (max ~6 retries). Returns null on a
 * 404 rather than throwing, so callers can map it to a clean NOT_FOUND error.
 */
async function fetchWithBackoff(url: string, accept: string): Promise<Response | null> {
  const maxRetries = 6
  let delay = 500
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: accept,
        "Accept-Language": "en-US,en;q=0.9,id;q=0.8",
      },
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
  const response = await fetchWithBackoff(url, "application/json")
  if (!response) return null
  return (await response.json()) as T
}

/** Fetch an HTML response. Returns "" on 404. */
export async function htmlFetch(url: string): Promise<string> {
  const response = await fetchWithBackoff(url, "text/html,application/xhtml+xml")
  if (!response) return ""
  return response.text()
}

export interface JobCard {
  id: string
  title: string
  company: string | null
  location: string | null
  date: string | null
  url: string
  companyCode: string | null
  employmentType: string | null
  function: string | null
  isRemote: boolean | null
  deadline: string | null
}

export interface JobDetail {
  id: string
  title: string
  company: string | null
  location: string | null
  date: string | null
  url: string
  description: string | null
  qualifications: string | null
  employmentType: string | null
  function: string | null
  deadline: string | null
  applyUrl: string | null
  isActive: boolean
}

function s(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null
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
 * Turn a Kalibrr HTML description/qualifications blob into readable text:
 * decode entities, strip tags, and preserve paragraph breaks.
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

/** Build "City, Region" from either Kalibrr location shape (camelCase or snake_case). */
export function formatLocation(loc: unknown): string | null {
  const root = loc as Record<string, unknown> | null | undefined
  const a = (root?.address_components ?? root?.addressComponents) as
    | Record<string, unknown>
    | undefined
  if (!a) return null
  const parts = [s(a.city), s(a.region)].filter((p): p is string => p !== null)
  if (parts.length > 0) return parts.join(", ")
  return s(a.country) ?? s(a.address_line_1) ?? s(a.addressLine_1)
}

/** Keep only the calendar day (YYYY-MM-DD) of an ISO timestamp. */
export function shortDate(v: unknown): string | null {
  const sv = s(v)
  if (!sv) return null
  return /^\d{4}-\d{2}-\d{2}/.test(sv) ? sv.slice(0, 10) : sv
}

/** Public job URL. Company code + slug are cosmetic — Kalibrr resolves by id. */
export function jobUrl(id: string, companyCode: string | null, slug: string | null): string {
  const base = `${SITE_ORIGIN}${DETAIL_LOCALE}/c/${companyCode ?? "x"}/jobs/${id}`
  return slug ? `${base}/${slug}` : base
}

export interface SearchResponse {
  count: number
  results: JobCard[]
}

/** Parse the `/kjs/job_board/search` JSON payload into normalized cards. */
export function parseSearchResponse(body: unknown): SearchResponse {
  const b = (body ?? {}) as { count?: unknown; jobs?: unknown }
  const jobs = Array.isArray(b.jobs) ? b.jobs : []
  const results: JobCard[] = []

  for (const raw of jobs) {
    const j = raw as Record<string, any>
    const id = j.id != null ? String(j.id) : null
    if (!id) continue
    const title = s(j.name)
    if (!title) continue
    const company = (j.company ?? {}) as Record<string, unknown>
    const companyCode = s(company.code)

    results.push({
      id,
      title,
      company: s(j.company_name) ?? s(company.name),
      location: formatLocation(j.google_location),
      date: shortDate(j.activation_date),
      url: jobUrl(id, companyCode, s(j.slug)),
      companyCode,
      employmentType: s(j.tenure),
      function: s(j.function),
      isRemote: typeof j.is_work_from_home === "boolean" ? j.is_work_from_home : null,
      deadline: shortDate(j.application_end_date),
    })
  }

  const count = typeof b.count === "number" ? b.count : results.length
  return { count, results }
}

/** Extract and JSON-parse the Next.js `__NEXT_DATA__` blob from a job page. */
export function extractNextData(html: string): Record<string, any> | null {
  const m = html.match(
    /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/i,
  )
  if (!m) return null
  try {
    return JSON.parse(m[1]) as Record<string, any>
  } catch {
    return null
  }
}

/** Parse a server-rendered job detail page into a normalized detail record. */
export function parseDetailHtml(html: string, id: string): JobDetail {
  const data = extractNextData(html)
  if (!data) throw new Error("Could not find job data (__NEXT_DATA__) on the job page")

  const props = (data.props?.pageProps ?? {}) as Record<string, any>
  const j = (props.job ?? {}) as Record<string, any>
  const company = (j.company ?? {}) as Record<string, unknown>
  const companyCode = s(company.code)
  const slug = s(j.slug)
  const url = jobUrl(id, companyCode, slug)
  const isExpired = props.isExpired === true || j.active === false

  return {
    id: j.id != null ? String(j.id) : id,
    title: s(j.name) ?? "(untitled)",
    company: s(company.name) ?? s(j.companyInfo?.name),
    location: formatLocation(j.googleLocation),
    date: shortDate(j.activationDate),
    url,
    description: htmlToText(j.description),
    qualifications: htmlToText(j.qualifications),
    employmentType: s(j.tenure),
    function: s(j.function),
    deadline: shortDate(j.applicationEndDate),
    applyUrl: s(j.applyRedirectUrl) ?? url,
    isActive: !isExpired,
  }
}
