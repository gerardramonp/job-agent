export const JOB_STATUSES = [
  "discovered",
  "scored",
  "queued",
  "prefilled",
  "applied",
  "rejected",
  "interview",
  "expired",
  "skipped",
] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];

export const CREATE_JOBS_TABLE = `
CREATE TABLE IF NOT EXISTS jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,
  external_id TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  company TEXT,
  location TEXT,
  remote TEXT,
  description TEXT,
  score INTEGER,
  score_reasons TEXT,
  red_flags TEXT,
  suggested_angle TEXT,
  status TEXT NOT NULL DEFAULT 'discovered',
  discovered_at TEXT NOT NULL,
  applied_at TEXT,
  notes TEXT,
  UNIQUE(source, external_id)
);

CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_score ON jobs(score DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_discovered_at ON jobs(discovered_at DESC);
`;
