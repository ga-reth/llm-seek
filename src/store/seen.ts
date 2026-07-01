import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { createLogger } from '../lib/logger';

const log = createLogger('seen');

const TTL_DAYS = 45;

interface SeenEntry {
	id: string;
	seenAt: string;
}

interface StoredData {
	configFingerprint?: string;
	entries: SeenEntry[];
}

export class SeenStore {
	constructor(
		private readonly file: string,
		private readonly configFingerprint?: string,
	) {}

	load(): Set<string> {
		const cutoff = this.cutoff();
		try {
			const raw = readFileSync(this.file, 'utf-8');
			const data = JSON.parse(raw) as StoredData;
			if (
				this.configFingerprint &&
				data.configFingerprint !== this.configFingerprint
			) {
				log.info('config changed — clearing seen store for fresh run');
				return new Set();
			}
			const live = data.entries.filter((e) => new Date(e.seenAt).getTime() > cutoff);
			const prunedCount = data.entries.length - live.length;
			const result = new Set(live.map((e) => e.id));
			log.info('store loaded', { seenCount: result.size, prunedCount });
			return result;
		} catch {
			return new Set();
		}
	}

	save(newIds: string[]): void {
		const cutoff = this.cutoff();
		const now = new Date().toISOString();

		let existingEntries: SeenEntry[] = [];
		try {
			const raw = readFileSync(this.file, 'utf-8');
			const data = JSON.parse(raw) as StoredData;
			existingEntries = data.entries.filter(
				(e) => new Date(e.seenAt).getTime() > cutoff,
			);
		} catch {
			// file doesn't exist yet — start fresh
		}

		const existingSet = new Set(existingEntries.map((e) => e.id));
		const toAdd = newIds
			.filter((id) => !existingSet.has(id))
			.map((id): SeenEntry => ({ id, seenAt: now }));

		const merged: StoredData = {
			configFingerprint: this.configFingerprint,
			entries: [...existingEntries, ...toAdd],
		};
		mkdirSync(dirname(this.file), { recursive: true });
		writeFileSync(this.file, JSON.stringify(merged, null, 2));
		log.info('store saved', { newCount: toAdd.length, totalCount: merged.entries.length });
	}

	private cutoff(): number {
		return Date.now() - TTL_DAYS * 86_400_000;
	}
}
