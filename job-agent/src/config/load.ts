import { readFileSync } from "node:fs";
import path from "node:path";
import { config as loadEnv } from "dotenv";
import { parse as parseYaml } from "yaml";
import { PROFILE_DIR, resolveCvPdfPath } from "../paths.js";
import {
  AnswersSchema,
  AppConfig,
  CvSchema,
  PreferencesSchema,
} from "./schemas.js";

loadEnv({ path: path.join(PROFILE_DIR, "..", ".env") });

function readJsonFile<T>(filePath: string): unknown {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function readYamlFile(filePath: string): unknown {
  return parseYaml(readFileSync(filePath, "utf8"));
}

export function loadConfig(): AppConfig {
  const cv = CvSchema.parse(
    readJsonFile(path.join(PROFILE_DIR, "cv.json")),
  );
  const preferences = PreferencesSchema.parse(
    readYamlFile(path.join(PROFILE_DIR, "preferences.yaml")),
  );
  const answers = AnswersSchema.parse(
    readYamlFile(path.join(PROFILE_DIR, "answers.yaml")),
  );

  return {
    cv,
    preferences,
    answers,
    cvPdfPath: resolveCvPdfPath(),
  };
}

export function requireAnthropicApiKey(): string {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error(
      "ANTHROPIC_API_KEY is missing. Copy .env.example to .env and set your key.",
    );
  }
  return key;
}
