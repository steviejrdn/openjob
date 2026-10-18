// Data source: Glints Indonesia (glints.com/id). Two undocumented but public
// endpoints back this CLI — no login, no API key, zero runtime dependencies:
//
//   Search:  POST https://glints.com/api/v2/graphql  (query searchJobs)
//   Detail:  GET  https://glints.com/id/opportunities/jobs/<uuid>
//            -> server-rendered page; the full record ships in __NEXT_DATA__
//
// The GraphQL search endpoint is the one the site itself calls from the browser.
// We deliberately do NOT scrape /opportunities/jobs/explore?*, which robots.txt
// disallows; the JSON API is not disallowed.

export const GRAPHQL_URL = "https://glints.com/api/v2/graphql";
export const WEB_BASE = "https://glints.com/id";
export const COUNTRY_CODE = "ID";

// Anonymous search returns at most 50 postings per request and refuses to page
// past the first ~30-40 results (deeper offsets return NO_PERMISSION). So we ask
// for the maximum 50 in one request and treat the permission wall as end-of-list.
export const PAGE_SIZE = 50;
// Client-side --jobage walks at most this many pages looking for fresh postings
// (in practice the anonymous wall usually stops it after the first page).
export const MAX_JOBAGE_PAGES = 3;
// Safety cap when --limit asks for more than a few pages worth.
export const MAX_PAGES = 5;

export const UA = "Mozilla/5.0 (compatible; glints-cli/1.0)";

export function writeError(error: string, code: string): void {
  process.stderr.write(JSON.stringify({ error, code }) + "\n");
}

export interface JobCard {
  id: string;
  title: string;
  company: string | null;
  location: string | null;
  date: string | null;
  url: string;
}

export interface JobDetail extends JobCard {
  description: string | null;
  employmentType: string | null;
  workplaceType: string | null;
  salary: string | null;
  deadline: string | null;
  applyUrl: string | null;
  isActive: boolean;
}

/** Stable canonical URL for a posting (bare uuid 301s to the slugged page). */
export function jobUrl(id: string): string {
  return `${WEB_BASE}/opportunities/jobs/${id}`;
}

/** A non-2xx HTTP response, surfaced with its status so callers can special-case. */
export class HttpError extends Error {
  status: number;
  constructor(status: number, statusText: string) {
    super(`Request failed: ${status} ${statusText}`);
    this.name = "HttpError";
    this.status = status;
  }
}

/**
 * Fetch with exponential backoff + jitter on 429/5xx (max ~6 retries).
 * Returns null on 404 instead of throwing, so callers can report NOT_FOUND.
 */
async function fetchWithBackoff(url: string, init: RequestInit): Promise<Response | null> {
  const maxRetries = 6;
  let delay = 500;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, {
      ...init,
      headers: { ...(init.headers ?? {}), "User-Agent": UA },
      redirect: "follow",
      signal: AbortSignal.timeout(20000),
    });
    if (response.status === 429 || response.status >= 500) {
      if (attempt === maxRetries) {
        throw new Error(`Request failed: ${response.status} ${response.statusText}`);
      }
      const jitter = Math.floor(Math.random() * 500);
      await new Promise((r) => setTimeout(r, delay + jitter));
      delay = Math.min(delay * 2, 8000);
      continue;
    }
    if (response.status === 404) return null;
    if (!response.ok) {
      throw new HttpError(response.status, response.statusText);
    }
    return response;
  }
  throw new Error("Request failed after max retries");
}

/** A GraphQL error carrying the server's `extensions.code` (e.g. NO_PERMISSION). */
export class GraphQLRequestError extends Error {
  code: string | null;
  constructor(message: string, code: string | null) {
    super(message);
    this.name = "GraphQLRequestError";
    this.code = code;
  }
}

