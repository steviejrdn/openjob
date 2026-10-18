# dealls-cli

CLI for searching jobs on **Dealls** (dealls.com), one of Indonesia's largest job
portals, across any sector and Indonesian city.

**Data source**: Dealls' public JSON API (`api.sejutacita.id/v1/explore-job/job` for
search, `/v1/job-portal/job/<id>` for detail).
**Authentication**: None required.
**Dependencies**: None (plain `bun` + `fetch` + JSON). `bun install` is optional and only
pulls dev type definitions.

## Installation

```bash
cd .agents/skills/dealls-search/cli
bun install   # optional — only installs TypeScript dev types
```

The CLI runs without any install because it has zero runtime dependencies.

## Commands

| Command | Description |
|---------|-------------|
| `search` | Search job listings (`--query` and/or `--location` required) |
| `detail` | Fetch full detail for a single posting (id, slug, or `/loker/` URL) |

`search` accepts `--format json|table|plain` (default `json`); `detail` accepts
`--format json|plain`. All errors are written to **stderr** as
`{ "error": "...", "code": "..." }` with exit code `1`.

## Quick examples

```bash
# Data analyst roles anywhere in Indonesia
bun run src/cli.ts search -q "data analyst" --format table

# Software engineer roles in Jakarta Selatan, posted in the last 30 days
bun run src/cli.ts search -q "software engineer" -l "Jakarta Selatan" --jobage 30 --format table

# Fully remote digital-marketing roles in Bandung
bun run src/cli.ts search -q "digital marketing" -l "Bandung" --workplace remote --format table

# Full detail for one posting
bun run src/cli.ts detail 6ad0a38d879b500012fa234e --format plain
```

See `../SKILL.md` for the full flag reference.

## Search flags

| Flag | Alias | Description |
|------|-------|-------------|
| `--query` | `-q` | Keywords (title / skill / company). Indonesian or English. |
| `--location` | `-l` | City name, e.g. `"Jakarta Selatan"`, `"Bandung"`, `"Surabaya"`. |
| `--jobage` | | Posted within N days (client-side; Dealls has no date filter). |
| `--workplace` | | `onSite` \| `remote` \| `hybrid`. |
| `--type` | | `fullTime` \| `partTime` \| `contract` \| `freelance` \| `internship`. |
| `--sort` | | `relevant` (default) \| `newest`. |
| `--page` | | 1-indexed page (18 results/page). |
| `--limit` | `-n` | Cap results emitted (client-side). |
| `--format` | | `json` \| `table` \| `plain`. |

## Notes

- No credentials, no login, no HTML scraping of listing pages — listings come from JSON.
- `--location` is matched against Dealls' city list by exact name first, then substring.
- `--jobage` sorts newest-first and walks up to 5 pages, dropping postings older than N days.
