# Karirhub (karirhub.kemnaker.go.id) URL Reference

Public, unauthenticated JSON endpoints used by this skill. Karirhub is the national
job board run by Indonesia's Ministry of Manpower (Kemnaker / SIAPkerja). All three
backing hosts are public — no login, no paid fetching service, and `robots.txt`
carries only content-signal comments (no `Disallow`).

> Public data — keep volume low and use it personally.

## Hosts

| Host | Used for |
|------|----------|
| `api.algolia.kemnaker.go.id` | Search (Algolia proxy in front of the `karirhub_industrial_vacancies` index) |
| `api.kemnaker.go.id` | Vacancy detail + city/province resolution |
| `karirhub.kemnaker.go.id` | Human-facing job pages (linked, never fetched) |

## 1. Search — Algolia proxy

```
POST https://api.algolia.kemnaker.go.id/1/indexes/*/queries
```

Headers:

| Header | Value |
|--------|-------|
| `Content-Type` | `application/json` |
| `X-Algolia-Application-Id` | `L3WWP72HSI` |
| `X-Algolia-API-Key` | `alps_6bdce80b58a0fa863d43f15cd5cbac204d6d76d227437d91` |

These are the **public search-only credentials the portal ships in its own client
bundle** (Algolia search keys are read-only by design). They are not secrets and
grant search access only.

Request body — the Algolia "multiple queries" envelope with a single request whose
`params` is a URL-encoded query string:

```json
{
  "requests": [
    {
      "indexName": "karirhub_industrial_vacancies",
      "params": "query=marketing&hitsPerPage=20&page=0"
    }
  ]
}
```

### `params` fields

| Field | Meaning | Notes |
|-------|---------|-------|
| `query` | Free-text keyword | Title / company / function matching; empty = all |
| `hitsPerPage` | Page size | The portal uses **20** |
| `page` | 0-indexed page | The CLI's `--page` (1-indexed) maps to `page - 1` |
| `numericFilters` | JSON array, e.g. `["published_at>1792174127"]` | `--jobage N` → `published_at > now − N·86400` (unix seconds) |
| `facetFilters` | JSON array of facet values | Location, see below |

Location facets use the value format `locations:<kind>:<id>` where `<kind>` is
`city` or `province`. A single value is a flat array; several matching localities
are an OR group (an array containing an array):

```
# one locality
facetFilters=["locations:province:d5b90b58-bfb2-4afa-b754-d1280dabe9b3"]

# OR across several
facetFilters=[["locations:city:<id1>","locations:city:<id2>"]]
```

### Response shape

```jsonc
{
  "results": [
    {
      "hits": [ /* see hit fields below */ ],
      "nbHits": 3037,      // total matches
      "page": 0,           // 0-indexed
      "nbPages": 1000,     // capped at 1000
      "hitsPerPage": 20
    }
  ]
}
```

Hit fields the CLI relies on:

| Field | Type | Meaning |
|-------|------|---------|
| `id` | UUID string | Vacancy id — pass to `detail` |
| `objectID` | string | Algolia object id (`Karirhub\...\ScoutIndustrialVacancy::<id>`) — fallback id |
| `title` | string | Job title |
| `company_name` | string | Employer name |
| `city_name` | string | Display city (e.g. `Kota Surabaya`) |
| `locations` | string[] | Facet values: `["city:<id>","province:<id>"]` |
| `published_at` | unix seconds | Posting timestamp (preferred date source) |
| `created_at` | `"YYYY-MM-DD HH:MM:SS"` | Fallback date source |
| `expires_at` | unix seconds | Deadline |
| `job_type_name` | string | `Full time` / `Part time` / … |
| `platform_type` | string | `internal` (apply on Karirhub) or `external` (partner board) |
| `platform_link` | string \| null | Off-site apply link for external postings |
| `industry_name` | string | Industry label |
| `job_function_name` | string | Job function label |
| `total_applicants` | number | Applicant count |
| `show_salary` | boolean | Whether salary is public |
| `min_salary_amount` / `max_salary_amount` / `*_currency` | number / string | Salary range |
| `_highlightResult` | object | HTML `<em>`-wrapped matches — not parsed |

## 2. Detail — vacancy by id

```
GET https://api.kemnaker.go.id/karirhub/vacancy/v2/published-industrial-vacancies/<uuid>
```

Response:

```jsonc
{
  "data": {
    "id": "63f1eed6-b93b-4967-8bc4-28cd69899ef0",
    "title": "OPERATOR PRODUKSI",
    "published_at": "2026-09-19",          // date string, not unix
    "expires_at": "2026-12-19",            // date string
    "description": "<ol><li>…</li></ol>",  // HTML
    "qualification": "<ol><li>…</li></ol>",// HTML
    "show_salary": true,
    "min_salary_currency": "IDR",
    "min_salary_amount": 5938885,
    "max_salary_currency": "IDR",
    "max_salary_amount": 6000000,
    "total_applicants": 14862,
    "platform_type": "internal",           // or "external"
    "platform_link": null,
    "employer": {
      "name": "PT. Pahala Bahari Nusantara",
      "employerable": { "industry": { "name": "Food & Beverage" } }
    },
    "region": { "name": "Pasirsari, Cikarang Selatan, Kab. Bekasi, Jawa Barat" },
    "job_type": { "name": "Full time" },
    "job_function": { "name": "Manufaktur dan Produksi" }
  }
}
```

A 404 (or any unknown id) yields no `data`; the CLI reports `NOT_FOUND`. HTML in
`description`/`qualification` is converted to plain text (entities decoded, tags
stripped, `<li>` bulleted, paragraph/list breaks kept as newlines).

## 3. Region resolution — cities & provinces

```
GET https://api.kemnaker.go.id/karirhub/onboarding/v2/cities?keyword=<name>&limit=<n>
GET https://api.kemnaker.go.id/karirhub/onboarding/v2/provinces?keyword=<name>&limit=<n>
```

Response:

```jsonc
{ "data": [ { "id": "<uuid>", "name": "Kota Adm. Jakarta Pusat", "province_id": "…" } ] }
```

The CLI strips administrative prefixes (`Kota Adm.`, `Kota`, `Kabupaten`, `Kab.`,
`Adm.`) before matching, prefers an exact name match over a token-start match, and
prefers a **province** over its cities (so `-l Jakarta` covers the whole metro
rather than one administrative city). The resolved id is fed back into the
`facetFilters` above.

## 4. Human-facing job URL

```
https://karirhub.kemnaker.go.id/lowongan-dalam-negeri/lowongan/<slug>-<uuid>
```

The slug is cosmetic — the portal resolves the posting from the trailing UUID, so
the CLI can emit a slug derived from the title. Linked only; never fetched.

## Discovery notes (for a future maintainer)

- The Algolia app id / key and index name were extracted from the portal's own
  JavaScript bundle. If search starts returning errors, re-grep the bundle for
  `api.algolia.kemnaker.go.id`, `X-Algolia-API-Key`, and the index name.
- `api.kemnaker.go.id` returns `{"data": …}` for both detail and region calls.
- Algolia `nbPages` is capped at 1000 regardless of `nbHits`.
