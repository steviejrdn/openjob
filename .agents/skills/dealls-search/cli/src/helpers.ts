// Data source: Dealls (dealls.com), backed by the public JSON API at
// api.sejutacita.id. Both search and detail return JSON, so listings need no
// HTML parsing at all; the only HTML we touch is inside a job's rich-text
// fields (description / responsibilities / requirements / perks), which we
// flatten to readable text. No credentials are required.
//
// Search: GET /v1/explore-job/job   -> data.docs[] (paginated)
// Detail: GET /v1/job-portal/job/<id> or /v1/job-portal/job/slug/<slug> -> data.result
// Cities: GET /v1/job-portal/job/city -> data.result.docs[] (name -> id lookup)

export const API_BASE = "https://api.sejutacita.id"
export const SEARCH_URL = `${API_BASE}/v1/explore-job/job`
export const DETAIL_URL = `${API_BASE}/v1/job-portal/job`
export const CITY_URL = `${API_BASE}/v1/job-portal/job/city`
export const WEB_BASE = "https://dealls.com"

// The portal serves 18 results per page on the web app and rejects limit > 55.
export const PAGE_SIZE = 18
export const MAX_LIMIT = 55
// Client-side --jobage pagination walks at most this many pages (see search.ts).
export const MAX_JOBAGE_PAGES = 5

export function writeError(error: string, code: string): void {
  process.stderr.write(JSON.stringify({ error, code }) + "\n")
}

const UA = "Mozilla/5.0 (compatible; dealls-search-cli/1.0)"

/**
 * Fetch JSON with exponential backoff + jitter on 429/5xx (max ~6 retries).
 * Returns null on 404 instead of throwing, so callers can report NOT_FOUND.
 */
export async function jsonFetch<T = unknown>(url: string): Promise<T | null> {
  const maxRetries = 6
  let delay = 500
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
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
    return (await response.json()) as T
  }
  throw new Error("Request failed after max retries")
}

export interface JobCard {
  id: string
  title: string
  company: string | null
  location: string | null
  date: string | null
  url: string
}

export interface JobDetail extends JobCard {
  description: string | null
  employmentType: string | null
  workplaceType: string | null
  salary: string | null
  applyUrl: string | null
  isActive: boolean
}

/** Canonical web URL for a posting: /loker/<slug>~<companySlug>. */
export function jobUrl(slug: string, companySlug?: string | null): string {
  if (!slug) return WEB_BASE
  return companySlug ? `${WEB_BASE}/loker/${slug}~${companySlug}` : `${WEB_BASE}/loker/${slug}`
}

/** Map one search-result document to the contract's card shape. */
export function mapJob(doc: any): JobCard {
  return {
    id: String(doc?.id ?? ""),
    title: doc?.role ?? "(untitled)",
    company: doc?.company?.name ?? null,
    location: doc?.city?.name ?? doc?.country?.name ?? null,
    date: doc?.publishedAt ?? null,
    url: jobUrl(doc?.slug ?? "", doc?.company?.slug),
  }
}

/** Map the detail endpoint's `data.result` to the detail shape. */
export function mapDetail(result: any): JobDetail {
  const sections: string[] = []
  const description = htmlToText(result?.description)
  if (description) sections.push(description)
  const responsibilities = htmlToText(result?.responsibilities)
  if (responsibilities) sections.push(`Responsibilities:\n${responsibilities}`)
  const requirements = htmlToText(result?.requirements)
  if (requirements) sections.push(`Requirements:\n${requirements}`)
  const perks = htmlToText(result?.perks)
  if (perks) sections.push(`Perks:\n${perks}`)

  const employmentTypes: unknown[] = Array.isArray(result?.employmentTypes)
    ? result.employmentTypes
    : []
  const url = jobUrl(result?.slug ?? "", result?.company?.slug)

  return {
    id: String(result?.id ?? ""),
    title: result?.role ?? "(untitled)",
    company: result?.company?.name ?? null,
    location: result?.location?.city?.name ?? result?.location?.country?.name ?? null,
    date: result?.publishedAt ?? null,
    url,
    description: sections.length ? sections.join("\n\n") : null,
    employmentType: employmentTypes.length ? employmentTypes.join(", ") : null,
    workplaceType: result?.workplaceType ?? null,
    salary: formatSalary(result),
    applyUrl: result?.externalPlatformApplyUrl ?? url,
    isActive: result?.status === "active" && !result?.closed,
  }
}

