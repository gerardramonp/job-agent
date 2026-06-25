export type DiscoveredJob = {
  source: string;
  externalId: string;
  url: string;
  title: string;
  company?: string;
  location?: string;
  remote?: string;
  description?: string;
};

export type DiscoverOptions = {
  maxJobs?: number;
  searchUrl?: string;
  headless?: boolean;
};

export interface JobSource {
  readonly name: string;
  discover(options?: DiscoverOptions): Promise<DiscoveredJob[]>;
}