/** POST a GraphQL operation and return its `data`, throwing on GraphQL errors. */
export async function graphqlFetch<T = any>(
  query: string,
  variables: Record<string, unknown>,
  operationName: string,
): Promise<T | null> {
  const response = await fetchWithBackoff(GRAPHQL_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ operationName, variables, query }),
  }).catch((e: unknown) => {
    // Glints refuses anonymous deep paging with either a 403 or a 200 +
    // NO_PERMISSION body; normalize both to the same signal.
    if (e instanceof HttpError && e.status === 403) {
      throw new GraphQLRequestError("please login for more information", "NO_PERMISSION");
    }
    throw e;
  });
  if (!response) return null;
  const json = (await response.json()) as {
    data?: T;
    errors?: Array<{ message?: string; extensions?: { code?: string } }>;
  };
  if (json.errors && json.errors.length > 0) {
    const first = json.errors[0];
    throw new GraphQLRequestError(
      json.errors.map((e) => e.message ?? "GraphQL error").join("; "),
      first.extensions?.code ?? null,
    );
  }
  return (json.data ?? null) as T | null;
}

// --- Search -----------------------------------------------------------------

export const SEARCH_QUERY = `
query searchJobs($data: JobSearchConditionInput!) {
  searchJobs(data: $data) {
    jobsInPage {
      id
      title
      createdAt
      type
      workArrangementOption
      status
      company { id name brandName }
      city { id name }
      location {
        id name formattedName level slug
        parents { name formattedName level slug }
      }
    }
    totalJobs
  }
}`;

/** "Kelapa Gading, Jakarta Utara" — district plus its level-3 (City) parent. */
export function locationText(loc: any): string | null {
  if (!loc || typeof loc !== "object") return null;
  const name: string | null = loc.formattedName ?? loc.name ?? null;
  if (!name) return null;
  const parents: any[] = Array.isArray(loc.parents) ? loc.parents : [];
  const city = parents.find((p) => p?.level === 3)?.formattedName;
  if (city && city !== name) return `${name}, ${city}`;
  return name;
}

/** Map one GraphQL search result to the contract's card shape. */
export function mapJob(job: any): JobCard {
  const id = String(job?.id ?? "");
  return {
    id,
    title: job?.title ?? "(untitled)",
    company: job?.company?.brandName || job?.company?.name || null,
    location: locationText(job?.location),
    date: job?.createdAt ?? null,
    url: jobUrl(id),
  };
}

// --- Location resolution ----------------------------------------------------

const SUGGEST_LOCATIONS_QUERY = `
query searchHierarchicalLocations($searchType: String!, $countryCode: String!) {
  searchHierarchicalLocations(searchType: $searchType, countryCode: $countryCode) {
    list { id name formattedName level slug }
  }
}`;

const FILTER_LOCATIONS_QUERY = `
query getJobSearchFiltersV2($data: JobSearchFiltersFilterInputV2!) {
  getJobSearchFiltersV2(data: $data) {
    hierarchicalLocations { id name formattedName level slug }
  }
}`;

/**
 * Resolve a free-text place to a Glints location id. Glints exposes no general
 * city-search endpoint, only a small suggestion set (a handful of popular
 * cities/districts), so this matches against that pool and returns null when the
 * place is not covered. Callers then fold the place into the keyword instead.
 */
export async function resolveLocation(name: string): Promise<{ id: string; name: string } | null> {
  const query = name.trim().toLowerCase();
  if (!query) return null;

  const [suggest, filters] = await Promise.all([
    graphqlFetch<any>(
      SUGGEST_LOCATIONS_QUERY,
      { searchType: "SUGGESTION", countryCode: COUNTRY_CODE },
      "searchHierarchicalLocations",
    ).catch(() => null),
    graphqlFetch<any>(
      FILTER_LOCATIONS_QUERY,
      { data: { searchCountryCode: COUNTRY_CODE } },
      "getJobSearchFiltersV2",
    ).catch(() => null),
  ]);

  const raw: any[] = [
    ...(suggest?.searchHierarchicalLocations?.list ?? []),
    ...(filters?.getJobSearchFiltersV2?.hierarchicalLocations ?? []),
  ];

  const seen = new Set<string>();
  const candidates: any[] = [];
  for (const loc of raw) {
    if (loc?.id && !seen.has(loc.id)) {
      seen.add(loc.id);
      candidates.push(loc);
    }
  }

  const label = (l: any): string => String(l?.formattedName ?? l?.name ?? "").toLowerCase();
  const slug = query.replace(/\s+/g, "-");
  const exact = candidates.find((l) => label(l) === query || String(l?.slug ?? "") === slug);
  const partial =
    exact ??
    candidates.find((l) => label(l).includes(query) || query.includes(label(l)));
  if (!partial) return null;
  return { id: String(partial.id), name: String(partial.formattedName ?? partial.name ?? name) };
}

