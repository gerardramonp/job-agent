import Anthropic from "@anthropic-ai/sdk";
import { requireAnthropicApiKey } from "../config/load.js";
import type { AppConfig } from "../config/schemas.js";
import type { JobRecord } from "../db/repo.js";

export class AnswerDrafter {
  private client: Anthropic;

  constructor(apiKey?: string) {
    this.client = new Anthropic({ apiKey: apiKey ?? requireAnthropicApiKey() });
  }

  async draftCoverLetter(job: JobRecord, config: AppConfig): Promise<string> {
    const response = await this.client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 800,
      messages: [
        {
          role: "user",
          content: `Write a ${config.answers.coverLetter.tone} cover letter (max 180 words) for this job application.

Use ONLY facts from the candidate profile and canned answers below. Do not invent experience.

CV:
${JSON.stringify(config.cv, null, 2)}

Canned answers:
${JSON.stringify(config.answers, null, 2)}

Default pitch:
${config.answers.coverLetter.shortPitch}

Job:
- ${job.title} at ${job.company ?? "Unknown"}
- ${job.description?.slice(0, 2500) ?? "No description"}

Suggested angle from matcher:
${job.suggested_angle ?? config.answers.coverLetter.shortPitch}`,
        },
      ],
    });

    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return config.answers.coverLetter.shortPitch;
    }
    return textBlock.text.trim();
  }

  async answerQuestion(
    question: string,
    job: JobRecord,
    config: AppConfig,
  ): Promise<string> {
    const response = await this.client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 400,
      messages: [
        {
          role: "user",
          content: `Answer this job application question in 1-3 sentences.
Use ONLY facts from CV and canned answers. Do not invent experience.

Question: ${question}

CV:
${JSON.stringify(config.cv, null, 2)}

Canned answers:
${JSON.stringify(config.answers, null, 2)}

Job: ${job.title} at ${job.company ?? "Unknown"}`,
        },
      ],
    });

    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return config.answers.coverLetter.shortPitch;
    }
    return textBlock.text.trim();
  }
}
