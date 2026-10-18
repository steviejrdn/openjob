# bossai-cli

CLI for searching jobs on **BossAi** (`boss.id`) — the Indonesian job board
operated by Bossjob SEA.

**Data source**: BossAi's public JSON endpoints —
search at `https://api.bossjob.com/jobs/search`, detail at
`https://api.bossjob.com/jobs/<id>`.
**Authentication**: None required.
**Dependencies**: None (plain `bun` + `fetch` + JSON parsing). `bun install` is
optional and only pulls dev type defs.

> **Personal use only.** This reads BossAi's public job endpoints. Keep volume
> low, don't use it commercially or for bulk data collection, and run it on your
> own responsibility.

## Installation

```bash
cd .agents/skills/bossai-search/cli
bun install   # optional — only installs TypeScript dev types
```

The CLI runs without any install because it has zero runtime dependencies.

## Commands

| Command | Description |
|---------|-------------|
| `search` | Search job listings (`--query`, `--jobage`, `--page`, `--limit`) |
| `detail` | Fetch full detail for a single job listing |

`search` accepts `--format json|table|plain` (default `json`); `detail` accepts
`--format json|plain`. All errors are written to **stderr** as
`{ "error": "...", "code": "..." }` with exit code `1`.

## Quick examples

```bash
# Data analyst roles across Indonesia
bun run src/cli.ts search -q "data analyst" --format table

# Software engineers (city must be part of the query string)
bun run src/cli.ts search -q "software engineer" --format table

# Accounting roles in Jakarta, posted in the last 7 days
bun run src/cli.ts search -q "accounting Jakarta" --jobage 7 --limit 10 --format json

# Full detail for one job
bun run src/cli.ts detail 435434 --format plain
```

See `../SKILL.md` for the full flag reference.

## Search flags

| Flag | Alias | Description |
|------|-------|-------------|
| `--query` | `-q` | Keywords (title / skill / role). Include a city here to narrow by location. |
| `--jobage` | | Posted within N days (client-side; BossAi has no age parameter). |
| `--page` | | 1-indexed page (20 results/page). |
| `--limit` | `-n` | Cap results emitted. |
| `--format` | | `json` \| `table` \| `plain`. |

## Notes

- Requests send `Country-Id: 96` and `Site-Id: 2` headers to select the
  Indonesian tenant; without them the backend returns Philippines postings.
- There is no server-side location or workplace-type filter — put the city in
  `--query`.
