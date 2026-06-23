import { describe, expect, it } from 'bun:test';
import { config } from '../src/config';
import {
	EmploymentTypeFilter,
	LocationFilter,
	MaxAgeFilter,
	TitleExcludeFilter,
	TitleIncludeFilter,
} from '../src/filter';
import type { Job } from '../src/types';

function makeJob(overrides: Partial<Job> = {}): Job {
	return {
		id: 'test-id',
		source: 'ashby',
		company: 'acme',
		title: 'Software Engineer',
		location: 'Remote',
		isRemote: true,
		employmentType: 'FullTime',
		publishedAt: new Date(),
		url: 'https://jobs.ashbyhq.com/acme',
		raw: {},
		...overrides,
	};
}

function cfg(overrides: Partial<typeof config.filters> = {}): typeof config {
	return { ...config, filters: { ...config.filters, ...overrides } };
}

describe('TitleIncludeFilter', () => {
	const f = new TitleIncludeFilter();

	it('passes when title contains an include keyword', () => {
		expect(f.passes(makeJob({ title: 'Senior Engineer' }), cfg()).passed).toBe(
			true,
		);
	});

	it('fails when title contains none', () => {
		expect(f.passes(makeJob({ title: 'Product Designer' }), cfg()).passed).toBe(
			false,
		);
	});

	it('is a no-op when list is empty', () => {
		expect(
			f.passes(
				makeJob({ title: 'Product Designer' }),
				cfg({ titleInclude: [] }),
			).passed,
		).toBe(true);
	});

	it('is case-insensitive', () => {
		expect(f.passes(makeJob({ title: 'SENIOR ENGINEER' }), cfg()).passed).toBe(
			true,
		);
	});
});

describe('TitleExcludeFilter', () => {
	const f = new TitleExcludeFilter();

	it('passes when no excluded keyword present', () => {
		expect(
			f.passes(makeJob({ title: 'Software Engineer' }), cfg()).passed,
		).toBe(true);
	});

	it('fails when an excluded keyword is present', () => {
		expect(
			f.passes(makeJob({ title: 'Engineering Manager' }), cfg()).passed,
		).toBe(false);
	});

	it('is a no-op when list is empty', () => {
		expect(
			f.passes(
				makeJob({ title: 'Engineering Manager' }),
				cfg({ titleExclude: [] }),
			).passed,
		).toBe(true);
	});

	it("word mode: 'lead' blocks 'Lead Engineer' but not 'Leadership Engineer'", () => {
		expect(
			f.passes(makeJob({ title: 'Lead Engineer' }), cfg({ matchMode: 'word' }))
				.passed,
		).toBe(false);
		expect(
			f.passes(
				makeJob({ title: 'Leadership Engineer' }),
				cfg({ matchMode: 'word' }),
			).passed,
		).toBe(true);
	});

	it("substring mode: 'lead' blocks 'Leadership Engineer'", () => {
		expect(
			f.passes(
				makeJob({ title: 'Leadership Engineer' }),
				cfg({ matchMode: 'substring' }),
			).passed,
		).toBe(false);
	});
});

describe('MaxAgeFilter', () => {
	const f = new MaxAgeFilter();

	it('passes when job is within maxAgeDays', () => {
		const publishedAt = new Date(Date.now() - 10 * 86_400_000);
		expect(
			f.passes(makeJob({ publishedAt }), cfg({ maxAgeDays: 30 })).passed,
		).toBe(true);
	});

	it('fails when job is older than maxAgeDays', () => {
		const publishedAt = new Date(Date.now() - 31 * 86_400_000);
		expect(
			f.passes(makeJob({ publishedAt }), cfg({ maxAgeDays: 30 })).passed,
		).toBe(false);
	});

	it('passes at exactly maxAgeDays boundary', () => {
		const publishedAt = new Date(Date.now() - 30 * 86_400_000);
		expect(
			f.passes(makeJob({ publishedAt }), cfg({ maxAgeDays: 30 })).passed,
		).toBe(true);
	});

	it('includes null-date job when includeIfDateMissing is true', () => {
		expect(
			f.passes(
				makeJob({ publishedAt: null }),
				cfg({ includeIfDateMissing: true }),
			).passed,
		).toBe(true);
	});

	it('excludes null-date job when includeIfDateMissing is false', () => {
		expect(
			f.passes(
				makeJob({ publishedAt: null }),
				cfg({ includeIfDateMissing: false }),
			).passed,
		).toBe(false);
	});
});

describe('LocationFilter', () => {
	const f = new LocationFilter();

	it('passes remote job when remoteOnly is true', () => {
		expect(
			f.passes(
				makeJob({ isRemote: true }),
				cfg({ remoteOnly: true, allowedLocations: [] }),
			).passed,
		).toBe(true);
	});

	it('fails non-remote job when remoteOnly is true and no allowedLocations', () => {
		expect(
			f.passes(
				makeJob({ isRemote: false, location: 'New York' }),
				cfg({ remoteOnly: true, allowedLocations: [] }),
			).passed,
		).toBe(false);
	});

	it('OR logic: passes non-remote job when location matches allowedLocations', () => {
		expect(
			f.passes(
				makeJob({ isRemote: false, location: 'London, UK' }),
				cfg({ remoteOnly: true, allowedLocations: ['London'] }),
			).passed,
		).toBe(true);
	});

	it('is a no-op when remoteOnly false and allowedLocations empty', () => {
		expect(
			f.passes(
				makeJob({ isRemote: false, location: 'São Paulo' }),
				cfg({ remoteOnly: false, allowedLocations: [] }),
			).passed,
		).toBe(true);
	});

	it('fails when location is null and remoteOnly job is not remote', () => {
		expect(
			f.passes(
				makeJob({ isRemote: false, location: null }),
				cfg({ remoteOnly: true, allowedLocations: ['London'] }),
			).passed,
		).toBe(false);
	});
});

describe('EmploymentTypeFilter', () => {
	const f = new EmploymentTypeFilter();

	it('passes when employmentType matches', () => {
		expect(
			f.passes(
				makeJob({ employmentType: 'FullTime' }),
				cfg({ allowedEmploymentTypes: ['FullTime'] }),
			).passed,
		).toBe(true);
	});

	it('fails when employmentType does not match', () => {
		expect(
			f.passes(
				makeJob({ employmentType: 'Contract' }),
				cfg({ allowedEmploymentTypes: ['FullTime'] }),
			).passed,
		).toBe(false);
	});

	it('passes null employmentType (null-as-pass)', () => {
		expect(
			f.passes(
				makeJob({ employmentType: null }),
				cfg({ allowedEmploymentTypes: ['FullTime'] }),
			).passed,
		).toBe(true);
	});

	it('is a no-op when allowedEmploymentTypes is empty', () => {
		expect(
			f.passes(
				makeJob({ employmentType: 'Contract' }),
				cfg({ allowedEmploymentTypes: [] }),
			).passed,
		).toBe(true);
	});

	it('supports multiple allowed types', () => {
		expect(
			f.passes(
				makeJob({ employmentType: 'Contract' }),
				cfg({ allowedEmploymentTypes: ['FullTime', 'Contract'] }),
			).passed,
		).toBe(true);
	});
});
