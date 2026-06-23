import { readFileSync } from 'node:fs';
import { config } from '../config';

interface SlugsFile {
	slugs: string[];
}

export function loadSlugs(): string[] {
	const harvested = readHarvested();
	const manual = readManual();
	const merged = Array.from(new Set([...harvested, ...manual])).sort();

	if (merged.length === 0) {
		console.error(
			"[slugs] no slugs found — add entries to data/slugs.manual.json or run 'bun discover'",
		);
		process.exit(1);
	}

	return merged;
}

function readHarvested(): string[] {
	try {
		const raw = readFileSync(config.sources.ashby.slugsFile, 'utf-8');
		const parsed = JSON.parse(raw) as SlugsFile;
		return parsed.slugs ?? [];
	} catch {
		console.warn(
			`[slugs] no ${config.sources.ashby.slugsFile} found — using manual slugs only`,
		);
		return [];
	}
}

function readManual(): string[] {
	try {
		const raw = readFileSync(config.sources.ashby.manualSlugsFile, 'utf-8');
		return JSON.parse(raw) as string[];
	} catch {
		console.warn(`[slugs] no ${config.sources.ashby.manualSlugsFile} found`);
		return [];
	}
}
