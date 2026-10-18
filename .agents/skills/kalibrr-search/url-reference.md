# Kalibrr Indonesia URL Reference

Endpoints and parsing anchors for `kalibrr.id` (Indonesia market). No
authentication. The site is a Next.js app; job data is embedded server-side in a
`__NEXT_DATA__` JSON blob rather than rendered as scrape-me HTML.

## Search

```
GET https://www.kalibrr.com/kjs/job_board/search
```

The `kjs` service is the job-search backend shared by the Kalibrr network; the
`.id` portal calls the `.com` origin. `limit` and `offset` are **required**.

Query params (from the site's `job_board` param map):

| Param | Meaning | Example |
|-------|---------|---------|
| `text` | Free-text query | `data analyst` |
| `location` | City name | `Jakarta`, `Bandung`, `Surabaya` |
| `country` | Country filter | `Indonesia` |
| `function` | Job function | `IT and Software` |
| `tenure` | Employment type | `Full time`, `Part time` |
| `company` | Company code | `ruangguru` |
| `work_experience` | Experience level code | `200` |
| `education_level` | Education level code | `550` |
| `is_work_from_home` | Remote | `true` |
| `is_hybrid` | Hybrid | `true` |
| `is_open_to_fresh_grads` | Fresh-grad friendly | `true` |
| `is_top_50_employer` | Top-50 employer | `true` |
| `limit` | Page size (**required**) | `15` |
| `offset` | Pagination offset (**required**) | `0`, `15`, `30`, … |

Note: a `sort` param is accepted but has no observable effect on the API
response, so the CLI does not expose it. There is **no posting-age parameter** —
`--jobage` is implemented client-side in the CLI.

### Response shape (JSON)

```jsonc
{
  "count": 517,               // total matches
  "search_text": "data analyst",
  "jobs": [
    {
      "id": 274263,
      "name": "Instrumen Engineering",       // title
      "company_name": "PT Patria Menara Abadi",
      "slug": "instrumen-engineering",
      "tenure": "Full time",
      "function": "Oil and Gas Industry",
      "is_work_from_home": false,
      "is_hybrid": false,
      "activation_date": "2026-10-16T07:55:03.701618+00:00",
      "application_end_date": "2026-11-07T17:00:00+00:00",
      "description": "<ul>…</ul>",           // full HTML
      "qualifications": "<ul>…</ul>",        // full HTML
      "company": { "code": "pt-patria-menara-abadi", "name": "PT Patria Menara Abadi" },
      "google_location": {
        "address_components": {
          "city": "South Jakarta",
          "region": "DKI Jakarta",
          "country": "Indonesia",
          "address_line_1": "…"
        }
      }
    }
  ]
}
```

Field → CLI mapping: `id` → `id` (string), `name` → `title`, `company_name` →
`company`, `google_location.address_components.{city, region}` → `location`,
`activation_date` (date part) → `date`, and `url` is built as
`https://www.kalibrr.id/id-ID/c/<company.code>/jobs/<id>/<slug>`.

## Detail

There is no standalone JSON detail endpoint. The job page is server-rendered and
ships the full record in `__NEXT_DATA__`:

```
GET https://www.kalibrr.id/id-ID/c/<company_code>/jobs/<id>/<slug>
```

A bare id resolves via redirect — the company code and slug are cosmetic. The CLI
uses `https://www.kalibrr.id/id-ID/c/x/jobs/<id>/x` for bare ids, which 302s to
the canonical URL.

Parsing anchor:

```
<script id="__NEXT_DATA__" type="application/json">{ … }</script>
```

Path into the payload: `props.pageProps.job` (camelCase fields):

| Field | Meaning |
|-------|---------|
| `id` | Job id |
| `name` | Title |
| `slug` | URL slug |
| `company.code` / `company.name` | Company |
| `googleLocation.addressComponents.{city, region}` | Location (note camelCase) |
| `activationDate` | Posted date |
| `applicationEndDate` | Deadline |
| `description` / `qualifications` | Full HTML blobs |
| `tenure` | Employment type |
| `function` | Job function |
| `applyRedirectUrl` | External apply link (nullable) |
| `active` + `props.pageProps.isExpired` | Active/expired status |

The CLI decodes entities and strips tags from `description`/`qualifications`,
preserving paragraph breaks.

## Metadata (optional)

```
GET https://www.kalibrr.com/api/job_board/metadata
```

Returns available `functions`, `countries`, and `companies` with counts. Useful
for discovering valid filter values.

## Notes

- `robots.txt` (`.id` and `.com`) allows the search and job paths; it only
  disallows `/root` and `/candidate/profile`. No login is required.
- Keep volume low — this is a personal-use CLI; it backs off on 429/5xx.
- The board is scoped to Indonesia via `country=Indonesia`.