/** salaryRange is { start, end } in IDR; fall back to the salaryType label. */
function formatSalary(result: any): string | null {
  const range = result?.salaryRange
  const start = typeof range?.start === "number" ? range.start : null
  const end = typeof range?.end === "number" ? range.end : null
  if (start !== null || end !== null) {
    const fmt = (n: number) => `IDR ${n.toLocaleString("id-ID")}`
    if (start !== null && end !== null) return `${fmt(start)} - ${fmt(end)}`
    return start !== null ? `from ${fmt(start)}` : `up to ${fmt(end as number)}`
  }
  if (result?.salaryType && result.salaryType !== "paid") return String(result.salaryType)
  return null
}

/**
 * Resolve a city name to its Dealls city id. The city endpoint is a server-side
 * search (without `search` it returns only a small default subset), so we pass
 * the name through and then prefer an exact match over a substring match.
 */
export async function resolveCity(
  name: string,
): Promise<{ id: number; name: string } | null> {
  const query = name.trim()
  if (!query) return null
  const data = await jsonFetch<any>(`${CITY_URL}?search=${encodeURIComponent(query)}&limit=100`)
  const docs: any[] = data?.data?.result?.docs ?? []
  const lower = query.toLowerCase()
  const exact = docs.find((c) => String(c?.name ?? "").toLowerCase() === lower)
  if (exact) return { id: Number(exact.id), name: String(exact.name) }
  const partial = docs.find((c) => String(c?.name ?? "").toLowerCase().includes(lower))
  return partial ? { id: Number(partial.id), name: String(partial.name) } : null
}

/** True when a posting date is no older than `days` days. */
export function withinDays(date: string | null, days: number, now = Date.now()): boolean {
  if (!date) return false
  const t = Date.parse(date)
  if (Number.isNaN(t)) return false
  return now - t <= days * 86_400_000
}

/**
 * Accept a 24-char Mongo id, a Dealls /loker/... URL (the id is not present in
 * the URL, so we fall back to the slug endpoint), or a bare slug.
 */
export function normalizeDetailTarget(
  input: string,
): { kind: "id" | "slug"; value: string } | null {
  const s = input.trim()
  if (/^[a-f0-9]{24}$/i.test(s)) return { kind: "id", value: s }
  const url = s.match(/\/loker\/([^/?#]+)/i)
  if (url) {
    const slug = url[1].split("~")[0]
    if (slug) return { kind: "slug", value: slug }
  }
  if (/^[a-z0-9][a-z0-9-]+$/i.test(s)) return { kind: "slug", value: s }
  return null
}

function numericEntity(cp: number): string {
  return cp >= 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : ""
}

function decodeHtmlEntities(text: string): string {
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
 * Flatten a rich-text HTML field to plain text, preserving paragraph and list
 * structure (tags stripped, entities decoded, blank lines collapsed).
 */
export function htmlToText(html: unknown): string | null {
  if (typeof html !== "string" || !html.trim()) return null
  // Opening <li> already starts a line, so closing list tags must not add one
  // too (doing so double-spaces every bullet).
  const withBreaks = html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\n- ")
    .replace(/<\/(p|div|h[1-6])>/gi, "\n")
  const text = decodeHtmlEntities(withBreaks.replace(/<[^>]+>/g, ""))
  const cleaned = text
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
  return cleaned || null
}
