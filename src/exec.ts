import type { config } from './config';
import { exec as execFilter, type JobFilter } from './filter';
import type { SeenStore } from './seen-store';
import type { JobSource } from './sources';
import type { Job } from './types';

export interface RunResult {
	slugCount: number;
	jobCount: number;
	matched: Job[];
	newMatches: Job[];
	dropped: Array<{ job: Job; reason: string }>;
}

function sleep(ms: number): Promise<void> {
	return new Promise((r) => setTimeout(r, ms));
}

export async function exec(
	source: JobSource,
	slugs: string[],
	filters: JobFilter[],
	seenStore: SeenStore,
	cfg: typeof config,
	{ requestDelayMs = 0 }: { requestDelayMs?: number } = {},
): Promise<RunResult> {
	const allJobs: Job[] = [];
	for (let i = 0; i < slugs.length; i++) {
		const jobs = await source.fetch(slugs[i]);
		allJobs.push(...jobs);
		if (requestDelayMs > 0 && i < slugs.length - 1) await sleep(requestDelayMs);
	}

	const matched: Job[] = [];
	const dropped: Array<{ job: Job; reason: string }> = [];
	for (const job of allJobs) {
		const result = execFilter(job, filters, cfg);
		if (result.passed) {
			matched.push(job);
		} else {
			dropped.push({ job, reason: result.reason ?? 'unknown' });
		}
	}

	const seenIds = seenStore.load();
	const newMatches = matched.filter((j) => !seenIds.has(j.id));

	return {
		slugCount: slugs.length,
		jobCount: allJobs.length,
		matched,
		newMatches,
		dropped,
	};
}
