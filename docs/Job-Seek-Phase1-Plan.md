# JobSeek — Phase 1 Build Plan

> An autonomous job-search agent. **Phase 1 scope:** achieve wide coverage of the Ashby ATS by *discovering* company boards from Common Crawl, *fetching* each board's jobs from Ashby's public API, applying a *rule-based filter*, and surfacing only *new matches* daily via a lightweight dedup store.

**Stack:** Bun + TypeScript · **Source:** Ashby public job-board API · **Coverage:** Common Crawl slug discovery · **Output (phase 1):** new matches to console + `out/new.json`, all matches to `out/matches.json`

---

## 1. Scope

### In scope (build now)
- **Discover** Ashby company board slugs at scale by querying the **Common Crawl** URL index for `jobs.ashbyhq.com/*`, extracting slugs, and deduplicating into a reusable list.
- **Fetch** published job postings from every discovered Ashby board via the public posting API.
- **Normalise** them into a single internal `Job` shape.
- Apply a **rule-based filter** with:
  - **Title include** — title must contain at least one of N keywords (e.g. `developer`, `engineer`).
  - **Title exclude** — title must contain none of M keywords (e.g. `lead`, `manager`).
  - **Age** — posting must be no older than `maxAgeDays` (e.g. 30).
  - **Location** — job must be remote or match an allowed location string.
  - **Employment type** — job must match one of the allowed employment types (e.g. `FullTime`).
- **Dedup** matches against a lightweight seen-IDs store (`data/seen.json`) so each daily run surfaces only new postings.
- Print new matches and dump them to `out/new.json`; dump all current matches to `out/matches.json`.

### Explicitly deferred (later phases)
- LLM relevance scoring
- Persistent "seen jobs" store backed by SQLite (current phase uses a JSON file)
- Report generation (HTML/Markdown digest)
- Delivery / notifier interface (email → Telegram/WhatsApp)
- Production scheduling on the Raspberry Pi (systemd timers — the *cadence design* is settled below, but wiring the timers is a later step)
- Additional sources (Greenhouse, Lever, Reed, Adzuna, Arbeitnow)

The architecture below keeps each deferred piece additive: sources sit behind an interface, filters compose in a pipeline a scorer can later join, and **discovery is fully decoupled from fetching** so the two can run on different cadences.

---

## 2. The core idea: discovery ≠ fetching

Ashby (like Greenhouse and Lever) exposes a clean public API, but **only per company** — there is no cross-company search and no global directory of who uses Ashby. So "wide coverage" is really two separate problems:

| Problem | Difficulty | Solution |
|---|---|---|
| **Fetch** one company's jobs | Trivial | Official posting API: `GET /posting-api/job-board/{slug}` |
| **Discover** which company slugs exist | The hard part | Harvest slugs once from **Common Crawl**, refresh periodically |

Separating them is the unlock. The Google `site:jobs.ashbyhq.com (...)` boolean trick solves discovery *for a human*, but automating it means scraping Google's results — CAPTCHAs, IP blocks, ToS violations, constant breakage — the exact brittleness class we rejected for LinkedIn/Indeed. Common Crawl is a free, public, purpose-built web-crawl dataset, so harvesting from it has no ToS or anti-bot problem.

**Validated:** a single CDX index returns ~1,279 unique Ashby slugs; unioning 3–6 monthly indices yields ~1,500–2,500 companies.

---

## 3. Architecture & cadence

Two jobs, two cadences. Discovery is slow-changing (run **monthly**); fetching is the daily work.

```
MONTHLY  (discover)
  Common Crawl CDX index ──▶ extract + dedupe slugs ──▶ data/slugs.json
   (url=jobs.ashbyhq.com/*)        (regex)             (+ data/slugs.manual.json)

DAILY  (run)
  slugs.json ──▶ AshbySource.fetch(slug)·N ──▶ normalise ──▶ FilterPipeline ──▶ dedup ──▶ output
                 (official posting API)          (Job[])       (5 rules)        (seen.json) (console + files)
```

