export const config = {
	discovery: {
		ashby: {
			crawls: 4,
			requestDelayMs: 1000,
			userAgent: 'LLMSeek/0.1',
		},
	},
	sources: {
		ashby: {
			slugsFile: 'data/slugs.json',
			requestDelayMs: 600,
		},
	},
	filters: {
		titleInclude: ['engineer'] as string[],
		titleExclude: [
			'lead',
			'manager',
			'principal',
			'junior',
		] as string[],
		maxAgeDays: 14,
		matchMode: 'word' as 'word' | 'substring',
		includeIfDateMissing: true,
		remoteOnly: false,
		allowedLocations: [] as string[],
		allowedEmploymentTypes: [] as string[],
	},
	seenStore: {
		file: 'data/seen.json',
		ttlDays: 45,
	},
	run: {
		checkpointFile: 'data/checkpoint.json' as string | null,
	},
};
