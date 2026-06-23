import type { Job } from '../types';

export interface JobSource {
	fetch(slug: string): Promise<Job[]>;
}
