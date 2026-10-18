import {
  MAX_JOBAGE_PAGES,
  PAGE_SIZE,
  SEARCH_URL,
  jsonFetch,
  mapJob,
  resolveCity,
  withinDays,
  writeError,
  type JobCard,
} from "../helpers.js"

export interface SearchOpts {
  query?: string
  location?: string
  jobage?: number
  workplace?: string // onSite | remote | hybrid
  employmentType?: string // fullTime | partTime | contract | freelance | internship
  sort: "relevant" | "newest"
  page: number
  limit?: number
  format: "json" | "table" | "plain"
}

function buildUrl(opts: SearchOpts, cityId: number | undefined, page: number): string {
  const params = new URLSearchParams()
  if (opts.query) params.set("search", opts.query)
  params.set("page", String(page))
  params.set("limit", String(PAGE_SIZE))
  params.set("published", "true")
  params.set("status", "active")
  if (cityId !== undefined) params.append("cityIds[]", String(cityId))
  if (opts.workplace) params.append("workplaceTypes[]", opts.workplace)
  if (opts.employmentType) params.append("employmentTypes[]", opts.employmentType)

  // --jobage needs a guaranteed newest-first ordering to stop paginating early.
  const newestFirst = opts.jobage !== undefined || opts.sort === "newest"
  params.set("sortParam", newestFirst ? "publishedAt" : "mostRelevant")
  if (newestFirst) params.set("sortBy", "desc")
  return `${SEARCH_URL}?${params.toString()}`
}

function renderTable(cards: JobCard[]): string {
  if (cards.length === 0) return "No results."
  const rows = cards.map((c) => {
    const id = (c.id || "—").padEnd(26)
    const title = (c.title || "—").slice(0, 38).padEnd(38)
    const company = (c.company || "—").slice(0, 26).padEnd(26)
    const loc = (c.location || "—").slice(0, 20).padEnd(20)
    const date = (c.date || "—").slice(0, 10)
    return `${id} ${title} ${company} ${loc} ${date}`
  })
  const header =
    "ID".padEnd(26) + " " + "TITLE".padEnd(38) + " " + "COMPANY".padEnd(26) + " " + "LOCATION".padEnd(20) + " DATE"
  return [header, "-".repeat(header.length), ...rows].join("\n")
}

export async function runSearch(opts: SearchOpts): Promise<number> {
  try {
    let cityId: number | undefined
    if (opts.location) {
      const city = await resolveCity(opts.location)
      if (!city) {
        writeError(
          `location "${opts.location}" was not found in Dealls' city list; try a city name like "Jakarta Selatan", "Bandung", or "Surabaya"`,
          "LOCATION_NOT_FOUND",
        )
        return 1
      }
      cityId = city.id
    }

    const hardCap = opts.limit ?? (opts.jobage !== undefined ? 50 : PAGE_SIZE)
    const maxPages = opts.jobage !== undefined ? MAX_JOBAGE_PAGES : 1
    const cards: JobCard[] = []

    for (let i = 0; i < maxPages; i++) {
      const page = opts.page + i
      const data = await jsonFetch<any>(buildUrl(opts, cityId, page))
      const docs: any[] = data?.data?.docs ?? []
      const totalPages: number = data?.data?.totalPages ?? 1

      let pageCards = docs.map(mapJob)
      if (opts.jobage !== undefined) {
        pageCards = pageCards.filter((c) => withinDays(c.date, opts.jobage as number))
      }
      cards.push(...pageCards)

      if (page >= totalPages) break
      if (opts.jobage === undefined) break
      if (cards.length >= hardCap) break
      // Newest-first: once this page's oldest posting is out of the window,
      // every later page is too, so stop early.
      const oldest = docs[docs.length - 1]?.publishedAt ?? null
      if (oldest && !withinDays(oldest, opts.jobage)) break
    }

    let results = cards
    if (opts.limit !== undefined) results = results.slice(0, opts.limit)

    if (opts.format === "table") {
      process.stdout.write(renderTable(results) + "\n")
    } else if (opts.format === "plain") {
      process.stdout.write(
        results
          .map(
            (c) =>
              `${c.title}\n  ${c.company || "—"} · ${c.location || "—"} · ${(c.date || "—").slice(0, 10)}\n  id: ${c.id}\n  ${c.url}`,
          )
          .join("\n\n") + "\n",
      )
    } else {
      process.stdout.write(
        JSON.stringify({ meta: { count: results.length, page: opts.page }, results }, null, 2) + "\n",
      )
    }
    return 0
  } catch (e) {
    writeError(e instanceof Error ? e.message : String(e), "SEARCH_FAILED")
    return 1
  }
}
