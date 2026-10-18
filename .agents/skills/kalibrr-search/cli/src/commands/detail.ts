import {
  DETAIL_LOCALE,
  SITE_ORIGIN,
  htmlFetch,
  parseDetailHtml,
  writeError,
} from "../helpers.js"

export interface DetailOpts {
  id: string
  format: "json" | "plain"
}

/** Accept a raw numeric job ID or a full Kalibrr job URL. */
export function normalizeId(input: string): string | null {
  const url = input.match(/\/jobs\/(\d+)(?:[/?#]|$)/)
  if (url) return url[1]
  const bare = input.trim().match(/^\d{4,}$/)
  if (bare) return bare[0]
  return null
}

/**
 * Detail pages are resolved by job id alone: Kalibrr redirects
 * `/c/<code>/jobs/<id>` to the canonical URL. A placeholder company code is
 * enough for a bare id, so we never need the search result in hand.
 */
export function detailUrl(input: string): string {
  if (/^https?:\/\//i.test(input.trim())) return input.trim()
  return `${SITE_ORIGIN}${DETAIL_LOCALE}/c/x/jobs/${normalizeId(input)}/x`
}

export async function runDetail(opts: DetailOpts): Promise<number> {
  const id = normalizeId(opts.id)
  if (!id) {
    writeError(`Could not parse a job ID from "${opts.id}"`, "BAD_ID")
    return 1
  }
  try {
    const html = await htmlFetch(detailUrl(opts.id))
    if (!html) {
      writeError("Job not found", "NOT_FOUND")
      return 1
    }
    const job = parseDetailHtml(html, id)

    if (opts.format === "plain") {
      const lines = [
        job.title,
        `${job.company || "—"} · ${job.location || "—"}`,
        "",
        job.employmentType ? `Employment: ${job.employmentType}` : "",
        job.function ? `Function: ${job.function}` : "",
        job.deadline ? `Deadline: ${job.deadline}` : "",
        `Status: ${job.isActive ? "ACTIVE" : "CLOSED / EXPIRED"}`,
        "",
        job.description || "(no description)",
        "",
        job.qualifications ? `Qualifications:\n${job.qualifications}` : "",
        "",
        `Apply: ${job.applyUrl}`,
        `URL: ${job.url}`,
      ].filter((l) => l !== "")
      process.stdout.write(lines.join("\n") + "\n")
    } else {
      process.stdout.write(JSON.stringify(job, null, 2) + "\n")
    }
    return 0
  } catch (e) {
    writeError(e instanceof Error ? e.message : String(e), "DETAIL_FAILED")
    return 1
  }
}
