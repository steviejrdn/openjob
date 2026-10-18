import { DETAIL_URL, detailFetch, parseJobDetail, writeError } from "../helpers.js"

export interface DetailOpts {
  id: string
  format: "json" | "plain"
}

/**
 * Accept a raw numeric job ID or a full BossAi job URL. Job URLs look like
 * `https://boss.id/id/job/<slug>-<city>-<id>?query_id=...`, so the id is the
 * final digit run of the `/job/...` path.
 */
export function normalizeId(input: string): string | null {
  const trimmed = input.trim()
  const url = trimmed.match(/\/job\/[^/?#]*-(\d+)(?:[/?#]|$)/)
  if (url) return url[1]
  const api = trimmed.match(/\/jobs\/(\d+)(?:[/?#]|$)/)
  if (api) return api[1]
  const bare = trimmed.match(/^\d{3,}$/)
  if (bare) return bare[0]
  return null
}

export function detailUrl(id: string): string {
  return `${DETAIL_URL}/${id}?lang=id`
}

export async function runDetail(opts: DetailOpts): Promise<number> {
  const id = normalizeId(opts.id)
  if (!id) {
    writeError(`Could not parse a job ID from "${opts.id}"`, "BAD_ID")
    return 1
  }
  try {
    const data = await detailFetch(detailUrl(id))
    if (data === null || Object.keys(data).length === 0) {
      writeError("Job not found", "NOT_FOUND")
      return 1
    }
    const job = parseJobDetail(data, id)

    if (opts.format === "plain") {
      const lines = [
        job.title,
        `${job.company || "—"} · ${job.location || "—"}`,
        "",
        job.date ? `Posted: ${job.date}` : "",
        job.employmentType ? `Employment: ${job.employmentType}` : "",
        job.workArrangement ? `Work arrangement: ${job.workArrangement}` : "",
        job.experience ? `Experience: ${job.experience}` : "",
        job.salary ? `Salary: ${job.salary}` : "",
        job.deadline ? `Deadline: ${job.deadline}` : "",
        job.isActive === null ? "" : `Status: ${job.isActive ? "ACTIVE" : "CLOSED / EXPIRED"}`,
        "",
        job.description || "(no description)",
        "",
        job.requirements ? `Requirements:\n${job.requirements}` : "",
        job.skills.length > 0 ? `Skills: ${job.skills.join(", ")}` : "",
        "",
        `Apply: ${job.applyUrl || "—"}`,
        `URL: ${job.url || "—"}`,
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
