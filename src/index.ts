import { mkdirSync, writeFileSync } from "fs";
import { config } from "./config";
import type { Job } from "./types";
import { AshbySource } from "./sources/ashby";
import {
  TitleIncludeFilter,
  TitleExcludeFilter,
  MaxAgeFilter,
  LocationFilter,
  EmploymentTypeFilter,
} from "./filter";
import { loadSlugs } from "./slugs/slug-source";
import { SeenStore } from "./seen-store";
import { exec } from "./exec";
import { padded } from "./lib/utils";

const verbose = process.argv.includes("--verbose");
const dryRunFlag = process.argv.indexOf("--dryRun");
const dryRun = dryRunFlag !== -1;
const dryRunCount = (() => {
  if (!dryRun) return 0;
  const next = parseInt(process.argv[dryRunFlag + 1] ?? "", 10);
  return isNaN(next) ? 10 : next;
})();

async function main(): Promise<void> {
  let slugs = loadSlugs();

  if (dryRun) {
    slugs = slugs.slice(0, dryRunCount);
    console.log(`[run] dry run — ${slugs.length} slugs, no files written`);
  } else {
    console.log(`[run] loaded ${slugs.length} slugs`);
  }

  const source = new AshbySource(globalThis.fetch, config.sources.ashby.requestDelayMs);
  const filters = [
    new TitleIncludeFilter(),
    new TitleExcludeFilter(),
    new MaxAgeFilter(),
    new LocationFilter(),
    new EmploymentTypeFilter(),
  ];
  const seenStore = new SeenStore(config.seenStore.file, config.seenStore.ttlDays);

  const result = await exec(source, slugs, filters, seenStore, config, {
    requestDelayMs: config.sources.ashby.requestDelayMs,
  });

  if (!dryRun) {
    mkdirSync("out", { recursive: true });
    writeFileSync("out/matches.json", JSON.stringify(result.matched, null, 2));
    writeFileSync("out/new_matches.json", JSON.stringify(result.newMatches, null, 2));
    seenStore.save(result.newMatches.map((j) => j.id));
  }

  const summary = `${result.slugCount} slugs · ${result.jobCount} jobs fetched · ${result.matched.length} matched · ${result.newMatches.length} new`;
  console.log(`\n[run] ${summary}\n`);

  if (result.newMatches.length > 0) {
    printTable(result.newMatches);
  } else {
    console.log("No new matches.");
  }

  if (verbose && result.dropped.length > 0) {
    console.log(`\nDROPPED (${result.dropped.length})`);
    console.log("─".repeat(80));
    console.log(padded("Title", 35) + padded("Company", 18) + "Reason");
    console.log("─".repeat(80));
    for (const { job, reason } of result.dropped) {
      console.log(padded(job.title, 35) + padded(job.company, 18) + reason);
    }
  }
}

function printTable(jobs: Job[]): void {
  console.log(`NEW MATCHES (${jobs.length})`);
  console.log("─".repeat(144));
  console.log(padded("Title", 96) + padded("Company", 16) + padded("Location", 18) + padded("Age", 6) + "Type");
  console.log("─".repeat(144));
  const now = Date.now();
  for (const job of jobs) {
    const age = job.publishedAt
      ? `${Math.floor((now - job.publishedAt.getTime()) / 86_400_000)}d`
      : "?";
    const loc =
      job.isRemote === true
        ? "Remote"
        : job.isRemote === null
          ? (job.location ?? "?") + " (?)"
          : (job.location ?? "?");
    console.log(
      padded(job.title, 96) +
        padded(job.company, 16) +
        padded(loc, 18) +
        padded(age, 6) +
        (job.employmentType ?? "?")
    );
  }
}

main().catch((err) => {
  console.error("[run] fatal:", err);
  process.exit(1);
});
