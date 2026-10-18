---
name: bossai-search
version: 1.0.0
description: >
  Make sure to use this skill whenever the user wants to search for jobs in
  Indonesia, find Indonesian job listings, look up a specific job posting, or
  asks anything about the Indonesian job market on BossAi (boss.id) — even if
  they don't mention boss.id explicitly. Invoke this skill for open positions,
  vacancies, and hiring across any sector (software, data, finance, marketing,
  education, admin, engineering, blue-collar, etc.) in Indonesian cities or
  remotely. Also trigger for phrases like "find me a job in Jakarta", "are there
  any data analyst jobs in Indonesia", or "what jobs are available in Surabaya".
  Trigger phrases include: bossai, boss ai, boss.id, bossjob indonesia, lowongan
  kerja, lowongan kerja Indonesia, cari kerja, info lowongan, loker, kerja di
  Jakarta, lowongan Jakarta, lowongan Bandung, lowongan Surabaya, lowongan
  remote Indonesia, lowongan data analyst, lowongan software engineer, lowongan
  marketing, lowongan akuntansi, jobs in Indonesia, indonesian jobs, job search
  Indonesia, work in Indonesia, hiring Indonesia, job vacancy Indonesia, IT jobs
  Indonesia, remote jobs Indonesia, data analyst job indonesia, software
  engineer job jakarta.
context: fork
enabled: true  # set to false to keep this portal installed but have /scrape skip it
allowed-tools: Bash(bun run .agents/skills/bossai-search/cli/src/cli.ts *)
---

# BossAi Indonesia Search Skill

Search live job listings from **BossAi** (`boss.id`) — the Indonesian job board
operated by Bossjob SEA. No authentication, no API key, and **zero runtime
dependencies** — it runs with just `bun`. Postings are a mix of Bahasa Indonesia
and English.

> **Personal use only.** This reads BossAi's public job endpoints. Keep volume
> low, don't use it commercially or for bulk data collection, and run it on your
> own responsibility.

## When to use this skill

- Search for job openings in Indonesia by keyword, job title, or skill
- Narrow to a city by including it in the query (the API has no location parameter)
- Filter by recency with `--jobage` (client-side; see Notes)
- Get the full description, requirements, company, and dates of a specific posting

## Commands

### Search job listings

```bash
bun run .agents/skills/bossai-search/cli/src/cli.ts search [flags]
```

Key flags:
- `--query <text>` / `-q <text>` — keyword search (job title, skill, role, or city). Recommended.
- `--jobage <days>` — posted within N days. Applied **client-side** (see Notes).
- `--page <n>` — page number (1-indexed, 20 results per page).
- `--limit <n>` / `-n <n>` — cap total results emitted (client-side).
- `--format json|table|plain` — default `json`.

> **Location note**: BossAi exposes no separate location parameter. To search a
> city, fold it into `--query` (e.g. `-q "accounting Jakarta"` or
> `-q "sales Bandung"`). There is likewise no server-side workplace-type filter.

### Fetch full job detail

```bash
bun run .agents/skills/bossai-search/cli/src/cli.ts detail <id|url> [--format json|plain]
```

`id` is the numeric job ID from `search` results (e.g. `435434`). You may also
pass a full BossAi job URL. Returns the description, requirements, skills,
company, employment type, work arrangement, experience, salary, posting date,
deadline, and active/expired status.

## Usage examples

```bash
# Data analyst roles across Indonesia
bun run .agents/skills/bossai-search/cli/src/cli.ts search -q "data analyst" --format table

# Software engineers (city is part of the query)
bun run .agents/skills/bossai-search/cli/src/cli.ts search -q "software engineer" --format table

# Accounting roles in Jakarta, posted in the last 7 days
bun run .agents/skills/bossai-search/cli/src/cli.ts search -q "accounting Jakarta" --jobage 7 --format table

# Sales roles in Bandung, page 2
bun run .agents/skills/bossai-search/cli/src/cli.ts search -q "sales Bandung" --page 2 --format json

# Full details for a specific posting
bun run .agents/skills/bossai-search/cli/src/cli.ts detail 435434 --format plain
```

## Output formats

| Format | Best for |
|--------|----------|
| `json` | Default — programmatic use, passing IDs to `detail` |
| `table` | Quick human-readable scanning |
| `plain` | Reading a single job's full detail (`detail` command) |

Each result carries `id`, `title`, `company`, `location`, `date`, and `url`
(missing values are `null`), plus `employmentType`, `workArrangement`,
`experience`, `salary`, `deadline`, and `isActive`.

All errors are written to **stderr** as `{ "error": "...", "code": "..." }` and
the process exits with code `1`.

## Notes

- Data comes from BossAi's public JSON endpoints (`/jobs/search` and
  `/jobs/<id>`) — no credentials required.
- Requests send `Country-Id: 96` and `Site-Id: 2` headers to select the
  Indonesian tenant. Without them the shared backend returns Philippines
  postings, so these headers are essential (see `url-reference.md`).
- **`--jobage` is applied client-side.** BossAi exposes no posting-age
  parameter, so the CLI filters the fetched page on `published_at`; a page may
  therefore yield fewer results than its raw size (20/page). Use it as a
  freshness refinement, not as exhaustive coverage.
- **No location or workplace-type request parameter.** Put the city in
  `--query`. Results do report `location`, `workArrangement`, and `isRemote`-style
  fields for client-side reading.
- `api.bossjob.com/robots.txt` allows `/jobs/` and disallows the rest; the CLI
  only reads `/jobs/search` and `/jobs/<id>`. Keep volume low regardless.
- The CLI retries 429/5xx with exponential backoff, and treats a 404 as a clean
  `NOT_FOUND`.
