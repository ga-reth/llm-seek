import { sleep } from 'bun';
import { createLogger } from '../../lib/logger';
import { AshbySource } from '../../providers/ashby/scan';
import type { ATSSource, Job } from '../../types';

const log = createLogger('scan:ats');

const REQUEST_DELAY_MS = 600;

const sources: ATSSource[] = [new AshbySource()];

export interface ATSScanResult {
	slugCount: number;
	jobCount: number;
	jobs: Job[];
}

export async function scanATS(
	slugs: string[],
	{ dryRun = false }: { dryRun?: boolean } = {},
): Promise<ATSScanResult> {
	const startMs = Date.now();
	log.info('start', { slugCount: slugs.length });

	let jobCount = 0;
	const jobs: Job[] = [];

	for (let i = 0; i < slugs.length; i++) {
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

		if (!dryRun && i < slugs.length - 1) await sleep(REQUEST_DELAY_MS);
	}

	log.info('complete', {
		slugCount: slugs.length,
		jobCount,
		durationMs: Date.now() - startMs,
	});

	return { slugCount: slugs.length, jobCount, jobs };
}