Three interfaces keep future phases cheap:

- **`JobSource`** — `fetch(slugs): Promise<Job[]>`. Ashby is the first implementation; Greenhouse/Lever become drop-in additions that reuse the same discovery pattern.
- **`JobFilter`** — `passes(job, config): FilterResult`. The five rule filters implement it; the future LLM scorer and a SQLite-backed dedup check become additional stages in the same pipeline.
- **`SlugSource`** — `discover(): Promise<string[]>`. Common Crawl is its first implementation; the manual list and other ATS harvesters slot in behind it.

---

## 4. Tech stack & dependencies

| Concern | Choice | Notes |
|---|---|---|
| Runtime / package manager / test runner | **Bun** | One tool for `install`, `run`, and `test` (`bun:test`). |
| Language | **TypeScript**, `strict: true` | Compile-time safety on the normalised shape. |
| HTTP (Ashby + Common Crawl CDX) | **Native `fetch`** | Both are plain HTTP/JSON; no client library needed. |
| Response validation | **zod** | Ashby is unversioned and can change without notice — validate defensively at the boundary. |
| Dates | **Native `Date`** | Age math is trivial. |
| Config | **Typed `config.ts`** | Lowest-friction in TS, type-checked. Can migrate to `config.yaml` later. |

Dependency list stays at essentially **zod only**.

---

## 5. Project structure

```
JobSeek/
├── package.json
├── tsconfig.json
├── .gitignore               # excludes out/, data/slugs.json
├── CONTEXT.md               # domain glossary
├── src/
│   ├── run.ts               # DAILY entrypoint: slugs → fetch → filter → dedup → output
│   ├── discover.ts          # MONTHLY entrypoint: Common Crawl → slugs.json
│   ├── config.ts            # typed search + discovery config (you edit this)
│   ├── types.ts             # Job + FilterResult types
│   ├── discovery/
│   │   ├── slugSource.ts    # SlugSource interface + slug-list loader/merger
│   │   └── commoncrawl.ts   # CDX query + slug extraction + dedupe
│   ├── sources/
│   │   ├── source.ts        # JobSource interface
│   │   └── ashby.ts         # Ashby client: fetch + normalise + zod schema
│   ├── filters/
│   │   ├── filter.ts        # JobFilter interface + runPipeline()
│   │   └── rules.ts         # titleInclude, titleExclude, maxAge, location, employmentType filters
│   └── lib/
│       └── text.ts          # keyword matching (word-boundary / substring)
├── data/
│   ├── slugs.json           # generated by discover.ts (gitignored)
│   ├── slugs.manual.json    # hand-added slugs — committed, starts as []
│   └── seen.json            # generated: matched job IDs from prior runs (gitignored until first run)
├── out/                     # gitignored — ephemeral run artifacts
│   ├── matches.json         # all current matches (full Job objects)
│   └── new.json             # only new matches (not in seen.json)
└── tests/
    ├── commoncrawl.test.ts  # slug regex + dedupe against a fixture CDX line
    ├── rules.test.ts        # table-driven filter tests (all 5 rules)
    ├── ashby.test.ts        # parse/normalise a saved fixture
    └── dedup.test.ts        # seen store read/write/prune + write-on-completion invariant
```

---

## 6. Internal data model (`types.ts`)

```ts
export interface Job {
  id: string;
  source: string;            // "ashby"
  company: string;           // board slug, e.g. "ramp"
  title: string;
  location: string | null;
  isRemote: boolean;
  employmentType: string | null;
  publishedAt: Date | null;
  url: string;               // applyUrl ?? jobUrl
  raw: unknown;              // full original payload — retained for later phases (scoring, reporting)
}

export interface FilterResult {
  passed: boolean;
  reason?: string;           // why it was dropped, for refinement/logging
}
```

`raw` is retained intentionally — later phases (scoring, reporting) will want description text and compensation without a re-fetch.

