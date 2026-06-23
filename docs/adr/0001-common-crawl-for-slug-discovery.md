# Common Crawl CDX for Ashby slug discovery

Ashby has no global company directory and no cross-company search API. The obvious alternative — scraping Google results for `site:jobs.ashbyhq.com` — requires bypassing CAPTCHAs, violates ToS, and breaks constantly. Instead we query the Common Crawl CDX index for `jobs.ashbyhq.com/*`, which is a free, public, purpose-built web-crawl dataset with no anti-bot measures and no ToS conflict. A single monthly CDX query returns ~1,200–2,500 unique slugs with one HTTP call per page.

## Considered Options

- **Google/Bing scraping** — rejected: ToS violation, IP blocks, CAPTCHA, constant maintenance
- **Common Crawl columnar index (Athena/Spark)** — rejected: overkill for a single-host query; the CDX API is sufficient
- **Manual list only** — rejected: doesn't scale; misses companies we haven't heard of

## Consequences

Coverage reflects what Common Crawl has crawled, not real-time Ashby registrations. Brand-new companies may lag up to one crawl cycle (~1 month). Mitigated by: unioning several recent monthly indices and allowing Manual Slugs for companies spotted via other means.
