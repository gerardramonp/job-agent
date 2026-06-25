import type { Page } from "playwright";
import type { JobPreferences } from "../config/schemas.js";
import { launchPersistentBrowser } from "../browser/context.js";
import type { DiscoverOptions, DiscoveredJob, JobSource } from "./types.js";

function buildLinkedInSearchUrl(preferences: JobPreferences): string {
  const keyword = preferences.roles.include[0] ?? "QA Engineer";
  const location = preferences.location.cities[0]
    ? `${preferences.location.cities[0]}, ${preferences.location.countries[0]}`
    : preferences.location.countries[0];

  const params = new URLSearchParams({
    keywords: keyword,
    location,
    f_TPR: "r604800",
    sortBy: "DD",
  });

  return `https://www.linkedin.com/jobs/search/?${params.toString()}`;
}

function extractJobId(url: string): string {
  const match = url.match(/jobs\/view\/(\d+)/);
  return match?.[1] ?? url;
}

async function scrapeSearchResults(
  page: Page,
  maxJobs: number,
): Promise<DiscoveredJob[]> {
  const jobs: DiscoveredJob[] = [];
  const seen = new Set<string>();

  for (let pageNum = 0; pageNum < 5 && jobs.length < maxJobs; pageNum++) {
    await page.waitForTimeout(1500);

    const cards = page.locator(".job-card-container, .jobs-search-results__list-item");
    const count = await cards.count();

    for (let i = 0; i < count && jobs.length < maxJobs; i++) {
      const card = cards.nth(i);
      const link = card.locator("a[href*='/jobs/view/']").first();
      const href = await link.getAttribute("href").catch(() => null);
      if (!href) continue;

      const url = href.startsWith("http")
        ? href.split("?")[0]
        : `https://www.linkedin.com${href.split("?")[0]}`;

      const externalId = extractJobId(url);
      if (seen.has(externalId)) continue;
      seen.add(externalId);

      const title =
        (await card
          .locator(".job-card-list__title, .artdeco-entity-lockup__title")
          .first()
          .innerText()
          .catch(() => null)) ?? "Unknown title";

      const company =
        (await card
          .locator(
            ".job-card-container__company-name, .artdeco-entity-lockup__subtitle",
          )
          .first()
          .innerText()
          .catch(() => null)) ?? undefined;

      const location =
        (await card
          .locator(".job-card-container__metadata-item, .artdeco-entity-lockup__caption")
          .first()
          .innerText()
          .catch(() => null)) ?? undefined;

      jobs.push({
        source: "linkedin",
        externalId,
        url,
        title: title.trim(),
        company: company?.trim(),
        location: location?.trim(),
      });
    }

    const nextButton = page.locator('button[aria-label="View next page"]');
    if ((await nextButton.count()) === 0 || jobs.length >= maxJobs) break;
    await nextButton.click();
    await page.waitForTimeout(2000);
  }

  return jobs;
}

async function readOptionalText(
  page: Page,
  selector: string,
  timeoutMs = 4000,
): Promise<string | undefined> {
  const locator = page.locator(selector).first();
  try {
    if ((await locator.count()) === 0) return undefined;
    return (await locator.innerText({ timeout: timeoutMs })).trim();
  } catch {
    return undefined;
  }
}

async function enrichJobDescription(
  page: Page,
  job: DiscoveredJob,
): Promise<DiscoveredJob> {
  await page.goto(job.url, {
    waitUntil: "domcontentloaded",
    timeout: 20_000,
  });
  await page.waitForTimeout(1000);

  const description = await readOptionalText(
    page,
    ".jobs-description__content, .jobs-box__html-content, #job-details, .jobs-description-content__text",
  );

  const remoteBadge = await readOptionalText(
    page,
    "span:has-text('Remote'), span:has-text('Híbrido'), span:has-text('Hybrid'), span:has-text('En remoto')",
    2000,
  );

  return {
    ...job,
    description,
    remote: remoteBadge,
  };
}

export class LinkedInSource implements JobSource {
  readonly name = "linkedin";

  constructor(private readonly preferences: JobPreferences) {}

  async discover(options: DiscoverOptions = {}): Promise<DiscoveredJob[]> {
    const maxJobs = options.maxJobs ?? 25;
    const searchUrl =
      options.searchUrl ?? buildLinkedInSearchUrl(this.preferences);
    const headless = options.headless ?? false;

    const session = await launchPersistentBrowser(headless);
    const { page } = session;

    try {
      await page.goto(searchUrl, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(2000);

      const results = await scrapeSearchResults(page, maxJobs);
      const enriched: DiscoveredJob[] = [];

      for (const job of results) {
        enriched.push(await enrichJobDescription(page, job));
        await page.waitForTimeout(800 + Math.random() * 700);
      }

      return enriched;
    } finally {
      await session.close();
    }
  }
}

export function createLinkedInSource(
  preferences: JobPreferences,
): LinkedInSource {
  return new LinkedInSource(preferences);
}