---

## 7. Discovery module (`discovery/commoncrawl.ts`)

Harvests Ashby board slugs from the Common Crawl URL (CDX) index. Runs monthly; output is `data/slugs.json`.

### How it works
1. **Pick crawl indices.** Common Crawl publishes ~one index per month; union the **last N monthly crawls** (e.g. 3–6) for better coverage. The list of available crawls is at `https://index.commoncrawl.org/collinfo.json`.
2. **Query each index** for every captured URL on the Ashby host:
   ```
   https://index.commoncrawl.org/{CRAWL}-index?url=jobs.ashbyhq.com%2F*&output=json&fl=url
   ```
   - Use the paged interface: request `&showNumPages=true` first to get the page count, then loop `&page=0..N-1`.
   - The response is JSON-lines (one object per line); with `fl=url` each line carries just the captured URL.
3. **Extract the slug** — the first path segment after the host:
   ```ts
   const m = url.match(/jobs\.ashbyhq\.com\/([^\/?#]+)/i);
   // m?.[1] → "superpower", "socure", "replit", ...
   ```
   Lowercase and add to a `Set` to dedupe across pages and crawls.
4. **Write** `data/slugs.json`:
   ```json
   { "source": "ashby", "generatedAt": "2026-…", "count": 2417, "slugs": ["superpower", "socure", "…"] }
   ```

### Politeness (required)
The CDX endpoint is heavily rate-limited. Stay single-threaded, **sleep ~1s between page requests**, send a proper `User-Agent`, and back off on HTTP 503. A monthly run is low-frequency by design.

### Honest caveats
- **Coverage = what's been crawled**, not real-time. Brand-new Ashby companies may lag a crawl cycle. Mitigations: union several recent crawls; allow manual additions (below).
- **Candidate slugs, validated at fetch time.** A first-path-segment isn't *guaranteed* to be a live board. The fetch step treats unknown slugs as candidates and drops any that 404 or return empty.
- **Scale is comfortable.** ~1,500–2,500 companies at a polite rate is well within a Pi's overnight window.

### Manual additions
`data/slugs.manual.json` is committed to the repo as `[]` and can be appended to instantly when you spot a company. `slugSource.ts` merges harvested + manual and dedupes; a newly-spotted company is searchable that night without waiting for the monthly harvest.

### First-run state
Both `data/slugs.json` and `data/slugs.manual.json` are optional in the merge. If `slugs.json` doesn't exist (before the first Discovery run), a warning is logged and only manual slugs are used. If neither exists, the run warns and exits early.

---

## 8. Ashby source (`sources/ashby.ts`)

### Endpoint
```
GET https://api.ashbyhq.com/posting-api/job-board/{slug}?includeCompensation=true
```
- **No authentication.** No pagination — every listed posting comes back in one JSON call.
- **No server-side filtering or search** — pull the whole board, filter locally.
- Response shape: `{ apiVersion: string, jobs: Job[] }`.
- For an unknown/dead slug, treat a 404 or empty `jobs` as "drop this slug," log it, and continue.

### Per-job field mapping
| Ashby field | → `Job` | Notes |
|---|---|---|
| `id` | `id` | |
| `title` | `title` | |
| `location` | `location` | May be null. |
| `isRemote` | `isRemote` | |
| `employmentType` | `employmentType` | May be null. |
| `publishedAt` | `publishedAt` | ISO 8601 with TZ offset, e.g. `"2026-06-03T21:25:11.155+00:00"`. Zod: `z.string().datetime({ offset: true })`. |
| `applyUrl` / `jobUrl` | `url` | Prefer `applyUrl`. |
| (whole object) | `raw` | |

