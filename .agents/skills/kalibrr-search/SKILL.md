---
name: kalibrr-search
version: 1.0.0
description: >
  Make sure to use this skill whenever the user wants to search for jobs in
  Indonesia, find Indonesian job listings, look up a specific job posting, or
  asks anything about the Indonesian job market on Kalibrr — even if they don't
  mention kalibrr.id explicitly. Invoke this skill for open positions, vacancies,
  and hiring across any sector (software, data, finance, marketing, education,
  admin, engineering, etc.) in Indonesian cities or remotely. Also trigger for
  phrases like "find me a job in Jakarta", "are there any data analyst jobs in
  Indonesia", or "what jobs are available in Bandung". Trigger phrases include:
  kalibrr, kalibrr indonesia, lowongan kerja, lowongan kerja Indonesia, cari
  kerja, info lowongan, loker, kerja di Jakarta, lowongan Jakarta, lowongan
  Bandung, lowongan Surabaya, lowongan remote Indonesia, lowongan data analyst,
  lowongan software engineer, lowongan marketing, lowongan akuntansi, jobs in
  Indonesia, indonesian jobs, job search Indonesia, work in Indonesia, hiring
  Indonesia, job vacancy Indonesia, IT jobs Indonesia, remote jobs Indonesia,
  data analyst job indonesia, software engineer job jakarta.
context: fork
enabled: true
allowed-tools: Bash(bun run .agents/skills/kalibrr-search/cli/src/cli.ts *)
---

# Kalibrr Indonesia Search Skill

Search live job listings from **Kalibrr Indonesia** (`kalibrr.id`). No
authentication, no API key, and **zero runtime dependencies** — it runs with just
`bun`. The board is scoped to Indonesia; postings are a mix of Bahasa Indonesia
and English.

## When to use this skill

- Search for job openings in Indonesia by keyword, job title, or skill
- Filter by city (`--location Jakarta`, `--location Bandung`) or workplace type
  (`--remote remote` / `--remote hybrid`)
- Filter by recency with `--jobage` (client-side; see Notes)
- Get the full description, qualifications, and deadline of a specific posting

## Commands

### Search job listings

```bash
bun run .agents/skills/kalibrr-search/cli/src/cli.ts search [flags]
```

Key flags:
- `--query <text>` / `-q <text>` — keyword search (job title, skill, role). Recommended.
- `--location <text>` / `-l <text>` — city filter, e.g. `Jakarta`, `Bandung`, `Surabaya`, `Yogyakarta`.
- `--jobage <days>` — posted within N days. Applied **client-side** (see Notes).
- `--remote <mode>` — `remote` (work from home) or `hybrid`.
- `--page <n>` — page number (1-indexed, 15 results per page).
- `--limit <n>` / `-n <n>` — cap total results emitted (client-side).
- `--format json|table|plain` — default `json`.

> **Location note**: Kalibrr supports a `location` filter as a real parameter, so
> `--location` works directly — there is no need to fold the city into `--query`.
> If a location returns nothing, try the plain city name (`Jakarta`) rather than
> "Jakarta Selatan".

### Fetch full job detail

```bash
bun run .agents/skills/kalibrr-search/cli/src/cli.ts detail <id|url> [--format json|plain]
```

`id` is the numeric job ID from `search` results (e.g. `274263`). You may also
pass a full Kalibrr job URL. Returns the description, qualifications, employment
type, function, deadline, apply link, and active/expired status.

## Usage examples

```bash
# Data analyst roles across Indonesia
bun run .agents/skills/kalibrr-search/cli/src/cli.ts search -q "data analyst" --format table

# Software engineers in Jakarta
bun run .agents/skills/kalibrr-search/cli/src/cli.ts search -q "software engineer" -l Jakarta --format table

# Remote digital-marketing roles
bun run .agents/skills/kalibrr-search/cli/src/cli.ts search -q "digital marketing" --remote remote --format table

# Accounting jobs in Surabaya posted in the last 7 days
bun run .agents/skills/kalibrr-search/cli/src/cli.ts search -q "accounting" -l Surabaya --jobage 7 --format table

# Hybrid UI/UX roles in Bandung, page 2
bun run .agents/skills/kalibrr-search/cli/src/cli.ts search -q "ui ux designer" -l Bandung --remote hybrid --page 2 --format json

# Full details for a specific posting
bun run .agents/skills/kalibrr-search/cli/src/cli.ts detail 274263 --format plain
```

## Output formats

| Format | Best for |
|--------|----------|
| `json` | Default — programmatic use, passing IDs to `detail` |
| `table` | Quick human-readable scanning |
| `plain` | Reading a single job's full detail (`detail` command) |

All errors are written to **stderr** as `{ "error": "...", "code": "..." }` and
the process exits with code `1`.

## Notes

- Data comes from Kalibrr's public job board (`/kjs/job_board/search` JSON plus the
  server-rendered job pages) — no credentials required.
- The board is scoped to `country=Indonesia`.
- **`--jobage` is applied client-side.** Kalibrr's API exposes no posting-age
  parameter, so the CLI filters the fetched page on `activation_date`; a page may
  therefore yield fewer results than its raw size (15/page). Use `--jobage` as a
  freshness refinement, not as exhaustive coverage.
- Page size is fixed at 15 results per page.
- `detail` accepts a bare numeric id: Kalibrr resolves a posting by id alone via
  a redirect, so the company slug is not required.
- Respect Kalibrr's rate limits — the CLI retries 429/5xx with exponential backoff.
  Keep volume low; this is a personal-use tool.
