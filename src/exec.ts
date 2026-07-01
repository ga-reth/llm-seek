import {
	clearCheckpoint,
	computeSlugFingerprint,
	loadCheckpoint,
	saveCheckpoint,
} from './checkpoint';
import type { config } from './config';
import { exec as execFilter, type JobFilter } from './filter';
import { createLogger } from './lib/logger';
import type { SeenStore } from './seen-store';
import type { JobSource } from './sources';
import type { Job } from './types';

const log = createLogger('exec');

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
	const startMs = Date.now();
	log.info('run start', { slugCount: slugs.length, dryRun });

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
			log.info('resuming from checkpoint', {
				resumeFromIndex: startIndex,
				total: slugs.length,
			});
		}
	}
	for (let i = startIndex; i < slugs.length; i++) {
		const slug = slugs[i];
		const slugStartMs = Date.now();
		log.debug('fetch start', { slug, index: i, total: slugs.length });
		const jobs = await source.fetch(slug);
		jobCount += jobs.length;
		let slugMatchCount = 0;
		let slugDropCount = 0;
		for (const job of jobs) {
			const result = execFilter(job, filters, cfg);
			if (result.passed) {
				matched.push(job);
				slugMatchCount++;
				log.debug('job passed', {
					id: job.id,
					title: job.title,
					company: job.company,
				});
			} else {
				const reason = result.reason ?? 'unknown';
				dropped.push({ job, reason });
				slugDropCount++;
				log.debug('job dropped', {
					id: job.id,
					title: job.title,
					company: job.company,
					reason,
				});
			}
		}
		log.debug('fetch complete', {
			slug,
			jobCount: jobs.length,
			matchCount: slugMatchCount,
			dropCount: slugDropCount,
			durationMs: Date.now() - slugStartMs,
		});
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

	log.info('run complete', {
		slugCount: slugs.length,
		jobCount,
		matchCount: matched.length,
		newMatchCount: newMatches.length,
		droppedCount: dropped.length,
		durationMs: Date.now() - startMs,
	});

	return {
		slugCount: slugs.length,
		jobCount,
		matched,
		newMatches,
		dropped,
	};
}