### Caveats to handle in code
1. **Filter unlisted/draft roles:** keep only jobs where `isListed !== false`.
2. **Missing date:** if `publishedAt` is absent or invalid, fall back to `config.includeIfDateMissing` (default `true`) and log a warning.
3. **Unversioned schema:** `apiVersion: "1"`, but fields can change — parse with zod and read optional fields with safe access.
4. **Rate limits:** unofficial ~100 req/min. Add a small delay (~500–600 ms) between boards and exponential-backoff on HTTP 429.

---

## 9. Rule-based filter (`filters/rules.ts`)

Each rule is a `JobFilter`. The pipeline runs them in order; a job survives only if **all** pass. The first failure records a `reason` (handy when tuning keywords).

### Matching semantics (shared, `lib/text.ts`)
- **Case-insensitive** throughout.
- **Match mode is configurable**, default **`"word"`**:
  - `"word"` — whole-word match via `\bkeyword\b`.
  - `"substring"` — plain `includes()`.

### The five rules

1. **`titleInclude`** — passes if the title matches **at least one** include keyword (OR). Empty list ⇒ no-op.
2. **`titleExclude`** — passes if the title matches **none** of the exclude keywords. Empty list ⇒ no-op.
3. **`maxAge`** — `ageDays = (now - publishedAt) / 86_400_000`; passes if `ageDays <= maxAgeDays`. If `publishedAt` is null, fall back to `config.includeIfDateMissing` (default `true`).
4. **`location`** — passes if `job.isRemote === true` OR `job.location` matches any entry in `allowedLocations` (substring match). If both `remoteOnly` is false and `allowedLocations` is empty, no-op.
5. **`employmentType`** — passes if `job.employmentType` matches any entry in `allowedEmploymentTypes`. If `employmentType` is null, passes (don't drop jobs with missing data). Empty list ⇒ no-op.

### Config shape (`config.ts`)
```ts
export const config = {
  discovery: {
    ashby: {
      crawls: 4,
      requestDelayMs: 1000,
      userAgent: "JobSeek/0.1 (you@example.com)",
    },
  },
  sources: {
    ashby: {
      slugsFile: "data/slugs.json",
      manualSlugsFile: "data/slugs.manual.json",
      requestDelayMs: 600,
    },
  },
  filters: {
    titleInclude: ["developer", "engineer"],
    titleExclude: ["lead", "manager", "principal", "staff"],
    maxAgeDays: 30,
    matchMode: "word" as "word" | "substring",
    includeIfDateMissing: true,
    remoteOnly: true,
    allowedLocations: ["UK", "London", "Remote", "Europe"],  // OR with remoteOnly
    allowedEmploymentTypes: ["FullTime"],                     // empty = no-op
  },
} as const;
```

---

## 10. Dedup (`data/seen.json`)

The seen store is a flat JSON file: `{ "ids": string[], "updatedAt": string }`.

- **On each Run:** load seen IDs into a `Set`. After filtering, partition matches into *new* (not in set) and *already seen* (in set).
- **Write output first**, then update `seen.json` — if the process dies between the two, jobs are not marked seen without having been reported.
- **Prune** IDs older than 45 days on each Run (requires storing `firstSeenAt` per ID alongside the set, or a simple map of `id → firstSeenAt`).
- **Key:** job `id` from Ashby. Stable for the lifetime of a posting; re-posted roles with new IDs are intentionally re-surfaced.

---

## 11. Entrypoints & phase-1 output

**`discover.ts` (monthly)** — run Common Crawl harvest → write `data/slugs.json`. Log: crawls queried, pages fetched, raw captures seen, unique slugs found.

**`run.ts` (daily)** —
1. Load + merge harvested and manual slugs.
2. For each slug → `AshbySource.fetch()`; collect `Job[]` (dead slugs dropped + logged).
3. Run the filter pipeline; partition into matched / dropped.
4. Load `data/seen.json`; split matches into new / already-seen.
5. **Write output:**
   - `out/new.json` — new matches only (full `Job` objects).
   - `out/matches.json` — all current matches (full `Job` objects).
6. **Update `data/seen.json`** — add new match IDs, prune entries older than 45 days.
7. **Console output:**
   - Summary: `1247 slugs · 3,891 jobs fetched · 42 matched · 8 new`
   - Table of new matches:
     ```
     NEW MATCHES (8)
     ──────────────────────────────────────────────────────────────────
     Title                        Company       Location       Age   Type
     ──────────────────────────────────────────────────────────────────
     Senior Software Engineer     ramp          Remote         2d    FullTime
     Backend Engineer             replit        New York, US   5d    FullTime
     ```
   - `--verbose` additionally logs dropped jobs with their `reason` column — invaluable while tuning keywords.

**Key invariant:** `data/seen.json` is never updated unless the run completes and output files are written. A failed mid-run simply re-runs from scratch.

---

## 12. Testing

- **`commoncrawl.test.ts`** — slug regex against representative captured URLs (board root, job-detail path, query strings, custom-domain edge cases); dedupe collapses duplicates across pages.
- **`rules.test.ts`** — table-driven per rule: include hit/miss, exclude hit/miss, word-vs-substring edges, age boundary (exactly `maxAgeDays`), null-date behaviour, remoteOnly/allowedLocations OR logic, employmentType null-as-pass.
- **`ashby.test.ts`** — a saved real response in `tests/fixtures/ashby.json`; assert the normaliser produces the expected `Job[]`, drops `isListed === false`, and pins the `publishedAt` date field.
- **`dedup.test.ts`** — new job appears in `out/new.json`; previously-seen job absent from `out/new.json` but present in `out/matches.json`; IDs older than 45 days are pruned; `seen.json` is not written if an error is thrown mid-run.

Run with `bun test`.

---

## 13. Build sequence (suggested order)

Build the fetch+filter core first against a tiny hand-picked slug list, *then* bring discovery online — so you're never blocked on the harvester while proving the pipeline.

1. `bun init`; strict `tsconfig`; add `zod`; set up `.gitignore` (`out/`, `data/slugs.json`).
2. `types.ts` + `config.ts`.
3. `sources/ashby.ts`: fetch one real board, write the zod schema + normaliser (`publishedAt` confirmed: ISO 8601 with TZ offset, use `z.string().datetime({ offset: true })`). Save a fixture; write `ashby.test.ts`.
4. `lib/text.ts` matcher + `filters/rules.ts` (all 5 rules) + `filters/filter.ts` pipeline; write `rules.test.ts`.
5. `run.ts`: wire against a 2–3 slug `data/slugs.manual.json`; console output + `out/`; add `--verbose`.
6. **Dedup:** implement `data/seen.json` read/write/prune; split output into `out/new.json` + `out/matches.json`; write `dedup.test.ts`.
7. **Refinement loop:** tune `titleInclude` / `titleExclude` / `remoteOnly` / `allowedLocations` / `allowedEmploymentTypes` until output is clean on the small set.
8. `discovery/commoncrawl.ts` + `discover.ts`: harvest slugs into `data/slugs.json`; write `commoncrawl.test.ts`. Respect CDX politeness.
9. `discovery/slugSource.ts`: merge harvested + manual; point `run.ts` at the full list.
10. Run the daily pipeline against the full slug set; sanity-check volume, runtime, and match quality on the Pi.

---

## 14. What this sets up for later

- Discovery is **decoupled and reusable** — a Greenhouse/Lever harvester is the same CDX pattern with a different host regex, and each new ATS is a new `SlugSource` + `JobSource` pair, no pipeline changes.
- A clean `Job` shape + retained `raw` means **scoring** and **reporting** need no re-fetch.
- The `JobFilter` pipeline means **LLM scoring** is "one more stage," and **SQLite-backed dedup** is a drop-in replacement for the JSON seen store.
- Two clean entrypoints map directly onto **two systemd timers** on the Pi (monthly `discover`, daily `run`) when scheduling lands.
- Console output is trivially swapped for the future **notifier interface** (email → Telegram/WhatsApp).
