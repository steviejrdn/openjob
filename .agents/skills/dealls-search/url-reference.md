# Dealls URL Reference

Dealls (dealls.com) is an Indonesian job portal whose public web app is backed by a
JSON API on **`api.sejutacita.id`**. All endpoints below are public, unauthenticated,
and allowed by `https://dealls.com/robots.txt` (`User-agent: * / Allow: /`).

The web app is Next.js (pages router). Its server-rendered `__NEXT_DATA__` blob maps
the search page's react-query key directly to the search endpoint, which is how the
endpoint and its parameters were identified.

## Base URL

```
https://api.sejutacita.id
```

## Search

```
GET https://api.sejutacita.id/v1/explore-job/job
```

Query params (arrays use the `key[]=` bracket form):

| Param | Meaning | Example |
|-------|---------|---------|
| `search` | Free-text keywords (title / skill / company) | `data analyst` |
| `page` | 1-indexed page number | `1`, `2`, … |
| `limit` | Page size. Max **55**; the web app uses 18 | `18` |
| `published` | Only published postings | `true` |
| `status` | Job status | `active` |
| `cityIds[]` | City id (from the City endpoint) | `157` (Jakarta Pusat) |
| `workplaceTypes[]` | `onSite` \| `remote` \| `hybrid` | `remote` |
| `employmentTypes[]` | `fullTime` \| `partTime` \| `contract` \| `freelance` \| `internship` | `fullTime` |
| `sortParam` | `mostRelevant` or `publishedAt` | `publishedAt` |
| `sortBy` | `asc` \| `desc` (with `sortParam=publishedAt`, `desc` = newest) | `desc` |

Note: `sortBy` is validated against an enum — an invalid value returns HTTP 400. Unknown
params (e.g. `publishedWithin`, `createdAt`) are silently ignored, and **there is no
server-side posting-age/date filter**; `--jobage` is applied client-side by the CLI.

### Response shape

```json
{
  "code": 200,
  "data": {
    "docs": [ /* job documents */ ],
    "totalDocs": 11,
    "totalPages": 1,
    "page": 1
  }
}
```

Each search document carries the fields the skill maps:

| Contract field | Source path |
|----------------|-------------|
| `id` | `doc.id` (24-char hex Mongo id) |
| `title` | `doc.role` |
| `company` | `doc.company.name` |
| `location` | `doc.city.name` (fallback `doc.country.name`) |
| `date` | `doc.publishedAt` (ISO 8601) |
| `url` | `https://dealls.com/loker/<doc.slug>~<doc.company.slug>` |

## Detail

```
GET https://api.sejutacita.id/v1/job-portal/job/<id>
GET https://api.sejutacita.id/v1/job-portal/job/slug/<slug>
```

Use the slug endpoint when only a `/loker/<slug>~<company>` URL is available (the id is
**not** present in the web URL). Response:

```json
{ "code": 200, "data": { "result": { /* full job document */ } } }
```

Relevant `result` fields:

| Field | Notes |
|-------|-------|
| `id`, `slug`, `role` | Identity + title |
| `company.name`, `company.slug` | Employer (slug feeds the URL) |
| `location.city.name`, `location.country.name` | Location |
| `publishedAt` | Posting date (ISO 8601) |
| `employmentTypes` | Array, e.g. `["contract"]` |
| `workplaceType` | `onSite` \| `remote` \| `hybrid` |
| `salaryType`, `salaryRange` | `salaryRange` is `{ "start": <int>, "end": <int> }` in IDR, or `null` |
| `description`, `responsibilities`, `requirements`, `perks` | Rich-text HTML strings (any may be `null`); the CLI flattens them to text |
| `status`, `closed` | `isActive = status === "active" && !closed` |
| `externalPlatformApplyUrl` | External apply link, or `null` (fall back to the Dealls URL) |

## Cities

```
GET https://api.sejutacita.id/v1/job-portal/job/city?search=<name>&limit=100
```

The city endpoint is a **server-side search**: without `search` it returns only a
small default subset (10 cities), so the CLI always passes the name through. `limit`
must be ≤ 100. Response `data.result.docs[]`, each `{ "id": <int>, "name": "<City>" }`.
The CLI resolves a `--location` name against this list (exact match first, then
substring) and sends the resulting id as `cityIds[]`. Example ids: `158` = Jakarta
Selatan, `157` = Jakarta Pusat, `179` = Bandung, `49180` = Jakarta.

## Web job URL

```
https://dealls.com/loker/<slug>~<companySlug>
```

`slug` is the posting's primary slug (e.g. `backend-engineer-7`); `companySlug` is
`company.slug` (e.g. `jakmallcom`). Verified live (HTTP 200).

## Notes

- No authentication required; `robots.txt` allows all paths.
- Page size 18 (web default); `limit` must be ≤ 55.
- The API returns HTTP 400 (`messageId: BAD_REQUEST`) with a `data.invalid` map on bad
  params — useful for debugging when the portal changes its schema.
- If the portal changes, re-check the search endpoint by reading the `__NEXT_DATA__`
  react-query key on `https://dealls.com/loker`.
