import type { AppConfig } from "../config/schemas.js";

export type FieldMapping = {
  label: string;
  value: string;
};

export function buildCommonFieldMappings(config: AppConfig): FieldMapping[] {
  const { cv, answers } = config;

  const salaryText =
    answers.compensation.note ||
    (answers.compensation.desiredEurGross
      ? `${answers.compensation.desiredEurGross} EUR gross/year`
      : "Negotiable");

  return [
    { label: "first name", value: cv.name.split(" ")[0] ?? cv.name },
    {
      label: "last name",
      value: cv.name.split(" ").slice(1).join(" ") || cv.name,
    },
    { label: "full name", value: cv.name },
    { label: "email", value: cv.contact.email },
    { label: "phone", value: cv.contact.phone },
    { label: "mobile phone", value: cv.contact.phone },
    { label: "city", value: cv.contact.city },
    { label: "location", value: cv.contact.city || cv.contact.country },
    { label: "linkedin", value: cv.contact.linkedin },
    { label: "website", value: cv.contact.portfolio || cv.contact.linkedin },
    { label: "github", value: cv.contact.github },
    {
      label: "years of experience",
      value: String(cv.yearsOfExperience),
    },
    { label: "notice period", value: answers.availability.noticePeriod },
    {
      label: "earliest start date",
      value: answers.availability.earliestStartDate,
    },
    { label: "salary", value: salaryText },
    { label: "salary expectations", value: salaryText },
    {
      label: "authorized to work",
      value: answers.workEligibility.authorizedToWorkInSpain ? "Yes" : "No",
    },
    {
      label: "visa sponsorship",
      value: answers.workEligibility.needsVisaSponsorship ? "Yes" : "No",
    },
    { label: "cover letter", value: answers.coverLetter.shortPitch },
    { label: "message", value: answers.coverLetter.shortPitch },
    { label: "driving license", value: answers.extras.drivingLicense },
  ].filter((field) => field.value.trim().length > 0);
}

export function guessFieldValue(
  label: string,
  mappings: FieldMapping[],
): string | undefined {
  const normalized = label.toLowerCase();
  const exact = mappings.find((field) => field.label === normalized);
  if (exact) return exact.value;

  const partial = mappings.find(
    (field) =>
      normalized.includes(field.label) || field.label.includes(normalized),
  );
  return partial?.value;
}
