export interface ATSSource {
	fetch(slug: string): Promise<Job[]>;
}

export interface Job {
	id: string;
	source: string;
	company: string;
	title: string;
	location: string | null;
	isRemote: boolean | null;
	employmentType: string | null;
	publishedAt: Date | null;
	url: string;
	raw: unknown;
}
