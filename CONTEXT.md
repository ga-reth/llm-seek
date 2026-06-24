# JobSeek

A system that discovers company job boards at scale, fetches their postings, and surfaces new matches daily.

## Language

### Discovery & Slugs

**Slug**:
A company identifier derived from the Ashby job board URL path (e.g. `ramp`, `replit`). Not guaranteed to be a live board — Slugs are candidates, validated at fetch time.
_Avoid_: Company ID, board name, tenant

**Slug Source**:
A provider of Slugs. Currently: Harvested Slugs from Common Crawl CDX, with built-in defaults as a fallback. Sources are deduplicated before a Run.
_Avoid_: Slug provider, discovery source

**Harvested Slug**:
A Slug discovered by querying the Common Crawl CDX index. Updated monthly. If none are available, the system falls back to a built-in default list.
_Avoid_: Crawled slug, discovered slug

**Discovery**:
The monthly process of querying Common Crawl for Harvested Slugs and writing `data/slugs.json`. Runs independently of the daily Run.
_Avoid_: Crawl, harvest, indexing

### Jobs & Filtering

**Source**:
An ATS integration responsible for fetching Jobs for a given set of Slugs. Ashby is the first Source.
_Avoid_: Provider, connector, integration

**Job**:
A normalized job posting fetched from a Source. Carries a stable `id`, canonical fields, and the full original payload in `raw`.
_Avoid_: Posting, listing, role, position

**Filter**:
A single rule that a Job must pass to appear in output. Filters compose in an ordered pipeline; a Job must pass all Filters.
_Avoid_: Rule, criterion, predicate

**Match**:
A Job that passes all Filters in the pipeline.
_Avoid_: Result, hit, candidate

**Seen**:
A Match whose `id` has been recorded in `data/seen.json` from a prior successful Run.
_Avoid_: Known, existing, duplicate

**New Match**:
A Match that is not Seen. The primary signal of a Run — written to `out/new.json`.
_Avoid_: Fresh match, unseen match, new job

### Cadence

**Run**:
The daily execution of the job pipeline: load Slugs → fetch Jobs from each Source → apply Filter pipeline → write output → update seen store. Only updates `data/seen.json` on successful completion.
_Avoid_: Job, execution, pipeline run

**Seen Store**:
The persistent record of Seen job IDs, kept in `data/seen.json`. Pruned of IDs older than 45 days on each Run.
_Avoid_: Dedup store, ID cache, history
