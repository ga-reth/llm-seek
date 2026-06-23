import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { writeFileSync, rmSync, mkdirSync, existsSync, readFileSync } from "fs";
import { SeenStore } from "../src/seen";

const TEST_FILE = "data/seen-test.json";

function store(): SeenStore {
  return new SeenStore(TEST_FILE, 45);
}

beforeEach(() => {
  mkdirSync("data", { recursive: true });
  if (existsSync(TEST_FILE)) rmSync(TEST_FILE);
});

afterEach(() => {
  if (existsSync(TEST_FILE)) rmSync(TEST_FILE);
});

describe("SeenStore.load", () => {
  it("returns empty set when file does not exist", () => {
    expect(store().load().size).toBe(0);
  });

  it("returns ids from a valid store", () => {
    writeFileSync(TEST_FILE, JSON.stringify({
      entries: [{ id: "abc", seenAt: new Date().toISOString() }],
    }));
    expect(store().load().has("abc")).toBe(true);
  });

  it("prunes entries older than ttlDays", () => {
    const old = new Date(Date.now() - 46 * 86_400_000).toISOString();
    const fresh = new Date().toISOString();
    writeFileSync(TEST_FILE, JSON.stringify({
      entries: [
        { id: "old-id", seenAt: old },
        { id: "fresh-id", seenAt: fresh },
      ],
    }));
    const seen = store().load();
    expect(seen.has("old-id")).toBe(false);
    expect(seen.has("fresh-id")).toBe(true);
  });
});

describe("SeenStore.save", () => {
  it("writes new ids to the store", () => {
    store().save(["job-1", "job-2"]);
    const seen = store().load();
    expect(seen.has("job-1")).toBe(true);
    expect(seen.has("job-2")).toBe(true);
  });

  it("does not duplicate ids already in the store", () => {
    writeFileSync(TEST_FILE, JSON.stringify({
      entries: [{ id: "job-1", seenAt: new Date().toISOString() }],
    }));
    store().save(["job-1", "job-2"]);
    const raw = JSON.parse(readFileSync(TEST_FILE, "utf-8"));
    expect(raw.entries.filter((e: any) => e.id === "job-1").length).toBe(1);
    expect(store().load().has("job-2")).toBe(true);
  });
});

describe("new vs seen split invariant", () => {
  it("new job appears in new matches and is absent from load() initially", () => {
    expect(store().load().has("brand-new")).toBe(false);
    store().save(["brand-new"]);
    expect(store().load().has("brand-new")).toBe(true);
  });

  it("previously-seen job is excluded from new matches", () => {
    store().save(["already-seen"]);
    const seen = store().load();
    const matched = ["already-seen", "fresh-job"];
    const newMatches = matched.filter((id) => !seen.has(id));
    const alreadySeen = matched.filter((id) => seen.has(id));
    expect(newMatches).toEqual(["fresh-job"]);
    expect(alreadySeen).toEqual(["already-seen"]);
  });

  it("seen file is not written if save is never called", () => {
    expect(existsSync(TEST_FILE)).toBe(false);
    try {
      throw new Error("simulated pipeline failure");
      store().save(["job-1"]);
    } catch {
      // swallowed
    }
    expect(existsSync(TEST_FILE)).toBe(false);
  });
});
