import { config } from "../config";

const COLLINFO_URL = "https://index.commoncrawl.org/collinfo.json";
const SLUG_RE = /jobs\.ashbyhq\.com\/([^/?#]+)/i;

interface CollInfo {
  id: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchJson<T>(url: string, headers?: Record<string, string>): Promise<T> {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return res.json() as Promise<T>;
}

async function queryCrawl(crawlId: string, slugs: Set<string>): Promise<{ pages: number; captures: number }> {
  const { requestDelayMs, userAgent } = config.discovery.ashby;
  const headers = { "User-Agent": userAgent };
  const base = `https://index.commoncrawl.org/${crawlId}-index?url=jobs.ashbyhq.com%2F*&output=json&fl=url`;

  const countUrl = `${base}&showNumPages=true`;
  let numPages = 1;
  try {
    const info = await fetchJson<{ pages: number }>(countUrl, headers);
    numPages = info.pages ?? 1;
  } catch (err) {
    console.warn(`[cc] failed to get page count for ${crawlId}: ${err}`);
    return { pages: 0, captures: 0 };
  }

  let captures = 0;
  for (let page = 0; page < numPages; page++) {
    await sleep(requestDelayMs);
    const pageUrl = `${base}&page=${page}`;
    let text: string;
    try {
      const res = await fetch(pageUrl, { headers });
      if (res.status === 503) {
        console.warn(`[cc] 503 on page ${page} of ${crawlId}, skipping`);
        continue;
      }
      if (!res.ok) {
        console.warn(`[cc] HTTP ${res.status} on page ${page} of ${crawlId}`);
        continue;
      }
      text = await res.text();
    } catch (err) {
      console.warn(`[cc] fetch error page ${page} of ${crawlId}: ${err}`);
      continue;
    }

    for (const line of text.split("\n")) {
      if (!line.trim()) continue;
      try {
        const obj = JSON.parse(line) as { url?: string };
        if (obj.url) {
          const m = obj.url.match(SLUG_RE);
          if (m?.[1]) {
            slugs.add(m[1].toLowerCase());
            captures++;
          }
        }
      } catch {
        // malformed line — skip
      }
    }
  }

  return { pages: numPages, captures };
}

export async function discoverSlugs(): Promise<string[]> {
  const { crawls, userAgent } = config.discovery.ashby;

  let collinfo: CollInfo[];
  try {
    collinfo = await fetchJson<CollInfo[]>(COLLINFO_URL, { "User-Agent": userAgent });
  } catch (err) {
    throw new Error(`[cc] failed to fetch collinfo: ${err}`);
  }

  const candidates = collinfo.map((c) => c.id);
  console.log(`[cc] ${candidates.length} crawls available, targeting ${crawls} successful ones`);

  const slugs = new Set<string>();
  let totalPages = 0;
  let totalCaptures = 0;
  let successes = 0;

  for (const crawlId of candidates) {
    if (successes >= crawls) break;
    console.log(`[cc] starting crawl ${crawlId}…`);
    const { pages, captures } = await queryCrawl(crawlId, slugs);
    if (pages > 0) {
      successes++;
      totalPages += pages;
      totalCaptures += captures;
      console.log(`[cc] ${crawlId}: ${pages} pages, ${captures} captures, ${slugs.size} unique slugs (${successes}/${crawls} done)`);
    } else {
      console.warn(`[cc] ${crawlId}: unavailable, trying next`);
    }
  }

  if (successes === 0) {
    throw new Error("[cc] no CDX indices responded — the service may be temporarily unavailable");
  }

  console.log(`[cc] done — ${successes} crawls, ${totalPages} pages, ${totalCaptures} captures, ${slugs.size} unique slugs`);
  return Array.from(slugs).sort();
}