// --- Detail -----------------------------------------------------------------

const NEXT_DATA_RE = /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/;

/**
 * Fetch a posting page and pull its `initialData.data` record out of the
 * Next.js `__NEXT_DATA__` blob. Accepts a bare uuid (the page 301-redirects to
 * the slugged canonical URL, which fetch follows).
 */
export async function fetchJobDetail(id: string): Promise<any | null> {
  const response = await fetchWithBackoff(jobUrl(id), { method: "GET" });
  if (!response) return null;
  const html = await response.text();
  const match = html.match(NEXT_DATA_RE);
  if (!match) return null;
  let parsed: any;
  try {
    parsed = JSON.parse(match[1]);
  } catch {
    return null;
  }
  return parsed?.props?.pageProps?.initialData?.data ?? null;
}

function decodeEntities(text: string): string {
  const numeric = (cp: number): string =>
    cp >= 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : "";
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, dec) => numeric(parseInt(dec, 10)))
    .replace(/&#[xX]([0-9a-fA-F]+);/g, (_, hex) => numeric(parseInt(hex, 16)))
    .replace(/&nbsp;/g, " ");
}

/**
 * Glints stores the job description as a Draft.js raw-content JSON string
 * (`descriptionJsonString`). Flatten it to plain text, preserving paragraph
 * breaks and list items.
 */
export function richTextToPlain(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  let blocks: any[];
  try {
    blocks = JSON.parse(raw)?.blocks;
  } catch {
    return null;
  }
  if (!Array.isArray(blocks)) return null;
  const lines = blocks.map((b) => {
    const text = typeof b?.text === "string" ? decodeEntities(b.text) : "";
    if (b?.type === "unordered-list-item" || b?.type === "ordered-list-item") {
      return text ? `- ${text}` : "";
    }
    return text;
  });
  const cleaned = lines
    .join("\n\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return cleaned || null;
}

function extractSkills(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((s) => s?.skill?.name ?? s?.name)
    .filter((n): n is string => typeof n === "string" && n.length > 0);
}

/** Map the detail page's `initialData.data` to the contract's detail shape. */
export function mapDetail(data: any): JobDetail {
  const id = String(data?.id ?? "");
  const url = jobUrl(id);
  const deadline: string | null = data?.expiryDate ?? null;

  let isActive = data?.status === "OPEN";
  if (isActive && deadline) {
    const t = Date.parse(deadline);
    if (!Number.isNaN(t) && t < Date.now()) isActive = false;
  }

  const parts: string[] = [];
  const description = richTextToPlain(data?.descriptionJsonString);
  if (description) parts.push(description);
  const skills = extractSkills(data?.skills);
  if (skills.length > 0) parts.push(`Skills: ${skills.join(", ")}`);

  return {
    id,
    title: data?.title ?? "(untitled)",
    company:
      data?.company?.displayName || data?.company?.brandName || data?.company?.name || null,
    location: locationText(data?.location),
    date: data?.createdAt ?? null,
    url,
    description: parts.length > 0 ? parts.join("\n\n") : null,
    employmentType: data?.type ?? null,
    workplaceType: data?.workArrangementOption ?? null,
    salary: null,
    deadline,
    applyUrl: data?.externalApplyURL || url,
    isActive,
  };
}

// --- Shared -----------------------------------------------------------------

/** True when a posting date is no older than `days` days. */
export function withinDays(date: string | null, days: number, now = Date.now()): boolean {
  if (!date) return false;
  const t = Date.parse(date);
  if (Number.isNaN(t)) return false;
  return now - t <= days * 86_400_000;
}

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/** Accept a bare uuid or any Glints job URL containing one. */
export function normalizeDetailTarget(input: string): string | null {
  const match = input.trim().match(UUID_RE);
  return match ? match[0] : null;
}
