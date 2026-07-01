import type { config } from '../config';
import type { Job } from '../types';
import {
	EmploymentTypeFilter,
	type JobFilter,
	LocationFilter,
	MaxAgeFilter,
	TitleExcludeFilter,
	TitleIncludeFilter,
} from './filters';

export interface FilterOutput {
	matched: Job[];
	dropped: Array<{ job: Job; reason: string }>;
}

export interface FilterResult {
	passed: boolean;
	reason?: string;
}

const filters: JobFilter[] = [
	new TitleIncludeFilter(),
	new TitleExcludeFilter(),
	new MaxAgeFilter(),
	new LocationFilter(),
	new EmploymentTypeFilter(),
];

export function filter(jobs: Job[], cfg: typeof config): FilterOutput {
	const matched: Job[] = [];
	const dropped: Array<{ job: Job; reason: string }> = [];
	for (const job of jobs) {
		let result: FilterResult = { passed: true };
		for (const f of filters) {
			result = f.passes(job, cfg);
			if (!result.passed) break;
		}
		if (result.passed) {
			matched.push(job);
		} else {
			dropped.push({ job, reason: result.reason ?? 'unknown' });
		}
	}
	return { matched, dropped };
}
