import { readFileSync } from 'node:fs';
import { config } from '../config';
import { createLogger } from '../lib/logger';

// Bootstrap fallback used when slugs.json is absent or unpopulated.
const DEFAULT_SLUGS = ['notion', 'ramp', 'replit'];

const log = createLogger('slugs');

interface SlugsFile {
	slugs: string[];
}

export function loadSlugs(): string[] {
	const harvested = readHarvested();
	if (harvested.length > 0) {
		log.info('slugs loaded', { count: harvested.length, source: 'harvested' });
		return harvested;
	}
	log.info('slugs loaded', { count: DEFAULT_SLUGS.length, source: 'default' });
	return DEFAULT_SLUGS;
}

function readHarvested(): string[] {
	try {
		const raw = readFileSync(config.sources.ashby.slugsFile, 'utf-8');
		const parsed = JSON.parse(raw) as SlugsFile;
		const slugs = parsed.slugs ?? [];
		if (slugs.length === 0) {
			log.warn('slugs file contains no slugs — using default slugs', {
				file: config.sources.ashby.slugsFile,
			});
		}
		return slugs;
	} catch {
		log.warn('slugs file not found — using default slugs', {
			file: config.sources.ashby.slugsFile,
		});
		return [];
	}
}
