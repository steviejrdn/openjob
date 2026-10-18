#!/usr/bin/env bun
// Self-contained CLI for searching jobs on Dealls (dealls.com), Indonesia's job
// portal. Talks to the public JSON API at api.sejutacita.id — no API key and
// zero runtime dependencies, so it runs anywhere `bun` is available.

import { runSearch, type SearchOpts } from "./commands/search.js"
import { runDetail, type DetailOpts } from "./commands/detail.js"

interface Flags {
  _: string[]
  [k: string]: string | boolean | string[]
}

function parseFlags(argv: string[]): Flags {
  const flags: Flags = { _: [] }
  const alias: Record<string, string> = { q: "query", l: "location", n: "limit" }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith("--") || a.startsWith("-")) {
      const key = alias[a.replace(/^-+/, "")] ?? a.replace(/^-+/, "")
      const next = argv[i + 1]
      if (next === undefined || next.startsWith("-")) {
        flags[key] = true
      } else {
        flags[key] = next
        i++
      }
    } else {
      ;(flags._ as string[]).push(a)
    }
  }
  return flags
}

const HELP = `dealls-cli — search jobs on Dealls (dealls.com), Indonesia

USAGE
  bun run src/cli.ts search [--query <text> | --location <city>] [flags]
  bun run src/cli.ts detail <id|url> [--format json|plain]

SEARCH FLAGS
  --query, -q <text>      Keywords: job title, skill, or company. Indonesian or English.
  --location, -l <city>   City name from Dealls' list, e.g. "Jakarta Selatan", "Bandung",
                          "Surabaya". Resolved to a city id server-side.
  --jobage <days>         Posted within N days. Dealls has no server-side date filter, so
                          this sorts by newest and filters client-side (walks up to 5 pages).
  --workplace <type>      onSite | remote | hybrid.
  --type <employment>     fullTime | partTime | contract | freelance | internship.
  --sort <mode>           relevant (default) | newest.
  --page <n>              1-indexed page (18 results/page). Default 1.
  --limit, -n <n>         Cap results emitted (client-side).
  --format <fmt>          json (default) | table | plain.

  At least one of --query or --location is required (an unfiltered search would dump
  the whole board).

EXAMPLES
  bun run src/cli.ts search -q "data analyst" --format table
  bun run src/cli.ts search -q "software engineer" -l "Jakarta Selatan" --jobage 30 --format table
  bun run src/cli.ts search -q "digital marketing" -l "Bandung" --workplace remote --format table
  bun run src/cli.ts search -q "akuntansi" --type fullTime --sort newest --limit 10 --format json
  bun run src/cli.ts detail 6ad0a38d879b500012fa234e --format plain
  bun run src/cli.ts detail "https://dealls.com/loker/backend-engineer-7~jakmallcom" --format plain
`

const KNOWN_FLAGS: Record<string, Set<string>> = {
  search: new Set([
    "query",
    "location",
    "jobage",
    "workplace",
    "type",
    "sort",
    "page",
    "limit",
    "format",
    "help",
    "h",
  ]),
  detail: new Set(["format", "help", "h"]),
}

const WORKPLACE: Record<string, string> = {
  onsite: "onSite",
  "on-site": "onSite",
  remote: "remote",
  hybrid: "hybrid",
}

const EMPLOYMENT: Record<string, string> = {
  fulltime: "fullTime",
  "full-time": "fullTime",
  parttime: "partTime",
  "part-time": "partTime",
  contract: "contract",
  freelance: "freelance",
  internship: "internship",
  intern: "internship",
  magang: "internship",
}

