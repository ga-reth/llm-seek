import { createHash } from 'node:crypto';
import {
	mkdirSync,
	readFileSync,
	renameSync,
	rmSync,
	writeFileSync,
} from 'node:fs';
import { dirname } from 'node:path';
import { createLogger } from '../../lib/logger';
import type { Job } from '../../types';

const log = createLogger('checkpoint');

export interface CheckpointData {
	slugFingerprint: string;
	resumeFromIndex: number;
	jobCount: number;
	jobs: Job[];
}

interface StoredJob extends Omit<Job, 'publishedAt'> {
	publishedAt: string | null;
}

interface StoredCheckpoint {
	slugFingerprint: string;
	resumeFromIndex: number;
	jobCount: number;
	jobs: StoredJob[];
}

export function computeSlugFingerprint(slugs: string[]): string {
	return createHash('sha256').update(slugs.join('\n')).digest('hex');
}

export function loadCheckpoint(
	file: string,
	slugFingerprint: string,
): CheckpointData | null {
	let stored: StoredCheckpoint;
	try {
		const raw = readFileSync(file, 'utf-8');
		stored = JSON.parse(raw) as StoredCheckpoint;
	} catch (err: unknown) {
		if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
			log.warn('corrupt checkpoint file — discarding, starting fresh');
		}
		return null;
	}

	if (stored.slugFingerprint !== slugFingerprint) {
		log.warn('slug list changed — discarding, starting fresh');
		return null;
	}

	return {
		...stored,
		jobs: stored.jobs.map((j) => ({
			...j,
			publishedAt: j.publishedAt ? new Date(j.publishedAt) : null,
		})),
	};
}

export function saveCheckpoint(file: string, data: CheckpointData): void {
	mkdirSync(dirname(file), { recursive: true });
	const tmp = `${file}.tmp`;
	writeFileSync(tmp, JSON.stringify(data));
	renameSync(tmp, file);
	log.debug('checkpoint saved', { file, resumeFromIndex: data.resumeFromIndex });
}

export function clearCheckpoint(file: string): void {
	try {
		rmSync(file);
		log.debug('checkpoint cleared', { file });
	} catch {
		// already gone
	}
}
