import {
  PAGE_SIZE,
  SEARCH_URL,
  jsonFetch,
  parseSearchResponse,
  writeError,
  type JobCard,
} from "../helpers.js"

export interface SearchOpts {
  query?: string
  jobage: number
  page: number
  limit?: number
  format: "json" | "table" | "plain"
}

/**
 * Build the `/jobs/search` URL. The board is scoped to Indonesia via the
 * `Country-Id`/`Site-Id` request headers (see helpers.ts). There is no
 * server-side location parameter — a city must be part of `--query`.
 */
export function buildUrl(opts: SearchOpts): string {
  const params = new URLSearchParams()
  if (opts.query) params.set("query", opts.query)
  params.set("page", String(opts.page))
  params.set("size", String(PAGE_SIZE))
  params.set("sort", "1") // 1 = Newest, 2 = Relevance
  params.set("source", "web")
  return `${SEARCH_URL}?${params.toString()}`
}

/**
 * Client-side posting-age filter. BossAi exposes no posting-age parameter, so
 * `--jobage` filters the fetched page after the fact (a page can therefore
 * yield fewer results than its raw size).
 */
function withinAge(date: string | null, days: number): boolean {
  if (!date) return false
  const t = Date.parse(date)
  if (Number.isNaN(t)) return false
  return Date.now() - t <= days * 86400000
}

function renderTable(cards: JobCard[]): string {
  if (cards.length === 0) return "No results."
  const rows = cards.map((c) => {
    const title = (c.title || "").slice(0, 40).padEnd(40)
    const company = (c.company || "—").slice(0, 24).padEnd(24)
    const loc = (c.location || "—").slice(0, 22).padEnd(22)
    const date = c.date || "—"
    return `${c.id.padEnd(9)} ${title} ${company} ${loc} ${date}`
  })
  const header =
    "ID".padEnd(9) + " " + "TITLE".padEnd(40) + " " + "COMPANY".padEnd(24) + " " + "LOCATION".padEnd(22) + " DATE"
  return [header, "-".repeat(header.length), ...rows].join("\n")
}

export async function runSearch(opts: SearchOpts): Promise<number> {
  try {
    const body = await jsonFetch<unknown>(buildUrl(opts))
    if (body === null) {
      writeError("Search endpoint returned no data", "SEARCH_FAILED")
      return 1
    }

    const parsed = parseSearchResponse(body)
    let cards = parsed.results
    if (opts.jobage > 0 && opts.jobage < 9999) {
      cards = cards.filter((c) => withinAge(c.date, opts.jobage))
    }
    if (opts.limit !== undefined && opts.limit >= 0) cards = cards.slice(0, opts.limit)

    if (opts.format === "table") {
      process.stdout.write(renderTable(cards) + "\n")
    } else if (opts.format === "plain") {
      process.stdout.write(
        cards
          .map(
            (c) =>
              `${c.title}\n  ${c.company || "—"} · ${c.location || "—"} · ${c.date || "—"}\n  id: ${c.id}\n  type: ${c.employmentType || "—"} · ${c.workArrangement || "—"}\n  deadline: ${c.deadline || "—"}\n  ${c.url || "—"}`,
          )
          .join("\n\n") + "\n",
      )
    } else {
      process.stdout.write(
        JSON.stringify(
          { meta: { count: parsed.count, page: opts.page }, results: cards },
          null,
          2,
        ) + "\n",
      )
    }
    return 0
  } catch (e) {
    writeError(e instanceof Error ? e.message : String(e), "SEARCH_FAILED")
    return 1
  }
}
