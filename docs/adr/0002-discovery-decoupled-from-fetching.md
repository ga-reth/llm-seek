# Discovery runs on a separate cadence from fetching

Slug Discovery (monthly) and job fetching (daily) are separate entrypoints with separate outputs. Discovery writes `data/slugs.json`; the daily Run reads it. They never execute in the same process.

This separation exists because the two problems have fundamentally different characteristics: Discovery is slow, expensive (CDX pagination across thousands of pages), and changes rarely — the set of companies using Ashby turns over slowly. Fetching is fast per-board and needs to run daily to catch new postings and respect the age filter. Coupling them would mean either running the CDX harvest daily (wasteful and potentially rate-limited) or running the fetch only monthly (useless for job searching).

## Consequences

The slug list is always slightly stale relative to real-time Ashby registrations, but this is acceptable given the monthly cadence and Manual Slug escape hatch. A new ATS source (Greenhouse, Lever) follows the same pattern: one Slug Source for discovery, one Job Source for fetching, same pipeline.
