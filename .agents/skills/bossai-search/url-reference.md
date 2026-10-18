# BossAi (boss.id) URL Reference

Public, unauthenticated JSON endpoints used by this skill. BossAi is the
Indonesian tenant of the shared Bossjob platform; the backend is a single
multi-country service, so requests must select the Indonesian tenant with
headers (see below). `robots.txt` on `api.bossjob.com` allows `/jobs/` and
disallows everything else, and the CLI only reads the two `/jobs/` endpoints.

> Personal use only — keep volume low.

## Tenant selection (required headers)

Every request sends:

| Header | Value | Meaning |
|--------|-------|---------|
| `Country-Id` | `96` | Indonesia. **Without this the API returns Philippines postings.** |
| `Site-Id` | `2` | The BossAi site variant (vs `1`). |
| `X-Server-Client` | `jobseeker-client` | Matches the web client. |

These values come from the site's country table (`Indonesia: { key: "id", id: 96,
isBossAi: true }`) and its axios request interceptor. A normal browser
`User-Agent` is not required, but the CLI sends an honest
`Mozilla/5.0 (compatible; bossai-search-cli/1.0)`.

## Search

```
GET https://api.bossjob.com/jobs/search
```

Query params:

| Param | Meaning | Example |
|-------|---------|---------|
| `query` | Free-text query (title, skill, company, or city) | `data analyst` |
| `page` | 1-indexed page | `1`, `2`, … |
| `size` | Page size | `20` |
| `sort` | `1` = Newest, `2` = Relevance | `1` |
| `source` | Constant the web client sends | `web` |

There is **no location, workplace-type, or posting-age parameter**. Values such
as `job_locations`, `region_ids`, `location_ids`, `job_region_id`, etc. are
accepted but have no effect on the result set — put the city in `query` instead.

### Response shape (JSON)

```jsonc
{
  "code": 0,
  "message": "Success",
  "data": {
    "jobs": [
      {
        "id": 435434,
        "job_title": "Software Developer",
        "company_name": "PT Softorb Technology Indonesia",
        "job_location": "Jakarta Selatan",
        "job_region": "Jakarta",
        "job_country": "Indonesia",
        "job_url": "/job/software-engineer-jakarta-selatan-435434",
        "job_type": "Full-time",
        "work_arrangement": "On-site",
        "xp_lvl": "1-3 Yrs Exp",
        "salary_range_value": "Negotiable",
        "published_at": "2026-01-30 11:31:53",
        "published_at_date": "20260130",
        "expired_at": "2026-10-27 11:31:53",
        "status_key": "active"
      }
    ],
    "page": 1,
    "total_pages": 30,
    "size": 20,
    "total_num": 433,
    "sort": 1,
    "query_id": "75b43550-…",
    "reco_from": "search"
  }
}
```

Field → CLI mapping: `id` → `id` (string), `job_title` → `title`,
`company_name` → `company`, `job_location` + `job_region` → `location` (falls
back to "Remote" for cityless remote roles), `published_at_date` (or
`published_at`) → `date`, `job_url` prefixed with `https://boss.id/id` → `url`,
`job_type` → `employmentType`, `work_arrangement` → `workArrangement`, `xp_lvl`
→ `experience`, `salary_range_value` → `salary`, `expired_at` → `deadline`,
`status_key === "active"` → `isActive`.

## Detail

```
GET https://api.bossjob.com/jobs/<id>?lang=id
```

Returns the same `{ code, message, data }` envelope with a single job:

| Field path | Meaning |
|------------|---------|
| `data.id` | Job id |
| `data.job_title` | Title |
| `data.company.name` | Company name |
| `data.location.value` / `data.location.region` | City / region |
| `data.job_url` | Site-relative URL (prepend `https://boss.id/id`) |
| `data.published_at` | Posted date, **`30 Jan 2026`** (different shape to search!) |
| `data.expired_at` | Deadline (`YYYY-MM-DD HH:mm:ss`) |
| `data.job_type_value` | Employment type |
| `data.work_arrangement.name` | On-site / Remote / Hybrid |
| `data.xp_lvl.value` | Experience level |
| `data.salary_range_value` | Salary text |
| `data.degree.value` | Qualification |
| `data.status_key` | `active` / … |
| `data.job_description` | Plain-text description |
| `data.job_description_html` | HTML description (preferred; decoded + tag-stripped) |
| `data.job_requirements` / `data.job_requirements_html` | Requirements |
| `data.skills` | Array of `{ name }` or strings |
| `data.external_apply_url` | Off-platform apply link, or null (apply in-app) |

A bare numeric id resolves directly — no slug is needed. The public job page is
`https://boss.id/id/job/<slug>-<id>`, but detail is fetched from the `/jobs/<id>`
API rather than by scraping that page.

## Date normalization

The API uses three date shapes; the CLI normalizes all of them to `YYYY-MM-DD`:

| Input | Source | Output |
|-------|--------|--------|
| `20260130` | search `published_at_date` | `2026-01-30` |
| `2026-01-30 11:31:53` | search `published_at` / `expired_at` | `2026-01-30` |
| `30 Jan 2026` | detail `published_at` | `2026-01-30` |

## Notes

- No authentication required; `api.bossjob.com/robots.txt` permits `/jobs/`.
- `--jobage` is client-side (no server age filter).
- Page size is 20; the CLI requests one page per invocation.
- The backend backs off the same as the other portal CLIs (429/5xx retry, 404 →
  `NOT_FOUND`).
