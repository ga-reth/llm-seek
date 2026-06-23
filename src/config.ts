export const config = {
  discovery: {
    ashby: {
      crawls: 4,
      requestDelayMs: 1000,
      userAgent: "JobSeek/0.1",
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
    titleExclude: ["lead", "manager", "principal", "junior", "intern", "infrastructure", "devops", "advocate", "security", "support"] as string[],
    maxAgeDays: 30,
    matchMode: "word" as "word" | "substring",
    includeIfDateMissing: true,
    remoteOnly: false,
    allowedLocations: [] as string[],
    allowedEmploymentTypes: ["FullTime", "Contract"] as string[],
  },
  seenStore: {
    file: "data/seen.json",
    ttlDays: 45,
  },
};
