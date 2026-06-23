# Retain the full raw Ashby payload on every Job

Every normalized `Job` carries `raw: unknown` — the complete original Ashby API response for that posting. This is intentional and load-bearing for later phases.

Later phases (LLM scoring, richer reporting, compensation filtering) will need fields not in the normalized shape — job description text, compensation tiers, secondary locations, department. Without `raw`, those phases would require a re-fetch of every matched job, multiplying API calls and coupling later phases to Ashby's rate limits and availability. Retaining `raw` makes all future reads free.

The storage cost is negligible: `out/matches.json` contains only filtered matches (not all fetched jobs), and individual Ashby payloads are a few kilobytes each.
