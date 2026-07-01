import { describe, expect, it } from 'bun:test';
import { AshbySource } from '../src/providers/ashby/scan';

const fixtureResponse = require('./fixtures/ashby.json');

// biome-ignore lint/suspicious/noExplicitAny: todo
function mockFetch(payload: unknown, status = 200): any {
	// biome-ignore lint/suspicious/noExplicitAny: todo
	const fn: any = async () => new Response(JSON.stringify(payload), { status });
	// provide properties that some environments expect on fetch
	fn.preconnect = () => {};
	return fn;
}

describe('AshbySource normalisation', () => {
	it('parses all listed jobs from the ramp fixture', async () => {
		const source = new AshbySource(mockFetch(fixtureResponse));
		const jobs = await source.fetch('ramp');
		expect(jobs.length).toBe(
			fixtureResponse.jobs.filter(
				(j: unknown) => (j as { isListed?: boolean }).isListed !== false,
			).length,
		);
		expect(jobs.every((j) => j.source === 'ashby')).toBe(true);
		expect(jobs.every((j) => j.company === 'ramp')).toBe(true);
	});

	it('drops isListed === false jobs', async () => {
		const payload = {
			jobs: [
				{
					id: 'listed-1',
					title: 'Engineer',
					isListed: true,
					isRemote: true,
					employmentType: 'FullTime',
					publishedAt: '2026-06-01T00:00:00.000+00:00',
					jobUrl: 'https://jobs.ashbyhq.com/acme/listed-1',
					applyUrl: 'https://jobs.ashbyhq.com/acme/listed-1/application',
				},
				{
					id: 'unlisted-2',
					title: 'Intern',
					isListed: false,
					isRemote: false,
					employmentType: 'Intern',
					publishedAt: '2026-06-01T00:00:00.000+00:00',
					jobUrl: 'https://jobs.ashbyhq.com/acme/unlisted-2',
					applyUrl: null,
				},
			],
		};
		const source = new AshbySource(mockFetch(payload));
		const jobs = await source.fetch('acme');
		expect(jobs.length).toBe(1);
		expect(jobs[0].id).toBe('listed-1');
	});

	it('parses publishedAt correctly from TZ-offset string', async () => {
		const payload = {
			jobs: [
				{
					id: 'x',
					title: 'Engineer',
					isListed: true,
					isRemote: true,
					publishedAt: '2026-06-03T21:25:11.155+00:00',
					jobUrl: 'https://jobs.ashbyhq.com/acme/x',
				},
			],
		};
		const source = new AshbySource(mockFetch(payload));
		const jobs = await source.fetch('acme');
		expect(jobs[0].publishedAt).toBeInstanceOf(Date);
		expect(jobs[0].publishedAt?.getUTCFullYear()).toBe(2026);
		expect(jobs[0].publishedAt?.getUTCMonth()).toBe(5);
		expect(jobs[0].publishedAt?.getUTCDate()).toBe(3);
	});

	it('returns [] on 404', async () => {
		const source = new AshbySource(mockFetch(null, 404));
		expect(await source.fetch('nonexistent-slug')).toEqual([]);
	});

	it('prefers applyUrl over jobUrl', async () => {
		const payload = {
			jobs: [
				{
					id: 'y',
					title: 'Engineer',
					isListed: true,
					isRemote: true,
					applyUrl: 'https://apply.example.com',
					jobUrl: 'https://job.example.com',
				},
			],
		};
		const source = new AshbySource(mockFetch(payload));
		const jobs = await source.fetch('acme');
		expect(jobs[0].url).toBe('https://apply.example.com');
	});
});
