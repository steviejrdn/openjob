# karirhub-cli

CLI for searching jobs on **Karirhub** (`karirhub.kemnaker.go.id`), the public job
board run by Indonesia's Ministry of Manpower (Kemnaker), across any sector and
Indonesian city or province.

**Data source**: the public Algolia index `karirhub_industrial_vacancies` (through
the site's own `api.algolia.kemnaker.go.id` host) for search, plus the public JSON
endpoint `api.kemnaker.go.id/karirhub/vacancy/v2/published-industrial-vacancies/<id>`
for detail.
**Authentication**: None required.
**Dependencies**: None (plain `bun` + `fetch`). `bun install` is optional and only
pulls dev type defs.

## Installation

```bash
cd .agents/skills/karirhub-search/cli
bun install   # optional — only installs TypeScript dev types
```

The CLI runs without any install because it has zero runtime dependencies.

## Commands

| Command | Description |
|---------|-------------|
| `search` | Search for job listings (`--query` and/or `--location`) |
| `detail` | Fetch full detail for a single job listing |

`search` accepts `--format json|table|plain` (default `json`); `detail` accepts
`--format json|plain`. All errors are written to **stderr** as
`{ "error": "...", "code": "..." }` with exit code `1`.

## Quick examples

```bash
# Marketing roles across Indonesia
bun run src/cli.ts search -q "marketing" --format table

# Software engineers in Jakarta
bun run src/cli.ts search -q "software engineer" -l Jakarta --format table

# Accounting roles in Surabaya, posted in the last 7 days
bun run src/cli.ts search -q "akuntansi" -l Surabaya --jobage 7 --format table

# Any role in East Java
bun run src/cli.ts search -l "Jawa Timur" --limit 10 --format json

# Full detail for one job
bun run src/cli.ts detail 63f1eed6-b93b-4967-8bc4-28cd69899ef0 --format plain
```

See `../SKILL.md` for the full flag reference and Notes.

## Search flags

| Flag | Alias | Description |
|------|-------|-------------|
| `--query` | `-q` | Keywords (title / skill / role). |
| `--location` | `-l` | Indonesian city or province, e.g. `Jakarta`, `Bandung`, `"Jawa Timur"`. |
| `--jobage` | | Posted within N days. |
| `--page` | | 1-indexed page (20 results/page). |
| `--limit` | `-n` | Cap results emitted (client-side). |
| `--format` | | `json` \| `table` \| `plain`. |

At least one of `--query` or `--location` is required.
