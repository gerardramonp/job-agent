#!/usr/bin/env node
import { Command } from "commander";
import { waitForManualLogin, launchPersistentBrowser } from "./browser/context.js";
import { loadConfig } from "./config/load.js";
import { openRepository } from "./db/repo.js";
import { JobMatcher } from "./match/score.js";
import { runApplyAssist } from "./apply/assist.js";
import { printQueue, writeQueueHtml } from "./queue/export.js";
import { getAllSources, getSource, type SourceName } from "./sources/index.js";

const program = new Command();

program
  .name("job-agent")
  .description("Discover, match, queue, and apply-assist for job postings");

program
  .command("login")
  .description("Open LinkedIn login in persistent browser profile")
  .action(async () => {
    const session = await launchPersistentBrowser(false);
    try {
      await waitForManualLogin(session.page);
      console.log("Login session saved in browser/user-data/");
    } finally {
      await session.close();
    }
  });

program
  .command("discover")
  .description("Discover jobs from configured sources and store in SQLite")
  .option(
    "-s, --source <source>",
    "Source: linkedin | infojobs | tecnoempleo | indeed | all",
    "linkedin",
  )
  .option("-m, --max <number>", "Max jobs per source", "25")
  .option("--search-url <url>", "Override search URL")
  .option("--headless", "Run browser headless", false)
  .action(async (opts: { source: string; max: string; searchUrl?: string; headless: boolean }) => {
    const config = loadConfig();
    const repo = openRepository();
    const maxJobs = Number.parseInt(opts.max, 10);

    const sources =
      opts.source === "all"
        ? getAllSources(config.preferences)
        : [getSource(opts.source as SourceName, config.preferences)];

    let inserted = 0;
    let duplicates = 0;

    for (const source of sources) {
      console.log(`Discovering from ${source.name}...`);
      const jobs = await source.discover({
        maxJobs,
        searchUrl: opts.searchUrl,
        headless: opts.headless,
      });

      for (const job of jobs) {
        const result = repo.insertJob({
          source: job.source,
          externalId: job.externalId,
          url: job.url,
          title: job.title,
          company: job.company,
          location: job.location,
          remote: job.remote,
          description: job.description,
        });
        if (result === "inserted") inserted += 1;
        else duplicates += 1;
      }

      console.log(`  Found ${jobs.length} job(s) from ${source.name}`);
    }

    console.log(`Done. Inserted: ${inserted}, duplicates skipped: ${duplicates}`);
    repo.close();
  });

program
  .command("match")
  .description("Score discovered jobs with rules + Claude and queue matches")
  .action(async () => {
    const config = loadConfig();
    const repo = openRepository();
    const matcher = new JobMatcher();
    const jobs = repo.listDiscoveredUnscored();

    if (jobs.length === 0) {
      console.log("No discovered jobs to score.");
      repo.close();
      return;
    }

    let queued = 0;
    let skipped = 0;

    for (const job of jobs) {
      const result = await matcher.scoreJob(job, config);
      repo.updateScore(job.id, {
        score: result.score,
        scoreReasons: result.reasons,
        redFlags: result.redFlags,
        suggestedAngle: result.suggestedAngle,
        status: result.status,
      });

      if (result.status === "queued") queued += 1;
      if (result.status === "skipped") skipped += 1;

      console.log(
        `#${job.id} [${result.score}] ${job.title} -> ${result.status}`,
      );
    }

    console.log(`Matched ${jobs.length} job(s). Queued: ${queued}, skipped: ${skipped}`);
    repo.close();
  });

program
  .command("queue")
  .description("Print and export the current apply queue")
  .option("-t, --top <number>", "Limit number of jobs", "10")
  .action(async (opts: { top: string }) => {
    const repo = openRepository();
    const limit = Number.parseInt(opts.top, 10);
    const jobs = repo.listQueued(limit);
    printQueue(jobs);
    const htmlPath = writeQueueHtml(jobs);
    console.log(`Queue HTML written to ${htmlPath}`);
    repo.close();
  });

program
  .command("apply")
  .description("Pre-fill applications and pause for manual submit")
  .option("--dry-run", "List queued jobs without opening browser", false)
  .option("-l, --limit <number>", "Max jobs to process this run")
  .option("--headless", "Run browser headless", false)
  .action(async (opts: { dryRun?: boolean; limit?: string; headless?: boolean }) => {
    await runApplyAssist({
      dryRun: opts.dryRun,
      limit: opts.limit ? Number.parseInt(opts.limit, 10) : undefined,
      headless: opts.headless,
    });
  });

program.parseAsync(process.argv).catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
