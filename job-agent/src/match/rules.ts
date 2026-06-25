import type { JobPreferences } from "../config/schemas.js";
import type { JobRecord } from "../db/repo.js";

export type RuleFilterResult =
  | { pass: true }
  | { pass: false; reason: string };

function includesAny(text: string, terms: string[]): boolean {
  const normalized = text.toLowerCase();
  return terms.some((term) => normalized.includes(term.toLowerCase()));
}

function detectWorkMode(text: string): string | null {
  const normalized = text.toLowerCase();
  if (normalized.includes("remote") || normalized.includes("remoto")) {
    return "remote";
  }
  if (normalized.includes("hybrid") || normalized.includes("híbrido")) {
    return "hybrid";
  }
  if (normalized.includes("on-site") || normalized.includes("presencial")) {
    return "onsite";
  }
  return null;
}

function looksSpanish(text: string): boolean {
  if (!text.trim()) return false;

  const normalized = text.toLowerCase();
  const spanishMarkers = [
    "experiencia",
    "requisitos",
    "incorporación",
    "jornada",
    "contrato",
    "salario",
    "empresa",
    "candidato",
    "conocimientos",
    "imprescindible",
    "deseable",
    "trabajo",
    "equipo",
    "formación",
    "años",
    "buscamos",
    "ofrecemos",
    "perfil",
    "funciones",
    "vacante",
    "puesto",
    "se valorará",
    "remoto",
    "híbrido",
    "presencial",
    "jornada completa",
    "contrato indefinido",
    "quality assurance",
    "pruebas",
    "testing",
  ];

  const markerHits = spanishMarkers.filter((marker) =>
    normalized.includes(marker),
  ).length;
  const hasSpanishChars = /[ñáéíóúü¿¡]/i.test(text);

  return markerHits >= 2 || (markerHits >= 1 && hasSpanishChars);
}

export function applyRuleFilter(
  job: JobRecord,
  preferences: JobPreferences,
): RuleFilterResult {
  const haystack = [
    job.title,
    job.company,
    job.location,
    job.remote,
    job.description,
  ]
    .filter(Boolean)
    .join(" ");

  if (
    preferences.roles.exclude.length > 0 &&
    includesAny(job.title, preferences.roles.exclude)
  ) {
    return { pass: false, reason: "Title matches excluded role keyword" };
  }

  const titleMatch = preferences.roles.include.some((role) =>
    job.title.toLowerCase().includes(role.toLowerCase()),
  );
  if (!titleMatch) {
    return { pass: false, reason: "Title does not match included roles" };
  }

  if (
    preferences.company.excludeKeywords.length > 0 &&
    includesAny(haystack, preferences.company.excludeKeywords)
  ) {
    return { pass: false, reason: "Company/description matches excluded keyword" };
  }

  const locationText = `${job.location ?? ""} ${job.description ?? ""}`;
  const countryMatch = preferences.location.countries.some((country) =>
    locationText.toLowerCase().includes(country.toLowerCase()),
  );
  const cityMatch = preferences.location.cities.some((city) =>
    locationText.toLowerCase().includes(city.toLowerCase()),
  );
  const remoteMatch =
    detectWorkMode(`${job.remote ?? ""} ${locationText}`) === "remote" ||
    locationText.toLowerCase().includes("remote") ||
    locationText.toLowerCase().includes("remoto");
  const spanishMatch = looksSpanish(haystack);

  if (
    !countryMatch &&
    !cityMatch &&
    !remoteMatch &&
    !spanishMatch &&
    !preferences.location.willingToRelocate
  ) {
    return {
      pass: false,
      reason:
        "Location does not match (not Spain/Barcelona, remote, or Spanish posting)",
    };
  }

  const detectedMode = detectWorkMode(`${job.remote ?? ""} ${locationText}`);
  if (
    detectedMode &&
    preferences.location.workModes.length > 0 &&
    !preferences.location.workModes.some(
      (mode) => mode.toLowerCase() === detectedMode,
    )
  ) {
    return { pass: false, reason: `Work mode '${detectedMode}' not accepted` };
  }

  if (preferences.keywords.mustHave.length > 0) {
    const mustHaveMatches = preferences.keywords.mustHave.filter((keyword) =>
      haystack.toLowerCase().includes(keyword.toLowerCase()),
    );
    if (mustHaveMatches.length === 0) {
      return {
        pass: false,
        reason: "No required keywords found in job description",
      };
    }
  }

  return { pass: true };
}
