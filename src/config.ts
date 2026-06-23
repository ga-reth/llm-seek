export const config = {
  discovery: {
    ashby: {
      crawls: 4,
      requestDelayMs: 1000,
      userAgent: "JobSeek/0.1 (hi@gareth-v.com)",
    },
  },
  sources: {
    ashby: {
      slugsFile: "data/slugs.json",
      manualSlugsFile: "data/slugs.manual.json",
      requestDelayMs: 600,
    },
  },
  filters: {
    titleInclude: ["developer", "engineer"] as string[],
    titleExclude: ["lead", "manager", "principal", "staff"] as string[],
    maxAgeDays: 30,
    matchMode: "word" as "word" | "substring",
    includeIfDateMissing: true,
    remoteOnly: true,
    allowedLocations: [] as string[],
    allowedEmploymentTypes: ["FullTime"] as string[],
  },
  seenStore: {
    file: "data/seen.json",
    ttlDays: 45,
  },
};
