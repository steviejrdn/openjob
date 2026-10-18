# Glints Indonesia URL Reference

Endpoints and parsing anchors for `glints.com/id` (Indonesia market). No
authentication. The site is a Next.js app: search is served by a GraphQL gateway
and job pages ship their record in a `__NEXT_DATA__` JSON blob.

> Personal use only — keep volume low; automated access may conflict with Glints'
> Terms of Service.

## Access rules (robots.txt)

`https://glints.com/robots.txt` disallows, among other paths:

```
disallow: */opportunities/jobs/explore?*
disallow: */opportunities/jobs/recommended$
disallow: */opportunities/jobs/bookmarked$
disallow: /api/glintsTracking/*
disallow: /api/gt/*
```

The HTML search page (`/id/opportunities/jobs/explore?*`) is **disallowed**, so this
skill does **not** scrape it. The GraphQL gateway `/api/v2/graphql` and individual
job pages (`/id/opportunities/jobs/<uuid>`) are **not** disallowed, and are what the
CLI uses.

## Search (GraphQL)

```
POST https://glints.com/api/v2/graphql
Content-Type: application/json
Body: { "operationName": "searchJobs", "query": "<document>", "variables": { "data": { … } } }
```

The gateway requires the `variables` key to be present (a body without it is
rejected). No auth cookie/token is required for the first page.

### Operation

```graphql
query searchJobs($data: JobSearchConditionInput!) {
  searchJobs(data: $data) {
    jobsInPage {
      id
      title
      createdAt
      type
      workArrangementOption
      status
      company { id name brandName }
      city { id name }
      location {
        id name formattedName level slug
        parents { name formattedName level slug }
      }
    }
    totalJobs
  }
}
```

`searchJobs` (not `searchJobsV3`) is used because it honours `SearchTerm`; the V3
variant returned a fixed fallback set regardless of the keyword.

### `JobSearchConditionInput` variables

| Variable | Type | Meaning | Notes |
|----------|------|---------|-------|
| `SearchTerm` | [String] | Free-text keyword | The field that actually filters. |
| `CountryCode` | [String] | Country | `["ID"]` scopes the board to Indonesia. |
| `limit` | Int | Page size | Caps at **50** anonymously. |
| `offset` | Int | Pagination offset | Works to ~30; deeper offsets return `NO_PERMISSION`. |
| `includeExternalJobs` | Boolean | Include external postings | Send `true`. |
| `lastUpdatedAtRange` | Enum | Recency bucket | `ANY_TIME` \| `PAST_24_HOURS` \| `PAST_WEEK` \| `PAST_MONTH`. Accepted but **does not reliably filter** in testing. |
| `workArrangementOptions` | [Enum] | Work arrangement | `ONSITE` \| `HYBRID` \| `REMOTE`. |
| `LocationIds` | [String] | HierarchicalLocation UUIDs | This is the field that filters by location. |
| `sortBy` | String | Sort order | `LATEST` is accepted. |

Ignored / no-op in testing: `page`, `pageSize` (use `limit`/`offset`), `seoSearch`,
`searchVariant`, and the level-based `HierarchicalLocationId*` filters.

### Response field → CLI mapping

| GraphQL path | CLI field |
|--------------|-----------|
| `searchJobs.jobsInPage[].id` | `id` (UUID string) |
| `.title` | `title` |
| `.company.brandName` / `.company.name` | `company` |
| `.location` (`formattedName` + level-3 parent) | `location` |
| `.createdAt` | `date` |
| `.type` | `employmentType` (detail) |
| `.workArrangementOption` | `workplaceType` (detail) |
| — | `url` = `https://glints.com/id/opportunities/jobs/<id>` |

`totalJobs` mirrors the requested `limit` (it is **not** a true total), so the CLI
reports `meta.count` as the number of results returned.

### Search quirks

- Anonymous `limit` is capped at **50** regardless of the value requested.
- Anonymous `offset` is fenced: `offset ≈ 30` and deeper returns HTTP 200 with
  `{"errors":[{"message":"please login for more information","extensions":{"code":"NO_PERMISSION"}}]}`.
  The CLI treats this as end-of-results while paging and returns what it has.

## Location resolution

Glints has **no general city-search endpoint**. Two GraphQL sources provide the
location pool the CLI matches against:

```graphql
query searchHierarchicalLocations($searchType: String!, $countryCode: String!) {
  searchHierarchicalLocations(searchType: $searchType, countryCode: $countryCode) {
    list { id name formattedName level slug }
  }
}
# searchType is the literal "SUGGESTION" (not a query string); returns ~5 popular places.
```

```graphql
query getJobSearchFiltersV2($data: JobSearchFiltersFilterInputV2!) {
  getJobSearchFiltersV2(data: $data) {
    hierarchicalLocations { id name formattedName level slug }
  }
}
# data = { "searchCountryCode": "ID" }; returns ~20 city/district suggestions.
```

The CLI merges both lists and matches the user's `--location` against
`formattedName`/`slug` (case-insensitive, exact then substring). A match becomes
`LocationIds: [<uuid>]`. With no match, the place is appended to `SearchTerm`
(Glints handles "staff Bandung" well). Verified matches include `Jakarta`,
`Jakarta Selatan`, `Surabaya`, `Tangerang`.

## Detail

```
GET https://glints.com/id/opportunities/jobs/<uuid>
```

The id-only URL **301-redirects** to the canonical
`/id/opportunities/jobs/<slug>/<uuid>`. Either form works (the CLI follows redirects
and passes the bare UUID).

Parsing anchor:

```
<script id="__NEXT_DATA__" type="application/json">{ … }</script>
```

Path into the payload: `props.pageProps.initialData.data` (the job record).

| Field | Meaning |
|-------|---------|
| `id` | Job UUID |
| `title` | Title |
| `company.displayName` / `company.brandName` / `company.name` | Company |
| `location` | HierarchicalLocation (formattedName + parents) |
| `createdAt` | Posted date |
| `expiryDate` | Deadline (`YYYY-MM-DD`, nullable) |
| `type` | Employment type enum (`FULL_TIME`, `CONTRACT`, …) |
| `workArrangementOption` | `ONSITE` \| `HYBRID` \| `REMOTE` |
| `descriptionJsonString` | Draft.js document **as a JSON string** (`{blocks:[{text,type,depth}],entityMap}`) |
| `skills[].skill.name` | Skill names |
| `externalApplyURL` | External apply link (nullable) |
| `status` | `OPEN`, etc. |

The CLI flattens `descriptionJsonString` into readable text, decoding entities and
turning `unordered-list-item` / `ordered-list-item` blocks into `- ` bullets, and
appends a `Skills:` line. `isActive` is `status === "OPEN"` and (if `expiryDate` is
set and in the past) false.

## Notes

- No authentication for search page 1 or job pages.
- `id` values are UUIDs; `detail` extracts the UUID from either a bare id or a URL.
- Keep volume low — this is a personal-use CLI; it backs off on 429/5xx.
