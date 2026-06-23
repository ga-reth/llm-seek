import { mkdirSync, writeFileSync } from 'node:fs';
import { discoverSlugs } from './slugs/common-crawl';

async function main(): Promise<void> {
	console.log('[discover] starting Common Crawl slug discovery…');
	const slugs = await discoverSlugs();

	const output = {
		source: 'ashby',
		generatedAt: new Date().toISOString(),
		count: slugs.length,
		slugs,
	};

	mkdirSync('data', { recursive: true });
	writeFileSync('data/slugs.json', JSON.stringify(output, null, 2));
	console.log(`[discover] wrote ${slugs.length} slugs to data/slugs.json`);
}

main().catch((err) => {
	console.error('[discover] fatal:', err);
	process.exit(1);
});
