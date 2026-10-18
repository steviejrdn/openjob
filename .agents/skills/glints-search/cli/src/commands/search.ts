import {
  MAX_PAGES,
  MAX_JOBAGE_PAGES,
  PAGE_SIZE,
  GraphQLRequestError,
  SEARCH_QUERY,
  graphqlFetch,
  mapJob,
  resolveLocation,
  withinDays,
  writeError,
  type JobCard,
} from "../helpers.js"

export interface SearchOpts {
  query?: string
  location?: string
  jobage?: number
  page: number
  limit?: number
  format: "json" | "table" | "plain"
}

function renderTable(cards: JobCard[]): string {
  if (cards.length === 0) return "No results."
  const rows = cards.map((c) => {
    const id = (c.id || "—").slice(0, 12).padEnd(12)
    const title = (c.title || "—").slice(0, 40).padEnd(40)
    const company = (c.company || "—").slice(0, 26).padEnd(26)
    const loc = (c.location || "—").slice(0, 24).padEnd(24)
    const date = (c.date || "—").slice(0, 10)
    return `${id} ${title} ${company} ${loc} ${date}`
  })
  const header =
    "ID".padEnd(12) +
    " " +
    "TITLE".padEnd(40) +
    " " +
    "COMPANY".padEnd(26) +
    " " +
    "LOCATION".padEnd(24) +
    " DATE"
  return [header, "-".repeat(header.length), ...rows].join("\n")
}

export async function runSearch(opts: SearchOpts): Promise<number> {
  try {
    // Resolve an optional place to a Glints location id; if Glints has never
    // heard of it, fold it into the keyword instead (Glints' location index is
    // a short suggestion list, so this keeps --location useful for any city).
    let searchTerm = opts.query?.trim() ?? ""
    let locationId: string | undefined
    if (opts.location) {
      const resolved = await resolveLocation(opts.location)
      if (resolved) locationId = resolved.id
      else searchTerm = [searchTerm, opts.location.trim()].filter(Boolean).join(" ")
    }

    const target =
      opts.limit ??
      (opts.jobage !== undefined ? MAX_JOBAGE_PAGES * PAGE_SIZE : PAGE_SIZE)
    const maxPages = opts.limit
      ? Math.min(Math.max(1, Math.ceil(opts.limit / PAGE_SIZE)), MAX_PAGES)
      : opts.jobage !== undefined
        ? MAX_JOBAGE_PAGES
        : 1

    const cards: JobCard[] = []
    for (let i = 0; i < maxPages; i++) {
      const page = opts.page + i
      const data: Record<string, unknown> = {
        CountryCode: ["ID"],
        includeExternalJobs: true,
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
      }
      if (searchTerm) data.SearchTerm = [searchTerm]
      if (locationId) data.LocationIds = [locationId]

      const result = await graphqlFetch<any>(SEARCH_QUERY, { data }, "searchJobs").catch(
        (e: unknown) => {
          // Anonymous paging wall: Glints refuses offsets past the first page or
          // so. Keep whatever earlier pages yielded rather than failing outright.
          if (e instanceof GraphQLRequestError && e.code === "NO_PERMISSION") return null;
          throw e;
        },
      )
      if (result === null) break
      const jobs: any[] = result?.searchJobs?.jobsInPage ?? []
      let pageCards = jobs.map(mapJob)
      if (opts.jobage !== undefined) {
        pageCards = pageCards.filter((c) => withinDays(c.date, opts.jobage as number))
      }
      cards.push(...pageCards)

      if (jobs.length < PAGE_SIZE) break
      if (cards.length >= target) break
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
