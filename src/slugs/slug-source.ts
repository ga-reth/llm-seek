import { readFileSync } from 'node:fs';
import { config } from '../config';

// Bootstrap fallback used when slugs.json is absent or unpopulated.
const DEFAULT_SLUGS = ['notion', 'ramp', 'replit'];

interface SlugsFile {
	slugs: string[];
}

export function loadSlugs(): string[] {
	const harvested = readHarvested();
	return harvested.length > 0 ? harvested : DEFAULT_SLUGS;
}

function readHarvested(): string[] {
	try {
		const raw = readFileSync(config.sources.ashby.slugsFile, 'utf-8');
		const parsed = JSON.parse(raw) as SlugsFile;
		const slugs = parsed.slugs ?? [];
		if (slugs.length === 0) {
			console.warn(
				`[slugs] ${config.sources.ashby.slugsFile} contains no slugs — using default slugs`,
			);
		}
		return slugs;
	} catch {
		console.warn(
			`[slugs] no ${config.sources.ashby.slugsFile} found — using default slugs`,
		);
		return [];
	}
}
