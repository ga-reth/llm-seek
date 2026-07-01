import { sleep } from 'bun';
import { createLogger } from '../lib/logger';

const log = createLogger('cc');

const COLLINFO_URL = 'https://index.commoncrawl.org/collinfo.json';

interface CollInfo {
	id: string;
}

async function fetchJson<T>(
	url: string,
	headers?: Record<string, string>,
): Promise<T> {
	const res = await fetch(url, { headers });
	if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
	return res.json() as Promise<T>;
}

async function queryCrawl(
	crawlId: string,
	cdxPattern: string,
	slugRe: RegExp,
	slugs: Set<string>,
	requestDelayMs: number,
	userAgent: string,
): Promise<{ pages: number; captures: number }> {
	const headers = { 'User-Agent': userAgent };
	const base = `https://index.commoncrawl.org/${crawlId}-index?url=${encodeURIComponent(cdxPattern)}&output=json&fl=url`;

	const countUrl = `${base}&showNumPages=true`;
	let numPages = 1;
	try {
		const info = await fetchJson<{ pages: number }>(countUrl, headers);
		numPages = info.pages ?? 1;
	} catch (err) {
		log.warn('failed to get page count', { crawlId, err: String(err) });
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
				log.warn('503 on page, skipping', { crawlId, page });
				continue;
			}
			if (!res.ok) {
				log.warn('HTTP error on page', { crawlId, page, status: res.status });
				continue;
			}
			text = await res.text();
		} catch (err) {
			log.warn('fetch error on page', { crawlId, page, err: String(err) });
			continue;
		}

		for (const line of text.split('\n')) {
			if (!line.trim()) continue;
			try {
				const obj = JSON.parse(line) as { url?: string };
				if (obj.url) {
					const m = obj.url.match(slugRe);
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

export interface CDXOptions {
	crawls: number;
	requestDelayMs: number;
	userAgent: string;
}

export async function discoverSlugsViaCDX(
	cdxPattern: string,
	slugRe: RegExp,
	options: CDXOptions,
): Promise<string[]> {
	const { crawls, requestDelayMs, userAgent } = options;

	let collinfo: CollInfo[];
	try {
		collinfo = await fetchJson<CollInfo[]>(COLLINFO_URL, { 'User-Agent': userAgent });
	} catch (err) {
		throw new Error(`[cc] failed to fetch collinfo: ${err}`);
	}

	const candidates = collinfo.map((c) => c.id);
	log.info('crawls available', { available: candidates.length, target: crawls });

	const slugs = new Set<string>();
	let totalPages = 0;
	let totalCaptures = 0;
	let successes = 0;

	for (const crawlId of candidates) {
		if (successes >= crawls) break;
		log.info('starting crawl', { crawlId });
		const { pages, captures } = await queryCrawl(crawlId, cdxPattern, slugRe, slugs, requestDelayMs, userAgent);
		if (pages > 0) {
			successes++;
			totalPages += pages;
			totalCaptures += captures;
			log.info('crawl complete', { crawlId, pages, captures, uniqueSlugs: slugs.size, successes, target: crawls });
		} else {
			log.warn('crawl unavailable, trying next', { crawlId });
		}
	}

	if (successes === 0) {
		throw new Error(
			'[cc] no CDX indices responded — the service may be temporarily unavailable',
		);
	}

	log.info('discovery complete', { successes, totalPages, totalCaptures, uniqueSlugs: slugs.size });
	return Array.from(slugs).sort();
}
