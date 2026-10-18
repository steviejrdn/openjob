import {
  PAGE_SIZE,
  algoliaSearch,
  parseHit,
  resolveLocation,
  writeError,
  type JobCard,
} from "../helpers.js"

export interface SearchOpts {
  query?: string
  location?: string
  jobage: number
  page: number
  limit?: number
  format: "json" | "table" | "plain"
}

function buildParams(opts: SearchOpts, locationFilter: string[] | null): URLSearchParams {
  const params = new URLSearchParams()
  params.set("query", opts.query ?? "")

  // Posting-age window, applied server-side on the index's `published_at`.
  if (opts.jobage > 0 && opts.jobage < 9999) {
    const cutoff = Math.floor(Date.now() / 1000) - opts.jobage * 86400
    params.set("numericFilters", JSON.stringify([`published_at>${cutoff}`]))
  }

  // Location facet. A single value is `["locations:city:<id>"]`; several
  // matching localities (e.g. Kota + Kab. Bandung) become an OR group
  // `[["locations:city:a","locations:city:b"]]`.
  if (locationFilter && locationFilter.length > 0) {
    params.set(
      "facetFilters",
      JSON.stringify(locationFilter.length > 1 ? [locationFilter] : locationFilter),
    )
  }

  params.set("hitsPerPage", String(PAGE_SIZE))
  params.set("page", String(Math.max(0, opts.page - 1)))
  return params
}

function renderTable(cards: JobCard[]): string {
  if (cards.length === 0) return "No results."
  const rows = cards.map((c) => {
    const title = (c.title || "").slice(0, 38).padEnd(38)
    const company = (c.company || "—").slice(0, 24).padEnd(24)
    const loc = (c.location || "—").slice(0, 22).padEnd(22)
    const date = (c.date || "—").slice(0, 10)
    return `${c.id.padEnd(36)} ${title} ${company} ${loc} ${date}`
  })
  const header =
    "ID".padEnd(36) +
    " " +
    "TITLE".padEnd(38) +
    " " +
    "COMPANY".padEnd(24) +
    " " +
    "LOCATION".padEnd(22) +
    " DATE"
  return [header, "-".repeat(header.length), ...rows].join("\n")
}

function renderPlain(cards: JobCard[]): string {
  return (
    cards
      .map(
        (c) =>
          `${c.title}\n  ${c.company || "—"} · ${c.location || "—"} · ${(c.date || "—").slice(0, 10)}\n  id: ${c.id}\n  ${c.url}`,
      )
      .join("\n\n") + "\n"
  )
}

export async function runSearch(opts: SearchOpts): Promise<number> {
  try {
    let locationFilter: string[] | null = null
    if (opts.location) {
      const resolved = await resolveLocation(opts.location)
      if (!resolved) {
        writeError(
          `could not resolve location "${opts.location}" to an Indonesian city or province; try a nearby city name, or include the place in --query`,
          "LOCATION_NOT_FOUND",
        )
        return 1
      }
      locationFilter = resolved.ids.map((id) => `locations:${resolved.kind}:${id}`)
    }

    const result = await algoliaSearch(buildParams(opts, locationFilter))
    let cards = result.hits.map(parseHit).filter((c) => c.id !== "")
    if (opts.limit !== undefined && opts.limit >= 0) cards = cards.slice(0, opts.limit)

    if (opts.format === "table") {
      process.stdout.write(renderTable(cards) + "\n")
    } else if (opts.format === "plain") {
      process.stdout.write(renderPlain(cards))
    } else {
      process.stdout.write(
        JSON.stringify({ meta: { count: cards.length, page: opts.page }, results: cards }, null, 2) +
          "\n",
      )
    }
    return 0
  } catch (e) {
    writeError(e instanceof Error ? e.message : String(e), "SEARCH_FAILED")
    return 1
  }
}
