import { mkdirSync, writeFileSync } from "node:fs";
import { DATA_DIR, QUEUE_HTML_PATH } from "../paths.js";
import type { JobRecord } from "../db/repo.js";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function printQueue(jobs: JobRecord[]): void {
  if (jobs.length === 0) {
    console.log("No queued jobs found.");
    return;
  }

  console.log(`\nApply queue (${jobs.length} jobs)\n`);
  for (const job of jobs) {
    console.log(`#${job.id} [${job.score ?? "-"}] ${job.title}`);
    console.log(`   ${job.company ?? "Unknown company"} | ${job.source}`);
    console.log(`   ${job.url}`);
    if (job.suggested_angle) {
      console.log(`   Angle: ${job.suggested_angle}`);
    }
    console.log("");
  }
}

export function writeQueueHtml(jobs: JobRecord[], outputPath = QUEUE_HTML_PATH): string {
  mkdirSync(DATA_DIR, { recursive: true });

  const rows = jobs
    .map(
      (job) => `<tr>
        <td>${job.id}</td>
        <td>${job.score ?? "-"}</td>
        <td>${escapeHtml(job.title)}</td>
        <td>${escapeHtml(job.company ?? "")}</td>
        <td>${escapeHtml(job.source)}</td>
        <td>${escapeHtml(job.location ?? "")}</td>
        <td><a href="${escapeHtml(job.url)}" target="_blank">Open</a></td>
        <td>${escapeHtml(job.suggested_angle ?? "")}</td>
      </tr>`,
    )
    .join("\n");

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Job Apply Queue</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 2rem; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ddd; padding: 0.5rem 0.75rem; text-align: left; vertical-align: top; }
    th { background: #f5f5f5; }
    tr:nth-child(even) { background: #fafafa; }
  </style>
</head>
<body>
  <h1>Job Apply Queue</h1>
  <p>Generated at ${new Date().toISOString()}</p>
  <table>
    <thead>
      <tr>
        <th>ID</th>
        <th>Score</th>
        <th>Title</th>
        <th>Company</th>
        <th>Source</th>
        <th>Location</th>
        <th>Link</th>
        <th>Suggested angle</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>
</body>
</html>`;

  writeFileSync(outputPath, html, "utf8");
  return outputPath;
}
