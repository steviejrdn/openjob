---
name: glints-search
version: 1.0.0
description: >
  Make sure to use this skill whenever the user wants to search for jobs in
  Indonesia, find Indonesian job listings, look up a specific job posting, or
  asks anything about the Indonesian job market on Glints — even if they don't
  mention glints.com explicitly. Invoke this skill for open positions, vacancies,
  and hiring across any sector (software, data, finance, marketing, education,
  admin, engineering, etc.) in Indonesian cities or remotely. Also trigger for
  phrases like "find me a job in Jakarta", "are there any data analyst jobs in
  Indonesia", or "what jobs are available in Bandung". Trigger phrases include:
  glints, glints indonesia, glints taploker, taploker, lowongan kerja, lowongan
  kerja Indonesia, cari kerja, info lowongan, loker, kerja di Jakarta, lowongan
  Jakarta, lowongan Bandung, lowongan Surabaya, lowongan Yogyakarta, lowongan
  remote Indonesia, lowongan data analyst, lowongan software engineer, lowongan
  marketing, lowongan akuntansi, jobs in Indonesia, indonesian jobs, job search
  Indonesia, work in Indonesia, hiring Indonesia, job vacancy Indonesia, IT jobs
  Indonesia, remote jobs Indonesia, data analyst job indonesia, software engineer
  job jakarta.
context: fork
enabled: true  # set to false to keep this portal installed but have /scrape skip it
allowed-tools: Bash(bun run .agents/skills/glints-search/cli/src/cli.ts *)
---

# Glints Indonesia Search Skill

Search live job listings from **Glints Indonesia** (`glints.com/id`, "Glints
TapLoker"). No authentication, no API key, and **zero runtime dependencies** — it
runs with just `bun`. The board is scoped to Indonesia; postings are a mix of
Bahasa Indonesia and English.

## ⚠️ Personal use only

This reads Glints' public GraphQL search endpoint and public job pages. Glints'
`robots.txt` disallows its HTML search page (`*/opportunities/jobs/explore?*`), so
this skill deliberately uses the unauthenticated GraphQL search endpoint instead.
Automated access may still conflict with Glints' Terms of Service: **keep volume
low and don't use it commercially or for bulk data collection.** Run it on your
own responsibility.

## When to use this skill

- Search for job openings in Indonesia by keyword, job title, or skill
- Filter by city/area (`--location Jakarta`, `--location Bandung`) or recency (`--jobage`)
- Get the full description, skills, and deadline of a specific posting

## Commands

### Search job listings

```bash
bun run .agents/skills/glints-search/cli/src/cli.ts search [flags]
```

Key flags:
- `--query <text>` / `-q <text>` — keyword search (job title, skill, role).
- `--location <place>` / `-l <place>` — city/area. Resolved to a Glints location id
  when the place is one of Glints' known locations; otherwise the place is folded
  into the keywords (Glints' location index is a short suggestion list — see Notes).
- `--jobage <days>` — posted within N days. Applied **client-side** (see Notes).
- `--page <n>` — 1-indexed page (50 results/page). Anonymous access is fenced after
  the first page (see Notes).
- `--limit <n>` / `-n <n>` — cap total results emitted (client-side).
- `--format json|table|plain` — default `json`.

At least one of `--query` or `--location` is required — an unfiltered search would
page through the whole board.

### Fetch full job detail

```bash
bun run .agents/skills/glints-search/cli/src/cli.ts detail <id|url> [--format json|plain]
```

`id` is the UUID from `search` results (e.g. `e4cc66ac-3bfa-4fdf-b61f-c8406298b8a5`).
You may also pass a full Glints job URL. Returns the description, employment type,
work arrangement, skills, deadline, and apply link.

## Usage examples

```bash
# Data analyst roles across Indonesia
bun run .agents/skills/glints-search/cli/src/cli.ts search -q "data analyst" --format table

# Software engineers in Jakarta
bun run .agents/skills/glints-search/cli/src/cli.ts search -q "software engineer" -l Jakarta --format table

# Digital-marketing roles in Bandung, posted in the last 7 days
bun run .agents/skills/glints-search/cli/src/cli.ts search -q "digital marketing" -l Bandung --jobage 7 --format table

# Accounting roles, 10 results as JSON
bun run .agents/skills/glints-search/cli/src/cli.ts search -q "akuntansi" --limit 10 --format json

# Full details for a specific posting
bun run .agents/skills/glints-search/cli/src/cli.ts detail e4cc66ac-3bfa-4fdf-b61f-c8406298b8a5 --format plain
```

## Output formats

| Format | Best for |
|--------|----------|
| `json` | Default — programmatic use, passing IDs to `detail` |
| `table` | Quick human-readable scanning |
| `plain` | Reading a single job's full detail (`detail` command) |

All errors are written to **stderr** as `{ "error": "...", "code": "..." }` and the
process exits with code `1`.

## Notes

- Data comes from Glints' public GraphQL search API (`POST /api/v2/graphql`,
  operation `searchJobs`) plus server-rendered job pages — no credentials.
- **`searchJobs` (not `searchJobsV3`) is used** because the V3 variant returned a
  fixed fallback set regardless of the keyword.
- **Anonymous access is fenced.** The first page returns up to **50** results;
  deeper offsets (`offset ≳ 30`) return `NO_PERMISSION` ("please login for more
  information"). The CLI stops paging there and returns what it already has — it
  never errors on the fence. Narrow with `--query`/`--location` instead of paging.
- **`--jobage` is client-side.** `lastUpdatedAtRange` is accepted by the API but
  does not reliably filter, so the CLI filters on `createdAt` across up to 3 pages.
  Because of the anonymous fence, that is usually a single page of fresh results.
- `--location` resolution: Glints exposes only a short location suggestion list
  (~25 common cities/districts) rather than a general city search. The CLI matches
  against that list and, when a place is not covered, appends it to the keyword —
  which Glints' search handles well (e.g. `-q staff -l Bandung`).
- `id` values are UUIDs (not numeric). `detail` accepts a bare UUID or a full URL;
  Glints redirects the id-only URL to the canonical slugged page.
- Respect Glints' rate limits — the CLI retries 429/5xx with exponential backoff.
  Keep volume low; this is a personal-use tool.