async function main(): Promise<number> {
  const argv = process.argv.slice(2)
  const flags = parseFlags(argv)
  const cmd = (flags._ as string[])[0]

  if (!cmd || flags.help || flags.h) {
    process.stdout.write(HELP)
    return cmd ? 0 : 1
  }

  // Reject unknown flags instead of silently discarding them: a discarded
  // filter changes what the search returns with no error. add-portal.md's
  // contract requires a bogus flag to exit 1 with a JSON error on stderr.
  const knownFlags = KNOWN_FLAGS[cmd]
  if (knownFlags) {
    for (const key of Object.keys(flags)) {
      if (key === "_" || knownFlags.has(key)) continue
      process.stderr.write(
        JSON.stringify({
          error: `unknown flag --${key} for '${cmd}' - flags are never silently ignored, because a discarded filter changes what the search returns; see --help for the supported flags`,
          code: "UNKNOWN_FLAG",
        }) + "\n",
      )
      return 1
    }
  }

  if (cmd === "search") {
    const query = typeof flags.query === "string" ? flags.query : undefined
    const location = typeof flags.location === "string" ? flags.location : undefined
    if (!query && !location) {
      process.stderr.write(
        JSON.stringify({
          error: "provide at least one of --query/-q or --location/-l (an unfiltered search would return the entire board)",
          code: "MISSING_REQUIRED",
        }) + "\n",
      )
      return 1
    }

    const fmt = (flags.format as string) || "json"
    if (!["json", "table", "plain"].includes(fmt)) {
      process.stderr.write(
        JSON.stringify({ error: `--format must be json, table, or plain (got "${fmt}")`, code: "BAD_ARG" }) + "\n",
      )
      return 1
    }

    const parseIntFlag = (name: string, raw: string | boolean | string[]): number | null => {
      const val = typeof raw === "string" ? Number(raw.trim()) : NaN
      if (!Number.isInteger(val) || val < 1) {
        process.stderr.write(
          JSON.stringify({
            error: `--${name} must be a whole number of at least 1, got "${raw}"`,
            code: "BAD_ARG",
          }) + "\n",
        )
        return null
      }
      return val
    }

    let jobage: number | undefined
    let page = 1
    let limit: number | undefined
    if (flags.jobage !== undefined) {
      const v = parseIntFlag("jobage", flags.jobage)
      if (v === null) return 1
      jobage = v
    }
    if (flags.page !== undefined) {
      const v = parseIntFlag("page", flags.page)
      if (v === null) return 1
      page = v
    }
    if (flags.limit !== undefined) {
      const v = parseIntFlag("limit", flags.limit)
      if (v === null) return 1
      limit = v
    }

    let workplace: string | undefined
    if (typeof flags.workplace === "string") {
      workplace = WORKPLACE[flags.workplace.toLowerCase()]
      if (!workplace) {
        process.stderr.write(
          JSON.stringify({
            error: `--workplace must be onSite, remote, or hybrid (got "${flags.workplace}")`,
            code: "BAD_ARG",
          }) + "\n",
        )
        return 1
      }
    }

    let employmentType: string | undefined
    if (typeof flags.type === "string") {
      employmentType = EMPLOYMENT[flags.type.toLowerCase()]
      if (!employmentType) {
        process.stderr.write(
          JSON.stringify({
            error: `--type must be fullTime, partTime, contract, freelance, or internship (got "${flags.type}")`,
            code: "BAD_ARG",
          }) + "\n",
        )
        return 1
      }
    }

    let sort: "relevant" | "newest" = "relevant"
    if (typeof flags.sort === "string") {
      if (flags.sort !== "relevant" && flags.sort !== "newest") {
        process.stderr.write(
          JSON.stringify({ error: `--sort must be relevant or newest (got "${flags.sort}")`, code: "BAD_ARG" }) + "\n",
        )
        return 1
      }
      sort = flags.sort
    }

    const opts: SearchOpts = {
      query,
      location,
      jobage,
      workplace,
      employmentType,
      sort,
      page,
      limit,
      format: fmt as SearchOpts["format"],
    }
    return runSearch(opts)
  }

  if (cmd === "detail") {
    const id = (flags._ as string[])[1]
    if (!id) {
      process.stderr.write(JSON.stringify({ error: "detail requires an <id|url>", code: "NO_ID" }) + "\n")
      return 1
    }
    const fmt = (flags.format as string) || "json"
    if (fmt !== "json" && fmt !== "plain") {
      process.stderr.write(
        JSON.stringify({ error: `--format must be json or plain (got "${fmt}")`, code: "BAD_ARG" }) + "\n",
      )
      return 1
    }
    const opts: DetailOpts = { id, format: fmt as DetailOpts["format"] }
    return runDetail(opts)
  }

  process.stderr.write(JSON.stringify({ error: `Unknown command "${cmd}"`, code: "BAD_CMD" }) + "\n")
  return 1
}

main()
  .then((code) => process.exit(code))
  .catch((e) => {
    process.stderr.write(
      JSON.stringify({
        error: e instanceof Error ? e.message : String(e),
        code: "INTERNAL_ERROR",
      }) + "\n",
    )
    process.exit(1)
  })
