---
name: karirhub-search
version: 1.0.0
description: >
  Make sure to use this skill whenever the user wants to search for jobs in
  Indonesia, find Indonesian job listings, look up a specific job posting, or
  asks anything about the Indonesian job market on Karirhub — even if they don't
  mention karirhub.kemnaker.go.id explicitly. Invoke this skill for open positions,
  vacancies, and hiring across any sector (software, data, finance, marketing,
  education, admin, engineering, blue-collar, etc.) in Indonesian cities or
  provinces. Karirhub is the national job board run by Indonesia's Ministry of
  Manpower (Kemnaker/SIAPkerja). Also trigger for phrases like "find me a job in
  Jakarta", "are there any data analyst jobs in Indonesia", or "what jobs are
  available in Surabaya". Trigger phrases include: karirhub, karirhub kemnaker,
  kemnaker, siapkerja, lowongan kerja, lowongan kerja Indonesia, cari kerja, info
  lowongan, loker, kerja di Jakarta, lowongan Jakarta, lowongan Bandung, lowongan
  Surabaya, lowongan Yogyakarta, lowongan Jawa Timur, lowongan operator produksi,
  lowongan admin, lowongan marketing, lowongan akuntansi, lowongan software
  engineer, lowongan data analyst, lowongan remote Indonesia, jobs in Indonesia,
  indonesian jobs, job search Indonesia, work in Indonesia, hiring Indonesia, job
  vacancy Indonesia, IT jobs Indonesia, remote jobs Indonesia, data analyst job
  indonesia, software engineer job jakarta.
context: fork
enabled: true  # set to false to keep this portal installed but have /scrape skip it
allowed-tools: Bash(bun run .agents/skills/karirhub-search/cli/src/cli.ts *)
---

# Karirhub Indonesia Search Skill

Search live job listings from **Karirhub** (`karirhub.kemnaker.go.id`), the national
job board run by Indonesia's **Ministry of Manpower (Kemnaker / SIAPkerja)**. No
authentication, no API key, and **zero runtime dependencies** — it runs with just
`bun`. The board is scoped to Indonesia; postings are a mix of Bahasa Indonesia and
English.

## When to use this skill

- Search for job openings in Indonesia by keyword, job title, or skill
- Filter by city or province (`--location Jakarta`, `--location Bandung`,
  `--location "Jawa Timur"`) or by recency (`--jobage`)
- Get the full description, qualification, salary, and deadline of a specific posting

## Commands

### Search job listings

```bash
bun run .agents/skills/karirhub-search/cli/src/cli.ts search [flags]
```

Key flags:
- `--query <text>` / `-q <text>` — keyword search (job title, skill, role).
- `--location <place>` / `-l <place>` — Indonesian **city or province**, e.g.
  `Jakarta`, `Bandung`, `Surabaya`, `"Jawa Timur"`. Resolved to a region id through
  Karirhub's public region API and applied as a real location filter.
- `--jobage <days>` — posted within N days (applied server-side — see Notes).
- `--page <n>` — 1-indexed page (20 results/page).
- `--limit <n>` / `-n <n>` — cap total results emitted (client-side).
- `--format json|table|plain` — default `json`.

At least one of `--query` or `--location` is required — an unfiltered search would
page through the whole board.

### Fetch full job detail

```bash
bun run .agents/skills/karirhub-search/cli/src/cli.ts detail <id|url> [--format json|plain]
```

`id` is the vacancy UUID from `search` results (e.g.
`01a145e6-f968-735e-b4aa-a14d6af06a01`). You may also pass a full Karirhub job URL.
Returns the description, qualification, employment type, job function, industry,
salary (when the employer publishes it), deadline, applicant count, and apply link.

## Usage examples

```bash
# Marketing roles across Indonesia
bun run .agents/skills/karirhub-search/cli/src/cli.ts search -q "marketing" --format table

# Software engineers in Jakarta
bun run .agents/skills/karirhub-search/cli/src/cli.ts search -q "software engineer" -l Jakarta --format table

# Accounting roles in Surabaya, posted in the last 7 days
bun run .agents/skills/karirhub-search/cli/src/cli.ts search -q "akuntansi" -l Surabaya --jobage 7 --format table

# Any role in East Java, newest 10 as JSON
bun run .agents/skills/karirhub-search/cli/src/cli.ts search -l "Jawa Timur" --limit 10 --format json

# Production-operator roles in Bekasi
bun run .agents/skills/karirhub-search/cli/src/cli.ts search -q "operator produksi" -l Bekasi --format table

# Full details for a specific posting
bun run .agents/skills/karirhub-search/cli/src/cli.ts detail 63f1eed6-b93b-4967-8bc4-28cd69899ef0 --format plain
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

- Data comes from Karirhub's public, unauthenticated endpoints: the site's Algolia
  search index (`karirhub_industrial_vacancies`, reached through the portal's own
  `api.algolia.kemnaker.go.id` proxy host) for search, plus
  `api.kemnaker.go.id/karirhub/vacancy/v2/published-industrial-vacancies/<id>` for
  detail and `api.kemnaker.go.id/karirhub/onboarding/v2/{cities,provinces}` for
  location resolution. No credentials; `robots.txt` carries no `Disallow` rules.
- **`--location` is a real filter, not a keyword.** The place name is resolved to a
  `city` or `province` id; provinces are preferred when both match (so `-l Jakarta`
  covers the whole metro). If a name can't be resolved the CLI exits `1` with
  `LOCATION_NOT_FOUND` — try a nearby city or the province name.
- **`--jobage` is applied server-side** via a `numericFilters` clause on the index's
  `published_at`. The portal's own listing page sorts by recency, but the Algolia
  index returns by relevance by default; a small `--jobage` window narrows the set
  before paging.
- Page size is fixed at 20 results per page.
- `id` values are UUIDs (not numeric). `detail` accepts a bare UUID or a full URL.
- Some postings are **external** (`platformType: "external"` with a `platformLink`)
  — those originate from partner boards such as Glints TapLoker and Toploker and the
  apply link points off-site. `detail` still returns Karirhub's own description.
- Salary is only shown when the employer publishes it (`salary` is `null` otherwise).
- Respect Karirhub's rate limits — the CLI retries 429/5xx with exponential backoff.
  Keep volume low; this is a personal-use tool.
