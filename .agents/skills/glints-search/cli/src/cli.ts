#!/usr/bin/env bun
// Self-contained CLI for searching jobs on Glints Indonesia (glints.com/id).
// Talks to the site's public GraphQL endpoint and to server-rendered job pages —
// no API key and zero runtime dependencies, so it runs anywhere `bun` is.

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

const HELP = `glints-cli — search jobs on Glints Indonesia (glints.com/id)

USAGE
  bun run src/cli.ts search [--query <text> | --location <place>] [flags]
  bun run src/cli.ts detail <id|url> [--format json|plain]

SEARCH FLAGS
  --query, -q <text>      Keywords: job title, skill, or company. Indonesian or English.
  --location, -l <place>  City/area, e.g. "Jakarta", "Bandung", "Surabaya", "Denpasar".
                          Resolved to a Glints location when possible; otherwise folded
                          into the keywords (Glints' location index is a short list).
  --jobage <days>         Posted within N days. Glints has no reliable server-side date
                          filter, so this filters client-side across up to 3 pages.
  --page <n>              1-indexed page (50 results/page). Default 1. Note: anonymous
                          access is fenced after the first page (see README).
  --limit, -n <n>         Cap results emitted (client-side).
  --format <fmt>          json (default) | table | plain.

  At least one of --query or --location is required (an unfiltered search would
  page through the whole board).

EXAMPLES
  bun run src/cli.ts search -q "data analyst" --format table
  bun run src/cli.ts search -q "software engineer" -l Jakarta --format table
  bun run src/cli.ts search -q "digital marketing" -l Bandung --jobage 7 --format table
  bun run src/cli.ts search -q "akuntansi" --limit 10 --format json
  bun run src/cli.ts detail e4cc66ac-3bfa-4fdf-b61f-c8406298b8a5 --format plain
`

const KNOWN_FLAGS: Record<string, Set<string>> = {
  search: new Set(["query", "location", "jobage", "page", "limit", "format", "help", "h"]),
  detail: new Set(["format", "help", "h"]),
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
  // filter changes what the search returns with no error. The portal-skill
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
          error:
            "provide at least one of --query/-q or --location/-l (an unfiltered search would page through the entire board)",
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

    const opts: SearchOpts = {
      query,
      location,
      jobage,
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
