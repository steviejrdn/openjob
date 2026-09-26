# Search Queries for Job Scraper

<!-- Populated by /setup for Stevie Jordan. Re-run /setup --section search to update. -->

## Installed portal CLIs (primary for `/scrape`)

`/scrape` discovers every portal skill under `.agents/skills/*/SKILL.md` and runs its CLI first. Shipped country-agnostic CLIs include `linkedin-search` and `freehire-search`; Danish demos and any skill you add with `/add-portal` are included the same way. You do **not** need a matching `site:` line below for those CLIs to run.

**Enabled for this profile:** `linkedin-search`, `freehire-search`. The four Danish demo portals (`jobindex-search`, `jobbank-search`, `jobdanmark-search`, `jobnet-search`) stay disabled because the target market is Indonesia. Indonesian boards without a CLI (JobStreet, Glints, Kalibrr) are covered by the `site:` fallback below; scaffold a CLI with `/add-portal` if you want them automated.

The `site:` query templates in this file are the **websearch fallback** — for portals without a CLI, company career pages, or when a CLI fails.

**Language scope:** write every query category in every language listed in your AGENTS.md Languages table (Indonesian and English here). A posting requiring a language you have *not* declared, as a job condition, is excluded before scoring; a posting requiring a *higher level* than you declared in a language you *do* work in is flagged for your own judgment, not excluded — see `04-job-evaluation.md`'s Language Gate, the single source of truth for this rule.

## Search Sites

Primary (Indonesian market, websearch fallback):
- **JobStreet Indonesia** (jobstreet.co.id) - largest general job board
- **Glints** (glints.com) - startup and tech-heavy board
- **Kalibrr** (kalibrr.com) - general board
- **linkedin.com/jobs** - also covered by the `linkedin-search` CLI
- **freehire** - covered by the `freehire-search` CLI

Secondary (company career pages via Google):
- Direct Google searches with `site:` filters for the target companies listed below

## Target Companies

- **FMCG:** Unilever, Danone, and similar consumer goods companies
- **Research agencies:** Nielsen and its network (NIQ, Bases) and Kantar only
- **Other research/healthcare agencies:** IQVIA, MASH, and similar
- **Tech:** Google, Qoala, and similar

## Query Categories

Queries are grouped by priority. Each category is written in both Indonesian and English (see Language scope above). Combine each query with your location term (Jakarta) where the site supports it.

**Organize by function, not job title.** The same underlying work carries different titles across companies and markets, so each category lists several plausible titles rather than betting on one exact string.

### Priority 1: Consumer Insights and Market Research

These match the strongest and most desired career direction: Consumer Insight Manager / Senior Research Manager.

```
site:jobstreet.co.id "Consumer Insights Manager" Jakarta
site:jobstreet.co.id "Market Research Manager" Jakarta
site:jobstreet.co.id "Insights Manager" Jakarta
site:jobstreet.co.id "Senior Research Manager" Jakarta
site:jobstreet.co.id "Research Consultant" Jakarta
site:glints.com "Consumer Insights" Jakarta
site:kalibrr.com "Market Research" Jakarta
site:linkedin.com/jobs "Consumer Insights Manager" Indonesia
site:linkedin.com/jobs "Market Research Manager" Jakarta
site:jobstreet.co.id "Manajer Riset Pasar" Jakarta
site:jobstreet.co.id "Manajer Insight Konsumen" Jakarta
site:jobstreet.co.id "riset pasar" Jakarta
```

### Priority 2: Innovation and Product Research (FMCG)

These match the domain expertise: innovation and product research for consumer goods.

```
site:jobstreet.co.id "innovation research" Jakarta
site:jobstreet.co.id "product research" Jakarta
site:jobstreet.co.id "concept testing" Jakarta
site:linkedin.com/jobs "innovation research" Indonesia
site:jobstreet.co.id "riset inovasi" Jakarta
site:jobstreet.co.id "riset produk" Jakarta
```

### Priority 3: Insights and Analytics (adjacent pivot)

Adjacent roles leaning on analytics and AI tooling.

```
site:jobstreet.co.id "insights and analytics" Jakarta
site:jobstreet.co.id "survey analytics" Jakarta
site:glints.com "data insights" Jakarta
site:linkedin.com/jobs "insights analytics" Jakarta
site:jobstreet.co.id "generative AI" Jakarta
```

### Priority 4: Broader Research and Consulting

Wider net for research roles in and around Jakarta.

```
site:jobstreet.co.id "consumer research" Jakarta
site:jobstreet.co.id "research executive" Jakarta
site:linkedin.com/jobs "market research" Indonesia
site:kalibrr.com "research" Jakarta
site:jobstreet.co.id "riset konsumen" Jakarta
```

## Location Filter

Verify the job location is within commuting distance inside Jakarta. Definitions:
- **Jakarta** - ideal
- **Remote** - acceptable
- **Jabodetabek** (Tangerang, South Tangerang, Bekasi, Depok, Bogor) - not willing to commute; only consider if the role is fully remote
- **Outside Jabodetabek** - too far; only consider if the role is fully remote

## Language Filter

Working languages and levels are in AGENTS.md's Languages table. When filtering scraped results, apply `04-job-evaluation.md`'s Language Gate: a posting requiring a language not declared at all is excluded; a posting requiring a higher level than declared in a language that is declared is not excluded, flag it clearly instead (see `job-scraper/SKILL.md`'s Step 3 "Quick Fit Assessment" for how the flag surfaces in `/scrape` output). Postings simply *written* in a language you don't work in, that don't require it on the job, are fine.

## Date Filter

Only include jobs posted within the last 14 days, or with an application deadline that has not yet passed. If a posting date cannot be determined, include it but flag as "date unknown".

## Adapting Queries

If the user specifies a focus area, select queries from the matching category and also generate 2-3 custom queries for that focus. For example:
- "/scrape [focus_area]" -> relevant category queries + custom focus-specific queries
