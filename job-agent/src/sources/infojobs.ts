import type { JobPreferences } from "../config/schemas.js";
import { launchPersistentBrowser } from "../browser/context.js";
import type { DiscoverOptions, DiscoveredJob, JobSource } from "./types.js";

function buildInfoJobsSearchUrl(preferences: JobPreferences): string {
  const keyword = encodeURIComponent(
    preferences.roles.include[0] ?? "QA Engineer",
  );
  const province = encodeURIComponent(
    preferences.location.cities[0] ?? "Barcelona",
  );
  return `https://www.infojobs.net/ofertas-trabajo/${keyword}?province=${province}`;
}

export class InfoJobsSource implements JobSource {
  readonly name = "infojobs";

  constructor(private readonly preferences: JobPreferences) {}

  async discover(options: DiscoverOptions = {}): Promise<DiscoveredJob[]> {
    const maxJobs = options.maxJobs ?? 25;
    const searchUrl =
      options.searchUrl ?? buildInfoJobsSearchUrl(this.preferences);
    const headless = options.headless ?? false;

    const session = await launchPersistentBrowser(headless);
    const { page } = session;

    try {
      await page.goto(searchUrl, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(2000);

      const cards = page.locator("a[href*='/of-']");
      const count = await cards.count();
      const jobs: DiscoveredJob[] = [];
      const seen = new Set<string>();

      for (let i = 0; i < count && jobs.length < maxJobs; i++) {
        const card = cards.nth(i);
        const href = await card.getAttribute("href");
        if (!href) continue;

        const url = href.startsWith("http")
          ? href.split("?")[0]
          : `https://www.infojobs.net${href.split("?")[0]}`;

        const externalId = url.split("/").pop() ?? url;
        if (seen.has(externalId)) continue;
        seen.add(externalId);

        const title = (await card.innerText().catch(() => null)) ?? "Unknown";
        jobs.push({
          source: "infojobs",
          externalId,
          url,
          title: title.trim().split("\n")[0],
        });
      }

      return jobs;
    } finally {
      await session.close();
    }
  }
}

export function createInfoJobsSource(
  preferences: JobPreferences,
): InfoJobsSource {
  return new InfoJobsSource(preferences);
}
