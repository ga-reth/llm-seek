import type { config } from '../config';
import { createLogger } from '../lib/logger';
import { matches } from '../lib/text';
import type { Job } from '../types';
import type { FilterResult } from '.';

const log = createLogger('filter');

export interface JobFilter {
	passes(job: Job, cfg: typeof config): FilterResult;
}

export class TitleIncludeFilter implements JobFilter {
	passes(job: Job, cfg: typeof config): FilterResult {
		const keywords = cfg.titleInclude;
		if (keywords.length === 0) return { passed: true };
		const hit = keywords.some((kw) =>
			matches(job.title, kw, cfg.matchMode),
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
		const keywords = cfg.titleExclude;
		if (keywords.length === 0) return { passed: true };
		const hit = keywords.find((kw) =>
			matches(job.title, kw, cfg.matchMode),
		);
		return hit
			? { passed: false, reason: `title contains excluded keyword "${hit}"` }
			: { passed: true };
	}
}

export class MaxAgeFilter implements JobFilter {
	passes(job: Job, cfg: typeof config): FilterResult {
		if (job.publishedAt === null) {
			if (cfg.includeIfDateMissing) {
				log.warn('job has no publishedAt — including by default', {
					id: job.id,
				});
				return { passed: true };
			}
			return { passed: false, reason: 'publishedAt missing' };
		}
		const ageDays = (Date.now() - job.publishedAt.getTime()) / 86_400_000;
		return ageDays <= cfg.maxAgeDays
			? { passed: true }
			: {
					passed: false,
					reason: `too old (${Math.floor(ageDays)}d > ${cfg.maxAgeDays}d)`,
				};
	}
}

export class LocationFilter implements JobFilter {
	passes(job: Job, cfg: typeof config): FilterResult {
		const { remoteOnly, allowedLocations } = cfg;
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
		const allowed = cfg.allowedEmploymentTypes;
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
