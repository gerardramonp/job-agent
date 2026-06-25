import type { JobPreferences } from "../config/schemas.js";
import { launchPersistentBrowser } from "../browser/context.js";
import type { DiscoverOptions, DiscoveredJob, JobSource } from "./types.js";

function buildTecnoempleoSearchUrl(preferences: JobPreferences): string {
  const keyword = encodeURIComponent(
    preferences.roles.include[0] ?? "QA Engineer",
  );
  return `https://www.tecnoempleo.com/busqueda-empleo.asp?te=${keyword}&cp=08001&la=29`;
}

export class TecnoempleoSource implements JobSource {
  readonly name = "tecnoempleo";

  constructor(private readonly preferences: JobPreferences) {}

  async discover(options: DiscoverOptions = {}): Promise<DiscoveredJob[]> {
    const maxJobs = options.maxJobs ?? 25;
    const searchUrl =
      options.searchUrl ?? buildTecnoempleoSearchUrl(this.preferences);
    const headless = options.headless ?? false;

    const session = await launchPersistentBrowser(headless);
    const { page } = session;

    try {
      await page.goto(searchUrl, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(2000);

      const rows = page.locator("a[href*='ofertas-detalle']");
      const count = await rows.count();
      const jobs: DiscoveredJob[] = [];
      const seen = new Set<string>();

      for (let i = 0; i < count && jobs.length < maxJobs; i++) {
        const row = rows.nth(i);
        const href = await row.getAttribute("href");
        if (!href) continue;

        const url = href.startsWith("http")
          ? href
          : `https://www.tecnoempleo.com${href}`;

        const externalId = url.match(/id=(\d+)/)?.[1] ?? url;
        if (seen.has(externalId)) continue;
        seen.add(externalId);

        const title = (await row.innerText().catch(() => null)) ?? "Unknown";
        jobs.push({
          source: "tecnoempleo",
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

export function createTecnoempleoSource(
  preferences: JobPreferences,
): TecnoempleoSource {
  return new TecnoempleoSource(preferences);
}
