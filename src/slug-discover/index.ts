import { mkdirSync, writeFileSync } from 'node:fs';
import { createLogger } from '../lib/logger';
import { discoverAshbySlugs } from '../providers/ashby/discover';

const log = createLogger('discover');

async function main(): Promise<void> {
	log.info('starting slug discovery');
	const results = await Promise.all([discoverAshbySlugs()]);
	const slugs = [...new Set(results.flat())].sort();

	const output = {
		generatedAt: new Date().toISOString(),
		count: slugs.length,
		slugs,
	};

	mkdirSync('data', { recursive: true });
	writeFileSync('data/slugs.json', JSON.stringify(output, null, 2));
	log.info('wrote slugs file', {
		count: slugs.length,
		file: 'data/slugs.json',
	});
}

main().catch((err) => {
	log.error('fatal', { err: String(err) });
	process.exit(1);
});
