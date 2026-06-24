# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
bun run          # main run: fetch jobs, apply filters, write out/
bun discover     # one-off: discover Ashby slugs via Common Crawl → data/slugs.json
bun test         # run all tests
bun test tests/rules.test.ts   # run a single test file
biome lint       # lint (read-only)
biome lint --write   # lint + autofix
biome format --write # format
```

Runtime flags for the main run:
- `--dryRun [N]` — skip file writes, process only the first N slugs (default 10)
- `--verbose` — print dropped jobs with reasons after the summary

## Architecture

The system has two independent entry points:

**`src/discover-slugs.ts`** — one-off, monthly. Queries the Common Crawl CDX index (`src/slugs/common-crawl.ts`) for URLs matching `jobs.ashbyhq.com/*`, extracts slugs, writes `data/slugs.json`.

**`src/index.ts`** — daily Run. Pipeline:
1. Load slugs: reads `data/slugs.json` (harvested); falls back to built-in defaults if absent or empty (`src/slugs/slug-source.ts`)
2. Fetch jobs: `AshbySource` (`src/sources/ashby.ts`) calls `https://api.ashbyhq.com/posting-api/job-board/{slug}`, validates with Zod, returns `Job[]`
3. Filter pipeline: runs each `JobFilter` in order; first failure short-circuits. Filters live in `src/filter.ts`
4. Dedup via `SeenStore` (`src/seen-store.ts`): loads `data/seen.json`, filters to New Matches, saves new IDs on completion
5. Write `out/matches.json` (all Matches) and `out/new_matches.json` (New Matches only)

## Key design decisions

**Config is the single control surface** — all filter behaviour (keywords, age, location, employment type) lives in `src/config.ts`. No flags; edit the file.

**SeenStore fingerprinting** — `seen.json` stores a `configFingerprint` (JSON-serialised `config.filters`). If the fingerprint changes between runs, the seen store is cleared so the new filter config gets a fresh pass over all jobs.

**Filter short-circuit** — `exec` in `src/filter.ts` returns on the first failing filter. Filters are ordered: title-include → title-exclude → max-age → location → employment-type.

**LocationFilter OR logic** — `remoteOnly` and `allowedLocations` are ORed, not ANDed: a job passes if it is remote *or* its location substring-matches any entry in `allowedLocations`.

**Null-as-pass** — `EmploymentTypeFilter` passes jobs with `null` employmentType to avoid silently dropping jobs whose type the API didn't return. Same logic applies to `MaxAgeFilter` via `includeIfDateMissing`.

**`matchMode`** — title keyword matching defaults to `'word'` (word boundary regex). Set to `'substring'` for broader matching.

## Domain vocabulary

See `CONTEXT.md` for canonical term definitions (Slug, Source, Job, Filter, Match, New Match, Seen, Run, etc.). Use these terms in code and messages — avoid synonyms listed there.
