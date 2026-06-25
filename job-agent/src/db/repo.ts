import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { DATA_DIR, DB_PATH } from "../paths.js";
import { CREATE_JOBS_TABLE, JobStatus } from "./schema.js";

export type JobRecord = {
  id: number;
  source: string;
  external_id: string;
  url: string;
  title: string;
  company: string | null;
  location: string | null;
  remote: string | null;
  description: string | null;
  score: number | null;
  score_reasons: string | null;
  red_flags: string | null;
  suggested_angle: string | null;
  status: JobStatus;
  discovered_at: string;
  applied_at: string | null;
  notes: string | null;
};

export type NewJobInput = {
  source: string;
  externalId: string;
  url: string;
  title: string;
  company?: string;
  location?: string;
  remote?: string;
  description?: string;
};

export type ScoreUpdate = {
  score: number;
  scoreReasons: string;
  redFlags: string;
  suggestedAngle: string;
  status: JobStatus;
};

export class JobRepository {
  private db: Database.Database;

  constructor(dbPath: string = DB_PATH) {
    mkdirSync(path.dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.exec(CREATE_JOBS_TABLE);
  }

  insertJob(job: NewJobInput): "inserted" | "duplicate" {
    const existing = this.db
      .prepare(
        `SELECT id FROM jobs WHERE source = ? AND external_id = ? OR url = ?`,
      )
      .get(job.source, job.externalId, job.url) as { id: number } | undefined;

    if (existing) return "duplicate";

    const fuzzy = this.db
      .prepare(
        `SELECT id FROM jobs
         WHERE lower(title) = lower(?) AND lower(company) = lower(?)`,
      )
      .get(job.title, job.company ?? "") as { id: number } | undefined;

    if (fuzzy) return "duplicate";

    this.db
      .prepare(
        `INSERT INTO jobs (
          source, external_id, url, title, company, location, remote,
          description, status, discovered_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'discovered', ?)`,
      )
      .run(
        job.source,
        job.externalId,
        job.url,
        job.title,
        job.company ?? null,
        job.location ?? null,
        job.remote ?? null,
        job.description ?? null,
        new Date().toISOString(),
      );

    return "inserted";
  }

  listByStatus(status: JobStatus | JobStatus[]): JobRecord[] {
    const statuses = Array.isArray(status) ? status : [status];
    const placeholders = statuses.map(() => "?").join(", ");
    return this.db
      .prepare(
        `SELECT * FROM jobs WHERE status IN (${placeholders})
         ORDER BY score DESC NULLS LAST, discovered_at DESC`,
      )
      .all(...statuses) as JobRecord[];
  }

  listDiscoveredUnscored(): JobRecord[] {
    return this.db
      .prepare(
        `SELECT * FROM jobs WHERE status = 'discovered' ORDER BY discovered_at DESC`,
      )
      .all() as JobRecord[];
  }

  listQueued(limit?: number): JobRecord[] {
    const sql = `SELECT * FROM jobs WHERE status = 'queued'
      ORDER BY score DESC, discovered_at DESC
      ${limit ? "LIMIT ?" : ""}`;
    return limit
      ? (this.db.prepare(sql).all(limit) as JobRecord[])
      : (this.db.prepare(sql).all() as JobRecord[]);
  }

  countAppliedToday(): number {
    const today = new Date().toISOString().slice(0, 10);
    const row = this.db
      .prepare(
        `SELECT COUNT(*) as count FROM jobs
         WHERE status = 'applied' AND applied_at LIKE ?`,
      )
      .get(`${today}%`) as { count: number };
    return row.count;
  }

  updateScore(id: number, update: ScoreUpdate): void {
    this.db
      .prepare(
        `UPDATE jobs SET
          score = ?, score_reasons = ?, red_flags = ?,
          suggested_angle = ?, status = ?
         WHERE id = ?`,
      )
      .run(
        update.score,
        update.scoreReasons,
        update.redFlags,
        update.suggestedAngle,
        update.status,
        id,
      );
  }

  updateStatus(
    id: number,
    status: JobStatus,
    notes?: string,
    appliedAt?: string,
  ): void {
    this.db
      .prepare(
        `UPDATE jobs SET status = ?, notes = COALESCE(?, notes), applied_at = COALESCE(?, applied_at)
         WHERE id = ?`,
      )
      .run(status, notes ?? null, appliedAt ?? null, id);
  }

  getById(id: number): JobRecord | undefined {
    return this.db.prepare(`SELECT * FROM jobs WHERE id = ?`).get(id) as
      | JobRecord
      | undefined;
  }

  close(): void {
    this.db.close();
  }
}

export function openRepository(): JobRepository {
  mkdirSync(DATA_DIR, { recursive: true });
  return new JobRepository();
}
