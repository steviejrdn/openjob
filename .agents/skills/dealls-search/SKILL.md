---
name: dealls-search
version: 1.0.0
description: >
  Make sure to use this skill whenever the user wants to search for jobs in
  Indonesia, find Indonesian job listings, look up a specific job posting, or
  asks anything about the Indonesian job market on Dealls — even if they don't
  mention dealls.com explicitly. Invoke this skill for open positions, vacancies,
  and hiring across any sector (software, data, finance, marketing, education,
  admin, engineering, blue-collar, etc.) in Indonesian cities or remotely. Also
  trigger for phrases like "find me a job in Jakarta", "are there any data
  analyst jobs in Indonesia", or "what jobs are available in Bandung". Trigger
  phrases include: dealls, dealls.com, lowongan kerja, lowongan kerja Indonesia,
  cari kerja, info lowongan, loker, kerja di Jakarta, lowongan Jakarta, lowongan
  Bandung, lowongan Surabaya, lowongan remote Indonesia, lowongan data analyst,
  lowongan software engineer, lowongan marketing, lowongan akuntansi, jobs in
  Indonesia, indonesian jobs, job search Indonesia, work in Indonesia, hiring
  Indonesia, job vacancy Indonesia, IT jobs Indonesia, remote jobs Indonesia.
context: fork
enabled: true  # set to false to keep this portal installed but have /scrape skip it
allowed-tools: Bash(bun run .agents/skills/dealls-search/cli/src/cli.ts *)
---

# Dealls Search Skill

Search live job listings from **Dealls** (dealls.com), one of Indonesia's largest
job portals, across any sector and any Indonesian city (or remote). No
authentication, no API key, and **zero runtime dependencies** — it runs with just
`bun`. Listings come from Dealls' public JSON API; no HTML scraping is involved.

## When to use this skill

- Search job openings in Indonesia by keyword (title, skill, or company)
- Filter by Indonesian city, workplace type (remote/hybrid/on-site), or employment type
- Find postings from the last N days
- Get the full description of a specific job listing

## Commands

### Search job listings

```bash
bun run .agents/skills/dealls-search/cli/src/cli.ts search [flags]
```

At least one of `--query`/`-q` or `--location`/`-l` is required (an unfiltered search
would dump the whole board).

Key flags:
- `--query <text>` / `-q <text>` — keywords: job title, skill, or company. Indonesian or English.
- `--location <city>` / `-l <city>` — city name from Dealls' list, e.g. `"Jakarta Selatan"`, `"Bandung"`, `"Surabaya"`. Matched by exact name first, then substring.
- `--jobage <days>` — posted within N days. Dealls has **no server-side date filter**; this sorts newest-first and filters client-side (walks up to 5 pages). Use `--limit` to bound how many you want.
- `--workplace <type>` — `onSite`, `remote`, or `hybrid`.
- `--type <employment>` — `fullTime`, `partTime`, `contract`, `freelance`, or `internship`.
- `--sort <mode>` — `relevant` (default) or `newest`.
- `--page <n>` — page number (1-indexed, 18 results per page).
- `--limit <n>` / `-n <n>` — cap total results emitted (client-side).
- `--format json|table|plain` — default `json`.

### Fetch full job detail

```bash
bun run .agents/skills/dealls-search/cli/src/cli.ts detail <id|url> [--format json|plain]
```

`id` is the Mongo id from `search` results (e.g. `6ad0a38d879b500012fa234e`). You may
also pass a Dealls `loker/<slug>~<company>` URL or a bare slug. Returns the full
description (responsibilities/requirements/perks), employment type, workplace type,
salary, apply URL, and whether the posting is still active.

## Usage examples

```bash
# Data analyst roles anywhere in Indonesia
bun run .agents/skills/dealls-search/cli/src/cli.ts search -q "data analyst" --format table

# Software engineer roles in Jakarta Selatan, posted in the last 30 days
bun run .agents/skills/dealls-search/cli/src/cli.ts search -q "software engineer" -l "Jakarta Selatan" --jobage 30 --format table

# Remote digital-marketing roles
bun run .agents/skills/dealls-search/cli/src/cli.ts search -q "digital marketing" --workplace remote --format table

# Accounting jobs in Surabaya, newest first
bun run .agents/skills/dealls-search/cli/src/cli.ts search -q "akuntansi" -l "Surabaya" --sort newest --limit 10 --format table

# Full details for a specific job
bun run .agents/skills/dealls-search/cli/src/cli.ts detail 6ad0a38d879b500012fa234e --format plain
```

## Output formats

| Format | Best for |
|--------|----------|
| `json` | Default — programmatic use, passing IDs to `detail` |
| `table` | Quick human-readable scanning |
| `plain` | Reading a single job's full detail (`detail` command) |

JSON search output is `{ "meta": { "count": <n>, "page": <n> }, "results": [...] }`;
each result carries at least `id`, `title`, `company`, `location`, `date`, `url`
(missing values are `null`, never omitted). All errors are written to **stderr** as
`{ "error": "...", "code": "..." }` and the process exits with code `1`.

## Notes

- Data comes from Dealls' public JSON API (`api.sejutacita.id`) — no credentials required.
- Location is filtered server-side by numeric city id; the CLI resolves the city **name** you pass against Dealls' city list. If the name isn't found it exits with code `LOCATION_NOT_FOUND`.
- There is no server-side posting-age filter: `--jobage` is applied client-side, so it is exact only for the pages the CLI fetches (up to 5), and it forces newest-first ordering.
- Page size is 18; the API rejects `limit` above 55.
- Job ids are 24-character hex Mongo ids (e.g. `6ad0a38d879b500012fa234e`) — pass them as-is to `detail`.
- The CLI retries 429/5xx with exponential backoff. Keep volume low.
