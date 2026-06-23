import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { dirname } from "path";

interface SeenEntry {
  id: string;
  seenAt: string;
}

interface StoredData {
  entries: SeenEntry[];
}

export class SeenStore {
  constructor(
    private readonly file: string,
    private readonly ttlDays: number
  ) {}

  load(): Set<string> {
    const cutoff = this.cutoff();
    try {
      const raw = readFileSync(this.file, "utf-8");
      const data = JSON.parse(raw) as StoredData;
      return new Set(
        data.entries
          .filter((e) => new Date(e.seenAt).getTime() > cutoff)
          .map((e) => e.id)
      );
    } catch {
      return new Set();
    }
  }

  save(newIds: string[]): void {
    const cutoff = this.cutoff();
    const now = new Date().toISOString();

    let existingEntries: SeenEntry[] = [];
    try {
      const raw = readFileSync(this.file, "utf-8");
      const data = JSON.parse(raw) as StoredData;
      existingEntries = data.entries.filter(
        (e) => new Date(e.seenAt).getTime() > cutoff
      );
    } catch {
      // file doesn't exist yet — start fresh
    }

    const existingSet = new Set(existingEntries.map((e) => e.id));
    const toAdd = newIds
      .filter((id) => !existingSet.has(id))
      .map((id): SeenEntry => ({ id, seenAt: now }));

    const merged: StoredData = { entries: [...existingEntries, ...toAdd] };
    mkdirSync(dirname(this.file), { recursive: true });
    writeFileSync(this.file, JSON.stringify(merged, null, 2));
  }

  private cutoff(): number {
    return Date.now() - this.ttlDays * 86_400_000;
  }
}
