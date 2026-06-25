import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import type { Page } from "playwright";
import { launchPersistentBrowser } from "../browser/context.js";
import { loadConfig } from "../config/load.js";
import type { AppConfig } from "../config/schemas.js";
import { openRepository, type JobRecord } from "../db/repo.js";
import { AnswerDrafter } from "../llm/anthropic.js";
import { randomDelay } from "../utils/sleep.js";
import {
  buildCommonFieldMappings,
  guessFieldValue,
} from "./fields.js";

export type ApplyAssistOptions = {
  dryRun?: boolean;
  limit?: number;
  headless?: boolean;
};

async function clickEasyApplyIfPresent(page: Page): Promise<boolean> {
  const selectors = [
    'button:has-text("Easy Apply")',
    'button:has-text("Solicitud sencilla")',
    'button:has-text("Solicitar")',
    "button.jobs-apply-button",
  ];

  for (const selector of selectors) {
    const button = page.locator(selector).first();
    if ((await button.count()) > 0) {
      await button.click();
      await page.waitForTimeout(1500);
      return true;
    }
  }
  return false;
}

async function fillVisibleInputs(
  page: Page,
  config: AppConfig,
  drafter: AnswerDrafter,
  job: JobRecord,
): Promise<number> {
  const mappings = buildCommonFieldMappings(config);
  let filled = 0;

  const inputs = page.locator(
    "input:not([type='hidden']):not([type='file']), textarea, select",
  );
  const count = await inputs.count();

  for (let i = 0; i < count; i++) {
    const inputEl = inputs.nth(i);
    if (!(await inputEl.isVisible().catch(() => false))) continue;

    const type = (await inputEl.getAttribute("type")) ?? "text";
    if (type === "checkbox" || type === "radio" || type === "file") continue;

    const ariaLabel = (await inputEl.getAttribute("aria-label")) ?? "";
    const name = (await inputEl.getAttribute("name")) ?? "";
    const placeholder = (await inputEl.getAttribute("placeholder")) ?? "";
    const id = (await inputEl.getAttribute("id")) ?? "";
    const labelGuess = `${ariaLabel} ${name} ${placeholder} ${id}`.trim();

    let value = guessFieldValue(labelGuess, mappings);
    if (!value && (type === "textarea" || labelGuess.length > 0)) {
      value = await drafter.answerQuestion(
        labelGuess || "Application question",
        job,
        config,
      );
    }
    if (!value) continue;

    await inputEl.fill(value);
    filled += 1;
  }

  return filled;
}

async function uploadCvIfPossible(
  page: Page,
  cvPdfPath: string,
): Promise<boolean> {
  const fileInput = page.locator("input[type='file']").first();
  if ((await fileInput.count()) === 0) return false;
  await fileInput.setInputFiles(cvPdfPath);
  return true;
}

async function waitForHumanConfirmation(
  job: JobRecord,
  coverLetter: string,
): Promise<"applied" | "skipped" | "expired"> {
  const rl = createInterface({ input, output });
  console.log("\n--- Review before submit ---");
  console.log(`Job #${job.id}: ${job.title} @ ${job.company ?? "Unknown"}`);
  console.log(`URL: ${job.url}`);
  console.log("\nDraft cover letter / pitch:\n");
  console.log(coverLetter);
  console.log("\nInstructions:");
  console.log("1. Review the browser form");
  console.log("2. Solve CAPTCHA if shown");
  console.log("3. Click Submit manually in the browser");
  console.log("4. Then answer here: [y] applied / [n] skip / [e] expired\n");

  const answer = (await rl.question("Result? ")).trim().toLowerCase();
  rl.close();

  if (answer === "y" || answer === "yes") return "applied";
  if (answer === "e" || answer === "expired") return "expired";
  return "skipped";
}

export async function runApplyAssist(
  options: ApplyAssistOptions = {},
): Promise<void> {
  const config = loadConfig();
  const repo = openRepository();

  const maxPerDay = config.preferences.application.maxPerDay;
  const alreadyApplied = repo.countAppliedToday();
  const remaining = Math.max(0, maxPerDay - alreadyApplied);

  if (remaining === 0) {
    console.log(`Daily limit reached (${maxPerDay} applications).`);
    repo.close();
    return;
  }

  const limit = Math.min(options.limit ?? remaining, remaining);
  const jobs = repo.listQueued(limit);

  if (jobs.length === 0) {
    console.log("No queued jobs to apply to.");
    repo.close();
    return;
  }

  if (options.dryRun) {
    console.log(`Dry run: would prepare ${jobs.length} application(s).`);
    for (const job of jobs) {
      console.log(`- #${job.id} ${job.title} (${job.url})`);
    }
    repo.close();
    return;
  }

  const drafter = new AnswerDrafter();

  const session = await launchPersistentBrowser(options.headless ?? false);
  const { page } = session;

  try {
    for (const job of jobs) {
      console.log(`\nOpening job #${job.id}: ${job.title}`);
      await page.goto(job.url, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1500);

      const easyApplyClicked = await clickEasyApplyIfPresent(page);
      if (!easyApplyClicked) {
        console.log(
          "No Easy Apply button detected. Pre-filling visible fields only.",
        );
      }

      const filledCount = await fillVisibleInputs(page, config, drafter, job);
      const uploaded = await uploadCvIfPossible(page, config.cvPdfPath);
      const coverLetter = await drafter.draftCoverLetter(job, config);

      repo.updateStatus(job.id, "prefilled");
      console.log(
        `Pre-filled ${filledCount} field(s). CV uploaded: ${uploaded ? "yes" : "no"}`,
      );

      const result = await waitForHumanConfirmation(job, coverLetter);

      if (result === "applied") {
        repo.updateStatus(
          job.id,
          "applied",
          undefined,
          new Date().toISOString(),
        );
      } else if (result === "expired") {
        repo.updateStatus(
          job.id,
          "expired",
          "Job posting expired during apply",
        );
      } else {
        repo.updateStatus(
          job.id,
          "skipped",
          "Skipped by user during apply-assist",
        );
      }

      await randomDelay(30_000, 90_000);
    }
  } finally {
    await session.close();
    repo.close();
  }
}
