import type { Page } from "playwright";
import type { JobPreferences } from "../config/schemas.js";
import { launchPersistentBrowser } from "../browser/context.js";
import type { DiscoverOptions, DiscoveredJob, JobSource } from "./types.js";

const DESCRIPTION_SELECTORS = [
  ".jobs-description-content__text",
  ".jobs-description__content",
  ".jobs-box__html-content",
  "#job-details",
  "[data-test-job-search-card-description]",
  ".jobs-search__job-details .jobs-description-content__text",
  "article.jobs-description__container",
  ".jobs-details__main-content",
];

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

async function readFirstMatchingText(
  page: Page,
  selectors: string[],
  timeoutMs = 8000,
): Promise<string | undefined> {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    try {
      if ((await locator.count()) === 0) continue;
      const text = (await locator.innerText({ timeout: timeoutMs })).trim();
      if (text.length > 0) return text;
    } catch {
      // try next selector
    }
  }
  return undefined;
}

async function expandDescriptionIfCollapsed(page: Page): Promise<void> {
  const showMore = page
    .locator(
      'button.jobs-description__footer-button, button:has-text("Show more"), button:has-text("Ver más"), button:has-text("See more"), button:has-text("Show more details")',
    )
    .first();

  try {
    if ((await showMore.count()) === 0) return;
    if (!(await showMore.isVisible())) return;
    await showMore.click({ timeout: 3000 });
    await page.waitForTimeout(600);
  } catch {
    // optional expand
  }
}

async function readRemoteBadge(page: Page): Promise<string | undefined> {
  return readFirstMatchingText(
    page,
    [
      ".job-details-jobs-unified-top-card__tertiary-description-container",
      ".jobs-unified-top-card__workplace-type",
      ".jobs-unified-top-card__job-insight",
    ],
    3000,
  );
}

async function scrapeJobsFromSearchPage(
  page: Page,
  maxJobs: number,
): Promise<DiscoveredJob[]> {
  const jobs: DiscoveredJob[] = [];
  const seen = new Set<string>();

  for (let pageNum = 0; pageNum < 5 && jobs.length < maxJobs; pageNum++) {
    await page.waitForTimeout(1500);

    const cards = page.locator(
      "li.scaffold-layout__list-item, .jobs-search-results__list-item, .job-card-container",
    );
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

      await card.scrollIntoViewIfNeeded().catch(() => {});
      await link.click({ timeout: 10_000 }).catch(async () => {
        await card.click({ timeout: 10_000 }).catch(() => {});
      });
      await page.waitForTimeout(1200);

      await expandDescriptionIfCollapsed(page);

      const title =
        (await readFirstMatchingText(
          page,
          [
            ".job-details-jobs-unified-top-card__job-title",
            ".jobs-unified-top-card__job-title",
            ".job-card-list__title",
            ".artdeco-entity-lockup__title",
          ],
          5000,
        )) ??
        (await link.innerText().catch(() => null)) ??
        "Unknown title";

      const company =
        (await readFirstMatchingText(
          page,
          [
            ".job-details-jobs-unified-top-card__company-name",
            ".jobs-unified-top-card__company-name",
            ".job-card-container__company-name",
            ".artdeco-entity-lockup__subtitle",
          ],
          4000,
        )) ?? undefined;

      const location =
        (await readFirstMatchingText(
          page,
          [
            ".job-details-jobs-unified-top-card__bullet",
            ".jobs-unified-top-card__bullet",
            ".job-card-container__metadata-item",
            ".artdeco-entity-lockup__caption",
          ],
          4000,
        )) ?? undefined;

      const description = await readFirstMatchingText(
        page,
        DESCRIPTION_SELECTORS,
        8000,
      );

      const remoteText = await readRemoteBadge(page);
      const remote =
        remoteText &&
        /remote|remoto|híbrido|hybrid|presencial|on-site/i.test(remoteText)
          ? remoteText
          : undefined;

      seen.add(externalId);
      jobs.push({
        source: "linkedin",
        externalId,
        url,
        title: title.trim(),
        company: company?.trim(),
        location: location?.trim(),
        description,
        remote,
      });
    }

    const nextButton = page.locator(
      'button[aria-label="View next page"], button[aria-label="Ver siguiente página"]',
    );
    if ((await nextButton.count()) === 0 || jobs.length >= maxJobs) break;
    await nextButton.click();
    await page.waitForTimeout(2000);
  }

  return jobs;
}

async function enrichFromJobPage(
  page: Page,
  job: DiscoveredJob,
): Promise<DiscoveredJob> {
  if (job.description && job.description.length > 100) return job;

  await page.goto(job.url, {
    waitUntil: "domcontentloaded",
    timeout: 20_000,
  });
  await page.waitForTimeout(1200);
  await expandDescriptionIfCollapsed(page);

  const description =
    job.description ??
    (await readFirstMatchingText(page, DESCRIPTION_SELECTORS, 10_000));

  const remote =
    job.remote ?? (await readRemoteBadge(page));

  return {
    ...job,
    description,
    remote,
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

      const results = await scrapeJobsFromSearchPage(page, maxJobs);
      const enriched: DiscoveredJob[] = [];

      for (const job of results) {
        const withDetails = await enrichFromJobPage(page, job);
        enriched.push(withDetails);
        await page.waitForTimeout(600 + Math.random() * 600);
      }

      const withDescriptions = enriched.filter((job) => job.description).length;
      console.log(
        `  LinkedIn: ${withDescriptions}/${enriched.length} job(s) with description`,
      );

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
