import type { config } from './config';
import { createLogger } from './lib/logger';
import { matches } from './lib/text';
import type { FilterResult, Job } from './types';

const log = createLogger('filter');

export interface JobFilter {
	passes(job: Job, cfg: typeof config): FilterResult;
}

export function exec(
	job: Job,
	filters: JobFilter[],
	cfg: typeof config,
): FilterResult {
	for (const filter of filters) {
		const result = filter.passes(job, cfg);
		if (!result.passed) return result;
	}
	return { passed: true };
}

export class TitleIncludeFilter implements JobFilter {
	passes(job: Job, cfg: typeof config): FilterResult {
		const keywords = cfg.filters.titleInclude;
		if (keywords.length === 0) return { passed: true };
		const hit = keywords.some((kw) =>
			matches(job.title, kw, cfg.filters.matchMode),
		);
		return hit
			? { passed: true }
			: {
					passed: false,
					reason: `title missing required keywords (${keywords.join(', ')})`,
				};
	}
}

export class TitleExcludeFilter implements JobFilter {
	passes(job: Job, cfg: typeof config): FilterResult {
		const keywords = cfg.filters.titleExclude;
		if (keywords.length === 0) return { passed: true };
		const hit = keywords.find((kw) =>
			matches(job.title, kw, cfg.filters.matchMode),
		);
		return hit
			? { passed: false, reason: `title contains excluded keyword "${hit}"` }
			: { passed: true };
	}
}

export class MaxAgeFilter implements JobFilter {
	passes(job: Job, cfg: typeof config): FilterResult {
		if (job.publishedAt === null) {
			if (cfg.filters.includeIfDateMissing) {
				log.warn('job has no publishedAt — including by default', { id: job.id });
				return { passed: true };
			}
			return { passed: false, reason: 'publishedAt missing' };
		}
		const ageDays = (Date.now() - job.publishedAt.getTime()) / 86_400_000;
		return ageDays <= cfg.filters.maxAgeDays
			? { passed: true }
			: {
					passed: false,
					reason: `too old (${Math.floor(ageDays)}d > ${cfg.filters.maxAgeDays}d)`,
				};
	}
}

export class LocationFilter implements JobFilter {
	passes(job: Job, cfg: typeof config): FilterResult {
		const { remoteOnly, allowedLocations } = cfg.filters;
		if (!remoteOnly && allowedLocations.length === 0) return { passed: true };
		if (remoteOnly && job.isRemote) return { passed: true };
		if (allowedLocations.length > 0 && job.location) {
			const hit = allowedLocations.some((loc) =>
				job.location?.toLowerCase().includes(loc.toLowerCase()),
			);
			if (hit) return { passed: true };
		}
		return {
			passed: false,
			reason: `location "${job.location}" not remote or in allowedLocations`,
		};
	}
}

export class EmploymentTypeFilter implements JobFilter {
	passes(job: Job, cfg: typeof config): FilterResult {
		const allowed = cfg.filters.allowedEmploymentTypes;
		if (allowed.length === 0) return { passed: true };
		if (job.employmentType === null) return { passed: true };
		return allowed.includes(job.employmentType)
			? { passed: true }
			: {
					passed: false,
					reason: `employmentType "${job.employmentType}" not in allowedEmploymentTypes`,
				};
	}
}
