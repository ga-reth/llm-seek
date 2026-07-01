import { createLogger } from '../lib/logger';
import type { Job } from '../types';
import {
	clearCheckpoint,
	computeSlugFingerprint,
	loadCheckpoint,
	saveCheckpoint,
} from './ats/checkpoint';

const log = createLogger('scan');

export interface JobSource {
	fetch(slug: string): Promise<Job[]>;
}

export interface ScanResult {
	slugCount: number;
	jobCount: number;
	jobs: Job[];
}

function sleep(ms: number): Promise<void> {
	return new Promise((r) => setTimeout(r, ms));
}

export async function scan(
	source: JobSource,
	slugs: string[],
	{
		requestDelayMs = 0,
		checkpointFile = null,
	}: { requestDelayMs?: number; checkpointFile?: string | null } = {},
): Promise<ScanResult> {
	const startMs = Date.now();
	log.info('scan start', { slugCount: slugs.length });

	const slugFp = checkpointFile ? computeSlugFingerprint(slugs) : '';

	let startIndex = 0;
	let jobCount = 0;
	const jobs: Job[] = [];

	if (checkpointFile) {
		const cp = loadCheckpoint(checkpointFile, slugFp);
		if (cp) {
			startIndex = cp.resumeFromIndex;
			jobCount = cp.jobCount;
			jobs.push(...cp.jobs);
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
		const fetched = await source.fetch(slug);
		jobCount += fetched.length;
		jobs.push(...fetched);
		log.debug('fetch complete', {
			slug,
			jobCount: fetched.length,
			durationMs: Date.now() - slugStartMs,
		});

		if (checkpointFile) {
			saveCheckpoint(checkpointFile, {
				slugFingerprint: slugFp,
				resumeFromIndex: i + 1,
				jobCount,
				jobs: [...jobs],
			});
		}

		if (requestDelayMs > 0 && i < slugs.length - 1) await sleep(requestDelayMs);
	}

	if (checkpointFile) clearCheckpoint(checkpointFile);

	log.info('scan complete', {
		slugCount: slugs.length,
		jobCount,
		durationMs: Date.now() - startMs,
	});

	return { slugCount: slugs.length, jobCount, jobs };
}
