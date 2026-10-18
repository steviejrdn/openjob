# glints-cli

Search jobs on **Glints Indonesia** (`glints.com/id`) from the command line.
No authentication, no API key, **zero runtime dependencies** — it runs with just
[`bun`](https://bun.sh).

## Install (dev types only)

```bash
bun install
```

## Usage

```bash
# Search by keyword
bun run src/cli.ts search -q "data analyst" --format table

# Search in a city, posted in the last 7 days
bun run src/cli.ts search -q "software engineer" -l Jakarta --jobage 7 --format table

# Cap results and emit JSON (default format)
bun run src/cli.ts search -q "digital marketing" --limit 10

# Full details for one posting
bun run src/cli.ts detail e4cc66ac-3bfa-4fdf-b61f-c8406298b8a5 --format plain
```

Run `bun run src/cli.ts --help` for the full flag reference.

## How it works

- **Search** — `POST https://glints.com/api/v2/graphql` with the `searchJobs`
  operation (the same query the site's own front-end issues).
- **Detail** — fetches the server-rendered page at
  `https://glints.com/id/opportunities/jobs/<uuid>` and reads the job record from
  the `__NEXT_DATA__` JSON blob.

Both endpoints are public and undocumented. `url-reference.md` (one level up)
records the details a future maintainer needs when the markup or schema changes.

## Testing

```bash
bun run typecheck   # tsc --noEmit
bun test            # includes live smoke tests against glints.com
```

Keep volume low — this is a personal-use tool.
