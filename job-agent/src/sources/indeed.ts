import type { JobPreferences } from "../config/schemas.js";
import { launchPersistentBrowser } from "../browser/context.js";
import type { DiscoverOptions, DiscoveredJob, JobSource } from "./types.js";

function buildIndeedSearchUrl(preferences: JobPreferences): string {
  const keyword = encodeURIComponent(
    preferences.roles.include.join(" ") || "QA Engineer",
  );
  const location = encodeURIComponent(
    preferences.location.cities[0]
      ? `${preferences.location.cities[0]}, ${preferences.location.countries[0]}`
      : preferences.location.countries[0],
  );
  return `https://es.indeed.com/jobs?q=${keyword}&l=${location}&fromage=7&sort=date`;
}

export class IndeedSource implements JobSource {
  readonly name = "indeed";

  constructor(private readonly preferences: JobPreferences) {}

  async discover(options: DiscoverOptions = {}): Promise<DiscoveredJob[]> {
    const maxJobs = options.maxJobs ?? 25;
    const searchUrl =
      options.searchUrl ?? buildIndeedSearchUrl(this.preferences);
    const headless = options.headless ?? false;

    const session = await launchPersistentBrowser(headless);
    const { page } = session;

    try {
      await page.goto(searchUrl, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(2000);

      const cards = page.locator("a.jcs-JobTitle, a[data-jk]");
      const count = await cards.count();
      const jobs: DiscoveredJob[] = [];
      const seen = new Set<string>();

      for (let i = 0; i < count && jobs.length < maxJobs; i++) {
        const card = cards.nth(i);
        const href = await card.getAttribute("href");
        const dataJk = await card.getAttribute("data-jk");
        if (!href) continue;

        const url = href.startsWith("http")
          ? href.split("?")[0]
          : `https://es.indeed.com${href.split("?")[0]}`;

        const externalId = dataJk ?? url.split("/").pop() ?? url;
        if (seen.has(externalId)) continue;
        seen.add(externalId);

        const title = (await card.innerText().catch(() => null)) ?? "Unknown";
        jobs.push({
          source: "indeed",
          externalId,
          url,
          title: title.trim(),
        });
      }

      return jobs;
    } finally {
      await session.close();
    }
  }
}

export function createIndeedSource(
  preferences: JobPreferences,
): IndeedSource {
  return new IndeedSource(preferences);
}
