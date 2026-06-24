import { createHash } from 'node:crypto';
import {
	mkdirSync,
	readFileSync,
	renameSync,
	rmSync,
	writeFileSync,
} from 'node:fs';
import { dirname } from 'node:path';
import type { Job } from './types';

export interface CheckpointData {
	slugFingerprint: string;
	filterFingerprint: string;
	resumeFromIndex: number;
	jobCount: number;
	matched: Job[];
}

interface StoredJob extends Omit<Job, 'publishedAt'> {
	publishedAt: string | null;
}

interface StoredCheckpoint {
	slugFingerprint: string;
	filterFingerprint: string;
	resumeFromIndex: number;
	jobCount: number;
	matched: StoredJob[];
}

export function computeSlugFingerprint(slugs: string[]): string {
	return createHash('sha256').update(slugs.join('\n')).digest('hex');
}

export function loadCheckpoint(
	file: string,
	slugFingerprint: string,
	filterFingerprint: string,
): CheckpointData | null {
	let stored: StoredCheckpoint;
	try {
		const raw = readFileSync(file, 'utf-8');
		stored = JSON.parse(raw) as StoredCheckpoint;
	} catch (err: unknown) {
		if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
			console.warn(
				'[checkpoint] corrupt checkpoint file — discarding, starting fresh',
			);
		}
		return null;
	}

	if (stored.slugFingerprint !== slugFingerprint) {
		console.warn('[checkpoint] slug list changed — discarding, starting fresh');
		return null;
	}
	if (stored.filterFingerprint !== filterFingerprint) {
		console.warn(
			'[checkpoint] filter config changed — discarding, starting fresh',
		);
		return null;
	}

	return {
		...stored,
		matched: stored.matched.map((j) => ({
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
}

export function clearCheckpoint(file: string): void {
	try {
		rmSync(file);
	} catch {
		// already gone
	}
}
