import { fetchJobDetail, mapDetail, normalizeDetailTarget, writeError } from "../helpers.js"

export interface DetailOpts {
  id: string
  format: "json" | "plain"
}

export async function runDetail(opts: DetailOpts): Promise<number> {
  const id = normalizeDetailTarget(opts.id)
  if (!id) {
    writeError(`Could not parse a job id or Glints job URL from "${opts.id}"`, "BAD_ID")
    return 1
  }

  try {
    const data = await fetchJobDetail(id)
    if (!data) {
      writeError("Job not found", "NOT_FOUND")
      return 1
    }
    const job = mapDetail(data)

    if (opts.format === "plain") {
      const lines = [
        job.title,
        `${job.company || "—"} · ${job.location || "—"}`,
        job.date ? `Posted: ${job.date.slice(0, 10)}` : "",
        job.employmentType ? `Employment: ${job.employmentType}` : "",
        job.workplaceType ? `Workplace: ${job.workplaceType}` : "",
        job.deadline ? `Deadline: ${job.deadline.slice(0, 10)}` : "",
        `Status: ${job.isActive ? "ACTIVE" : "CLOSED / EXPIRED"}`,
        "",
        job.description || "(no description)",
        "",
        job.applyUrl ? `Apply: ${job.applyUrl}` : "",
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
