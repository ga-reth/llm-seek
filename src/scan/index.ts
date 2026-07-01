import { sleep } from 'bun';
import { createLogger } from '../lib/logger';
import { AshbySource } from '../providers/ashby/scan';
import type { Job, ATSSource } from '../types';
import {
	clearCheckpoint,
	computeSlugFingerprint,
	loadCheckpoint,
	saveCheckpoint,
} from './ats/checkpoint';

const log = createLogger('scan');

export interface ScanResult {
	slugCount: number;
	jobCount: number;
	jobs: Job[];
}

const sources: ATSSource[] = [new AshbySource()];

export async function scan(
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
		for (const source of sources) {
			const fetched = await source.fetch(slug);
			jobCount += fetched.length;
			jobs.push(...fetched);
		}
		log.debug('fetch complete', {
			slug,
			jobCount: jobs.length,
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
