import { createLogger } from '../lib/logger';
import type { Job } from '../types';
import { scanATS } from './ats';

const log = createLogger('scan');

export interface ScanResult {
	jobs: Job[];
	jobCount: number;
	slugCount: number;
}

export async function scan(
	slugs: string[],
	{ dryRun = false }: { dryRun?: boolean } = {},
): Promise<ScanResult> {
	const startMs = Date.now();
	log.info('start', { dryRun });

	const [ats] = await Promise.all([
		scanATS(slugs, { dryRun }),
		// scanBoards({ dryRun }),  // add board sources here
	]);

	const jobs = [...ats.jobs];
	const jobCount = ats.jobCount;

	log.info('complete', { jobCount, durationMs: Date.now() - startMs });

	return { jobs, jobCount, slugCount: ats.slugCount };
}
