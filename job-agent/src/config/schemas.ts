import { z } from "zod";

export const CvSchema = z.object({
  name: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(1),
  contact: z.object({
    email: z.string().email(),
    phone: z.string().min(1),
    city: z.string(),
    region: z.string(),
    country: z.string(),
    linkedin: z.string().url(),
    github: z.string(),
    portfolio: z.string(),
  }),
  yearsOfExperience: z.number().nonnegative(),
  skills: z.object({
    testing: z.array(z.string()),
    tools: z.array(z.string()),
    development: z.array(z.string()),
    ai: z.array(z.string()),
  }),
  experience: z.array(
    z.object({
      role: z.string(),
      company: z.string(),
      startYear: z.string(),
      endYear: z.string(),
      location: z.string(),
      highlights: z.array(z.string()),
      technologies: z.array(z.string()),
    }),
  ),
  education: z.array(
    z.object({
      title: z.string(),
      institution: z.string(),
      year: z.string(),
      notes: z.string(),
    }),
  ),
  languages: z.array(
    z.object({
      language: z.string(),
      level: z.string(),
    }),
  ),
  projects: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      highlights: z.array(z.string()),
    }),
  ),
});

export const PreferencesSchema = z.object({
  roles: z.object({
    include: z.array(z.string()).min(1),
    exclude: z.array(z.string()),
  }),
  location: z.object({
    countries: z.array(z.string()).min(1),
    cities: z.array(z.string()),
    workModes: z.array(z.string()),
    willingToRelocate: z.boolean(),
  }),
  keywords: z.object({
    mustHave: z.array(z.string()),
    niceToHave: z.array(z.string()),
  }),
  company: z.object({
    excludeKeywords: z.array(z.string()),
  }),
  employment: z.object({
    types: z.array(z.string()),
    contracts: z.array(z.string()),
  }),
  application: z.object({
    maxPerDay: z.number().int().positive(),
    languagesRequired: z.array(z.string()),
    scoreThreshold: z.number().int().min(0).max(100),
  }),
});

export const AnswersSchema = z.object({
  workEligibility: z.object({
    authorizedToWorkInSpain: z.boolean(),
    needsVisaSponsorship: z.boolean(),
    statusNote: z.string(),
  }),
  compensation: z.object({
    minEurGross: z.number().nullable(),
    desiredEurGross: z.number().nullable(),
    note: z.string(),
  }),
  availability: z.object({
    noticePeriod: z.string(),
    earliestStartDate: z.string(),
  }),
  coverLetter: z.object({
    tone: z.enum(["concise", "formal", "friendly"]),
    shortPitch: z.string().min(1),
  }),
  extras: z.object({
    drivingLicense: z.string(),
    notes: z.string(),
  }),
});

export type CvProfile = z.infer<typeof CvSchema>;
export type JobPreferences = z.infer<typeof PreferencesSchema>;
export type ApplicationAnswers = z.infer<typeof AnswersSchema>;

export type AppConfig = {
  cv: CvProfile;
  preferences: JobPreferences;
  answers: ApplicationAnswers;
  cvPdfPath: string;
};
