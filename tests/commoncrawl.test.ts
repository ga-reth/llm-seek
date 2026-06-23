import { describe, expect, it } from 'bun:test';

const SLUG_RE = /jobs\.ashbyhq\.com\/([^/?#]+)/i;

function extractSlug(url: string): string | null {
	return url.match(SLUG_RE)?.[1]?.toLowerCase() ?? null;
}

describe('slug extraction', () => {
	it('extracts slug from board root', () => {
		expect(extractSlug('https://jobs.ashbyhq.com/ramp')).toBe('ramp');
	});

	it('extracts slug from job detail path', () => {
		expect(extractSlug('https://jobs.ashbyhq.com/replit/abc123/apply')).toBe(
			'replit',
		);
	});

	it('extracts slug ignoring query strings', () => {
		expect(extractSlug('https://jobs.ashbyhq.com/notion?ref=foo')).toBe(
			'notion',
		);
	});

	it('returns null for non-ashby urls', () => {
		expect(extractSlug('https://jobs.greenhouse.io/stripe')).toBeNull();
	});

	it('is case-insensitive', () => {
		expect(extractSlug('https://jobs.ashbyhq.com/Ramp')).toBe('ramp');
	});

	it('deduplicates slugs across pages', () => {
		const urls = [
			'https://jobs.ashbyhq.com/ramp',
			'https://jobs.ashbyhq.com/ramp/abc/apply',
			'https://jobs.ashbyhq.com/replit',
			'https://jobs.ashbyhq.com/ramp?ref=linkedin',
		];
		const slugs = new Set(urls.map(extractSlug).filter(Boolean));
		expect(slugs.size).toBe(2);
		expect(slugs.has('ramp')).toBe(true);
		expect(slugs.has('replit')).toBe(true);
	});

	it('ignores fragment-only paths', () => {
		expect(extractSlug('https://jobs.ashbyhq.com/#section')).toBeNull();
	});
});
