import type { config } from './config';
import {
	clearCheckpoint,
	computeSlugFingerprint,
	loadCheckpoint,
	saveCheckpoint,
} from './checkpoint';
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
	{
		requestDelayMs = 0,
		dryRun = false,
	}: { requestDelayMs?: number; dryRun?: boolean } = {},
): Promise<RunResult> {
	const checkpointFile = dryRun ? null : (cfg.run.checkpointFile ?? null);
	const slugFp = checkpointFile ? computeSlugFingerprint(slugs) : '';
	const filterFp = checkpointFile ? JSON.stringify(cfg.filters) : '';

	let startIndex = 0;
	let jobCount = 0;
	const matched: Job[] = [];
	const dropped: Array<{ job: Job; reason: string }> = [];

	if (checkpointFile) {
		const cp = loadCheckpoint(checkpointFile, slugFp, filterFp);
		if (cp) {
			startIndex = cp.resumeFromIndex;
			jobCount = cp.jobCount;
			matched.push(...cp.matched);
			console.log(
				`[checkpoint] resuming from slug ${startIndex}/${slugs.length}`,
			);
		}
	}
	for (let i = startIndex; i < slugs.length; i++) {
		const jobs = await source.fetch(slugs[i]);
		jobCount += jobs.length;
		for (const job of jobs) {
			const result = execFilter(job, filters, cfg);
			if (result.passed) {
				matched.push(job);
			} else {
				dropped.push({ job, reason: result.reason ?? 'unknown' });
			}
		}
		if (checkpointFile) {
			saveCheckpoint(checkpointFile, {
				slugFingerprint: slugFp,
				filterFingerprint: filterFp,
				resumeFromIndex: i + 1,
				jobCount,
				matched: [...matched],
			});
		}
		if (requestDelayMs > 0 && i < slugs.length - 1) await sleep(requestDelayMs);
	}

	if (checkpointFile) clearCheckpoint(checkpointFile);

	const seenIds = seenStore.load();
	const newMatches = matched.filter((j) => !seenIds.has(j.id));

	return {
		slugCount: slugs.length,
		jobCount,
		matched,
		newMatches,
		dropped,
	};
}
