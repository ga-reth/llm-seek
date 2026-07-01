import { mkdirSync, writeFileSync } from 'node:fs';
import { createLogger } from '../lib/logger';
import { discoverSlugs } from './common-crawl';

const log = createLogger('discover');

async function main(): Promise<void> {
	log.info('starting Common Crawl slug discovery');
	const slugs = await discoverSlugs();

	const output = {
		source: 'ashby',
		generatedAt: new Date().toISOString(),
		count: slugs.length,
		slugs,
	};

	mkdirSync('data', { recursive: true });
	writeFileSync('data/slugs.json', JSON.stringify(output, null, 2));
	log.info('wrote slugs file', { count: slugs.length, file: 'data/slugs.json' });
}

main().catch((err) => {
	log.error('fatal', { err: String(err) });
	process.exit(1);
});
