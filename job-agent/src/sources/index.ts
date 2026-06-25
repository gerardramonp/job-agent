import type { JobPreferences } from "../config/schemas.js";
import { createIndeedSource } from "./indeed.js";
import { createInfoJobsSource } from "./infojobs.js";
import { createLinkedInSource } from "./linkedin.js";
import { createTecnoempleoSource } from "./tecnoempleo.js";
import type { JobSource } from "./types.js";

export type SourceName = "linkedin" | "infojobs" | "tecnoempleo" | "indeed";

export function getSource(
  name: SourceName,
  preferences: JobPreferences,
): JobSource {
  switch (name) {
    case "linkedin":
      return createLinkedInSource(preferences);
    case "infojobs":
      return createInfoJobsSource(preferences);
    case "tecnoempleo":
      return createTecnoempleoSource(preferences);
    case "indeed":
      return createIndeedSource(preferences);
    default:
      throw new Error(`Unknown source: ${name satisfies never}`);
  }
}

export function getAllSources(preferences: JobPreferences): JobSource[] {
  return [
    createLinkedInSource(preferences),
    createInfoJobsSource(preferences),
    createTecnoempleoSource(preferences),
    createIndeedSource(preferences),
  ];
}

export * from "./types.js";
