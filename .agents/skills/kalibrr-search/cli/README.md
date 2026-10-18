# kalibrr-cli

CLI for searching jobs on **Kalibrr Indonesia** (`kalibrr.id`) across any sector.

**Data source**: Kalibrr's public job board — search JSON at
`https://www.kalibrr.com/kjs/job_board/search`, detail from the server-rendered
Next.js `__NEXT_DATA__` on each job page.
**Authentication**: None required.
**Dependencies**: None (plain `bun` + `fetch` + JSON parsing). `bun install` is
optional and only pulls dev type defs.

> **Personal use only.** This reads Kalibrr's public job pages. Keep volume low,
> don't use it commercially or for bulk data collection, and run it on your own
> responsibility.

## Installation

```bash
cd .agents/skills/kalibrr-search/cli
bun install   # optional — only installs TypeScript dev types
```

The CLI runs without any install because it has zero runtime dependencies.

## Commands

| Command | Description |
|---------|-------------|
| `search` | Search job listings (`--query`, `--location`, `--jobage`, `--remote`) |
| `detail` | Fetch full detail for a single job listing |

`search` accepts `--format json|table|plain` (default `json`); `detail` accepts
`--format json|plain`. All errors are written to **stderr** as
`{ "error": "...", "code": "..." }` with exit code `1`.

## Quick examples

```bash
# Data analyst roles across Indonesia
bun run src/cli.ts search -q "data analyst" --format table

# Software engineers in Jakarta
bun run src/cli.ts search -q "software engineer" -l Jakarta --format table

# Remote digital-marketing roles
bun run src/cli.ts search -q "digital marketing" --remote remote --format table

# Full detail for one job
bun run src/cli.ts detail 274263 --format plain
```

See `../SKILL.md` for the full flag reference.

## Search flags

| Flag | Alias | Description |
|------|-------|-------------|
| `--query` | `-q` | Keywords (title / skill / role). Recommended. |
| `--location` | `-l` | City filter, e.g. `Jakarta`, `Bandung`, `Surabaya`. |
| `--jobage` | | Posted within N days (client-side; Kalibrr has no age parameter). |
| `--remote` | | `remote` \| `hybrid`. |
| `--page` | | 1-indexed page (15 results/page). |
| `--limit` | `-n` | Cap results emitted. |
| `--format` | | `json` \| `table` \| `plain`. |
