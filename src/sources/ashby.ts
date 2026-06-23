import { z } from 'zod';
import type { Job } from '../types';
import type { JobSource } from '.';

const AshbyJobSchema = z.object({
	id: z.string(),
	title: z.string(),
	isListed: z.boolean().optional(),
	location: z.string().nullable().optional(),
	isRemote: z.boolean().nullable().optional(),
	employmentType: z.string().nullable().optional(),
	publishedAt: z.string().datetime({ offset: true }).optional(),
	applyUrl: z.string().nullable().optional(),
	jobUrl: z.string().optional(),
});

const AshbyBoardSchema = z.object({
	jobs: z.array(AshbyJobSchema),
});

const BASE = 'https://api.ashbyhq.com/posting-api/job-board';

type FetchFn = typeof globalThis.fetch;

function sleep(ms: number): Promise<void> {
	return new Promise((r) => setTimeout(r, ms));
}

export class AshbySource implements JobSource {
	constructor(private readonly fetchFn: FetchFn = globalThis.fetch) {}

	async fetch(slug: string): Promise<Job[]> {
		const url = `${BASE}/${slug}?includeCompensation=true`;
		let res: Response;
		try {
			res = await this.fetchWithRetry(url);
		} catch (err) {
			console.warn(`[ashby] fetch error for "${slug}": ${err}`);
			return [];
		}

		if (res.status === 404) return [];
		if (!res.ok) {
			console.warn(`[ashby] HTTP ${res.status} for "${slug}"`);
			return [];
		}

		let body: unknown;
		try {
			body = await res.json();
		} catch {
			console.warn(`[ashby] invalid JSON for "${slug}"`);
			return [];
		}

		const parsed = AshbyBoardSchema.safeParse(body);
		if (!parsed.success) {
			console.warn(
				`[ashby] schema mismatch for "${slug}":`,
				parsed.error.issues[0],
			);
			return [];
		}

		return parsed.data.jobs
			.filter((j) => j.isListed !== false)
			.map(
				(j): Job => ({
					id: j.id,
					source: 'ashby',
					company: slug,
					title: j.title,
					location: j.location ?? null,
					isRemote: j.isRemote ?? null,
					employmentType: j.employmentType ?? null,
					publishedAt: j.publishedAt ? parseDate(j.publishedAt) : null,
					url: j.applyUrl ?? j.jobUrl ?? `https://jobs.ashbyhq.com/${slug}`,
					raw: j,
				}),
			);
	}

	private async fetchWithRetry(url: string): Promise<Response> {
		const headers = { 'User-Agent': 'JobSeek/0.1' };
		let delay = 2000;
		for (let attempt = 0; attempt <= 3; attempt++) {
			const res = await this.fetchFn(url, { headers });
			if (res.status !== 429) return res;
			if (attempt < 3) {
				console.warn(`[ashby] 429 on ${url}, retrying in ${delay}ms`);
				await sleep(delay);
				delay *= 2;
			}
		}
		throw new Error(`429 persisted after retries: ${url}`);
	}
}

function parseDate(s: string): Date | null {
	const d = new Date(s);
	return Number.isNaN(d.getTime()) ? null : d;
}
