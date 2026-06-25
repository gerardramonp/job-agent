import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT_DIR = path.resolve(__dirname, "..");
export const PROFILE_DIR = path.join(ROOT_DIR, "profile");
export const DATA_DIR = path.join(ROOT_DIR, "data");
export const BROWSER_DIR = path.join(ROOT_DIR, "browser", "user-data");
export const DB_PATH = path.join(DATA_DIR, "jobs.db");
export const QUEUE_HTML_PATH = path.join(DATA_DIR, "queue.html");

export function resolveCvPdfPath(): string {
  const inProfile = path.join(PROFILE_DIR, "cv-brisa.pdf");
  if (existsSync(inProfile)) return inProfile;
  const inRepoRoot = path.join(ROOT_DIR, "..", "cv-brisa.pdf");
  if (existsSync(inRepoRoot)) return inRepoRoot;
  throw new Error(
    "CV PDF not found. Place cv-brisa.pdf in job-agent/profile/ or repo root.",
  );
}
