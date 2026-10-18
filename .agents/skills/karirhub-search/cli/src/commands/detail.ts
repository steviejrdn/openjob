import { DETAIL_URL, getJson, normalizeId, parseDetail, writeError } from "../helpers.js"

export interface DetailOpts {
  id: string
  format: "json" | "plain"
}

/** Accept a bare vacancy UUID or a full Karirhub job URL. */
export function resolveId(input: string): string | null {
  return normalizeId(input)
}

export async function runDetail(opts: DetailOpts): Promise<number> {
  const id = resolveId(opts.id)
  if (!id) {
    writeError(`Could not parse a job id from "${opts.id}"`, "BAD_ID")
    return 1
  }
  try {
    const json = await getJson<{ data?: Parameters<typeof parseDetail>[0] }>(`${DETAIL_URL}/${id}`)
    if (!json?.data) {
      writeError("Job not found", "NOT_FOUND")
      return 1
    }
    const job = parseDetail(json.data)

    if (opts.format === "plain") {
      const lines = [
        job.title,
        `${job.company || "—"} · ${job.location || "—"}`,
        "",
        job.employmentType ? `Employment: ${job.employmentType}` : "",
        job.jobFunction ? `Function: ${job.jobFunction}` : "",
        job.industry ? `Industry: ${job.industry}` : "",
        job.salary ? `Salary: ${job.salary}` : "",
        job.expiresAt ? `Deadline: ${job.expiresAt.slice(0, 10)}` : "",
        job.applicants !== null ? `Applicants: ${job.applicants}` : "",
        job.platformType ? `Platform: ${job.platformType}` : "",
        "",
        "Description:",
        job.description || "(no description)",
        "",
        "Qualification:",
        job.qualification || "(no qualification listed)",
        "",
        `URL: ${job.url}`,
        job.platformLink ? `Apply: ${job.platformLink}` : "",
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
