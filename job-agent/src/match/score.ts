import Anthropic from "@anthropic-ai/sdk";
import type {
  AppConfig,
  CvProfile,
  JobPreferences,
} from "../config/schemas.js";
import { requireAnthropicApiKey } from "../config/load.js";
import type { JobRecord } from "../db/repo.js";
import { getAnthropicModel } from "../llm/model.js";
import { applyRuleFilter } from "./rules.js";

export type FitScoreResult = {
  score: number;
  reasons: string;
  redFlags: string;
  suggestedAngle: string;
  status: "scored" | "queued" | "skipped";
};

function buildScoringPrompt(
  job: JobRecord,
  cv: CvProfile,
  preferences: JobPreferences,
): string {
  return `You are evaluating job fit for a candidate applying to QA roles in Spain.

Candidate CV (JSON):
${JSON.stringify(cv, null, 2)}

Preferences (JSON):
${JSON.stringify(preferences, null, 2)}

Job:
- Title: ${job.title}
- Company: ${job.company ?? "Unknown"}
- Location: ${job.location ?? "Unknown"}
- Remote: ${job.remote ?? "Unknown"}
- Description:
${job.description ?? "No description available"}

Score fit from 0-100 for a Junior QA Engineer transition profile.
Favor frontend background + hands-on QA + AI-assisted testing when relevant.
Do NOT invent candidate experience beyond the CV.
Return JSON only with keys: score, reasons (array), red_flags (array), suggested_angle (string).`;
}

export class JobMatcher {
  private client: Anthropic;

  constructor(apiKey?: string) {
    this.client = new Anthropic({ apiKey: apiKey ?? requireAnthropicApiKey() });
  }

  async scoreJob(
    job: JobRecord,
    config: AppConfig,
  ): Promise<FitScoreResult> {
    const ruleResult = applyRuleFilter(job, config.preferences);
    if (!ruleResult.pass) {
      return {
        score: 0,
        reasons: ruleResult.reason,
        redFlags: ruleResult.reason,
        suggestedAngle: "",
        status: "skipped",
      };
    }

    const response = await this.client.messages.create({
      model: getAnthropicModel(),
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: buildScoringPrompt(job, config.cv, config.preferences),
        },
      ],
    });

    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("Claude returned no text response for scoring");
    }

    const parsed = JSON.parse(extractJson(textBlock.text)) as {
      score: number;
      reasons: string[];
      red_flags: string[];
      suggested_angle: string;
    };

    const score = Math.max(0, Math.min(100, Math.round(parsed.score)));
    const threshold = config.preferences.application.scoreThreshold;

    return {
      score,
      reasons: parsed.reasons.join("; "),
      redFlags: parsed.red_flags.join("; "),
      suggestedAngle: parsed.suggested_angle,
      status: score >= threshold ? "queued" : "scored",
    };
  }
}

function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced?.[1]) return fenced[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) return text.slice(start, end + 1);
  return text.trim();
}

export async function matchDiscoveredJobs(
  config: AppConfig,
  jobs: JobRecord[],
): Promise<{ matched: number; queued: number; skipped: number }> {
  const matcher = new JobMatcher();
  let matched = 0;
  let queued = 0;
  let skipped = 0;

  for (const job of jobs) {
    const result = await matcher.scoreJob(job, config);
    matched += 1;
    if (result.status === "queued") queued += 1;
    if (result.status === "skipped") skipped += 1;
  }

  return { matched, queued, skipped };
}
