import { mkdirSync, writeFileSync } from 'node:fs';
import { config } from './config';
import { filter } from './filter';
import { createLogger } from './lib/logger';
import { padded } from './lib/utils';
import { scan } from './scan';
import { AshbySource } from './scan/ats/ashby';
import { loadSlugs } from './slug-discover/slug-source';
import { SeenStore } from './store/seen';
import type { Job } from './types';

const log = createLogger('run');

const verbose = process.argv.includes('--verbose');
const dryRunFlag = process.argv.indexOf('--dryRun');
const dryRun = dryRunFlag !== -1;
const dryRunCount = (() => {
	if (!dryRun) return 0;
	const next = parseInt(process.argv[dryRunFlag + 1] ?? '', 10);
	return Number.isNaN(next) ? 10 : next;
})();

async function main(): Promise<void> {
	let slugs = loadSlugs();

	if (dryRun) {
		slugs = slugs.slice(0, dryRunCount);
		log.info('dry run', { slugCount: slugs.length });
	} else {
		log.info('slugs ready', { slugCount: slugs.length });
	}

	const source = new AshbySource();
	const seenStore = new SeenStore(
		config.seenStore.file,
		config.seenStore.ttlDays,
		JSON.stringify(config.filters),
	);

	const { jobs, slugCount, jobCount } = await scan(source, slugs, {
		requestDelayMs: config.sources.ashby.requestDelayMs,
		checkpointFile: dryRun ? null : config.run.checkpointFile,
	});

	const { matched, dropped } = filter(jobs, config);

	const seenIds = seenStore.load();
	const newMatches = matched.filter((j) => !seenIds.has(j.id));

	if (!dryRun) {
		mkdirSync('out', { recursive: true });
		writeFileSync('out/matches.json', JSON.stringify(matched, null, 2));
		log.info('wrote file', { file: 'out/matches.json', count: matched.length });
		writeFileSync('out/new_matches.json', JSON.stringify(newMatches, null, 2));
		log.info('wrote file', {
			file: 'out/new_matches.json',
			count: newMatches.length,
		});
		seenStore.save(newMatches.map((j) => j.id));
	}

	const summary = `${slugCount} slugs · ${jobCount} jobs fetched · ${matched.length} matched · ${newMatches.length} new`;
	console.log(`\n[run] ${summary}\n`);

	if (newMatches.length > 0) {
		printTable(newMatches);
	} else {
		console.log('No new matches.');
	}

	if (verbose && dropped.length > 0) {
		console.log(`\nDROPPED (${dropped.length})`);
		console.log('─'.repeat(80));
		console.log(`${padded('Title', 35) + padded('Company', 18)}Reason`);
		console.log('─'.repeat(80));
		for (const { job, reason } of dropped) {
			console.log(padded(job.title, 35) + padded(job.company, 18) + reason);
		}
	}
}

function printTable(jobs: Job[]): void {
	console.log(`NEW MATCHES (${jobs.length})`);
	console.log('─'.repeat(144));
	console.log(
		padded('Title', 96) +
			padded('Company', 16) +
			padded('Location', 18) +
			padded('Age', 6) +
			'Type',
	);
	console.log('─'.repeat(144));
	const now = Date.now();
	for (const job of jobs) {
		const age = job.publishedAt
			? `${Math.floor((now - job.publishedAt.getTime()) / 86_400_000)}d`
			: '?';
		const loc =
			job.isRemote === true
				? 'Remote'
				: job.isRemote === null
					? `${job.location ?? '?'} (?)`
					: (job.location ?? '?');
		console.log(
			padded(job.title, 96) +
				padded(job.company, 16) +
				padded(loc, 18) +
				padded(age, 6) +
				(job.employmentType ?? '?'),
		);
	}
}

main().catch((err) => {
	log.error('fatal', { err: String(err) });
	process.exit(1);
});
