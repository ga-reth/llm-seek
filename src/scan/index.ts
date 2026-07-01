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

const REQUEST_DELAY_MS = 600;
const CHECKPOINT_FILE = 'data/checkpoint.json';

export interface ScanResult {
	slugCount: number;
	jobCount: number;
	jobs: Job[];
}

const sources: ATSSource[] = [new AshbySource()];

export async function scan(
	slugs: string[],
	{ dryRun = false }: { dryRun?: boolean } = {},
): Promise<ScanResult> {
	const startMs = Date.now();
	log.info('scan start', { slugCount: slugs.length });

	const checkpointFile = dryRun ? null : CHECKPOINT_FILE;

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

		if (i < slugs.length - 1) await sleep(REQUEST_DELAY_MS);
	}

	if (checkpointFile) clearCheckpoint(checkpointFile);

	log.info('scan complete', {
		slugCount: slugs.length,
		jobCount,
		durationMs: Date.now() - startMs,
	});

	return { slugCount: slugs.length, jobCount, jobs };
}
