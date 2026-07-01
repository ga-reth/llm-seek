export const config = {
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
};
