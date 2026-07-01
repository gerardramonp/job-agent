# Job Apply Agent — Reference

Detailed selectors, field mapping, and platform-specific notes for [SKILL.md](SKILL.md).

## LinkedIn search mode

**Use classic search only — never the AI job search.** LinkedIn may surface a conversational "AI-powered" job search. Do not use it. Always drive the classic results page at `/jobs/search/` by typing a job title and selecting a location, then applying filters.

Classic search via UI:
1. Go to `https://www.linkedin.com/jobs/`.
2. Type the role into the "Search by title, skill, or company" field.
3. Type the location into the "City, state, or zip code" field — prefer `Barcelona, Catalonia, Spain` (fallback `Spain`) — and pick the matching dropdown suggestion.
4. Click **Search**, then set filters (Easy Apply, Date posted = Past week, Sort = Most recent).

Equivalent classic results URL (loads the classic list, not AI mode):

```
https://www.linkedin.com/jobs/search/?keywords={role}&location=Barcelona, Catalonia, Spain&f_AL=true&f_TPR=r604800&sortBy=DD
```

## LinkedIn search URL parameters

| Param | Value | Meaning |
|-------|-------|---------|
| `keywords` | Role from `preferences.roles.include` | Job title search |
| `location` | `Barcelona, Catalonia, Spain` (fallback `Spain`) | Location filter |
| `f_AL` | `true` | Easy Apply only (Phase 1) |
| `f_TPR` | `r604800` | Posted in last 7 days |
| `sortBy` | `DD` | Most recent first |

Phase 2 (external): same classic URL without `f_AL=true`, or browse "Apply on company website" results from Phase 1 search.

## LinkedIn UI selectors

Use snapshot refs first. Fallback text/role hints:

| Element | English | Spanish |
|---------|---------|---------|
| Easy Apply button | `Easy Apply` | `Solicitud sencilla` |
| Submit application | `Submit application` | `Enviar solicitud` |
| Next step | `Next` | `Siguiente` |
| Review | `Review` | `Revisar` |
| Show description | `Show more` | `Ver más` |
| Application sent | `Application sent` | `Solicitud enviada` |
| Apply (external) | `Apply` | `Solicitar` |

Modal container: look for dialog with role `dialog` or class containing `jobs-easy-apply`.

## Easy Apply step-by-step

```
1. Job page → click Easy Apply
2. Snapshot modal
3. WHILE modal open:
     a. Fill visible inputs (contact, resume, questions)
     b. Upload CV if file input visible
     c. Snapshot → if "Submit"/"Enviar" → click Submit → BREAK
     d. Else if "Next"/"Siguiente" → click Next
     e. Else if "Review"/"Revisar" → click Review
     f. Else → snapshot again; if stuck 3 times → log error, close modal
4. Verify success message
5. Close/dismiss any post-submit dialog
```

Wait 1–2 s after each modal step (`browser_wait_for` time: 2000).

## Field mapping

Build answers from `cv.json` + `answers.yaml`. Match field labels (case-insensitive, partial match).

### Standard fields

| Label patterns | Value source |
|----------------|--------------|
| first name, nombre | First word of `cv.name` |
| last name, apellido | Rest of `cv.name` |
| full name, nombre completo | `cv.name` |
| email, correo | `cv.contact.email` |
| phone, teléfono, mobile | `cv.contact.phone` |
| city, ciudad, location | `cv.contact.city` (Barcelona) |
| linkedin | `cv.contact.linkedin` |
| years of experience, años de experiencia | `cv.yearsOfExperience` (2) |
| notice period, preaviso | `answers.availability.noticePeriod` (15 days) |
| earliest start, fecha de inicio | `answers.availability.earliestStartDate` or "ASAP" |
| salary, salario, compensation | `26000 EUR gross/year` |
| cover letter, carta, message, mensaje | `answers.coverLetter.shortPitch` |
| driving license, carnet | `answers.extras.drivingLicense` (B) |

### Yes/No questions

| Question pattern | Answer |
|------------------|--------|
| authorized to work in Spain / legalmente autorizado | Yes |
| require visa sponsorship / necesita patrocinio | No |
| willing to relocate / dispuesto a trasladarse | No |
| have you worked at [company] before | No (unless in CV) |
| do you have [skill from mustHave] | Yes if skill in `cv.json` skills |
| are you fluent in Spanish | Yes |
| are you fluent in English | Yes (Intermediate B1 — honest if level asked) |

### Open-text questions

Write 2–4 sentences using ONLY facts from:
- `cv.json` (experience, skills, projects, summary)
- `answers.yaml` (cover letter pitch, availability, compensation note)
- `preferences.yaml` (role fit)

Tone: formal (`answers.coverLetter.tone`).

Example patterns:
- "Why are you interested?" → QA transition story from summary + Bikup testing experience
- "Describe your testing experience" → Manual, exploratory, API testing, Cypress, Postman from skills
- "Tell us about a bug you found" → Reference Bikup defect validation or Neulygron community project

**Never invent**: years beyond CV, tools not listed, certifications, languages beyond stated levels.

### Unmapped required fields

If a required field cannot be mapped and is not answerable from CV:
1. Do NOT guess or fabricate.
2. Close modal (Escape or Dismiss).
3. Log CSV: `status=skipped`, `notes=unmapped-question: {field label}`.

## CV upload

Absolute path:

```
/Users/gerard/Documents/projects/qa-landing/cv-brisa.pdf
```

Use `browser_file_upload` when a file input appears in the Easy Apply modal. If upload fails after 2 attempts, log `skipped: cv-upload-failed`.

## Scoring reference

Hard filter failures → skip (do not score).

Score calculation (same logic as [job-agent/src/match/rules.ts](../../../job-agent/src/match/rules.ts)):

```
base = 0
if title matches included role: base += 30
mustHaveHits = count keywords from preferences.keywords.mustHave found in haystack
base += min(mustHaveHits * 10, 40)
niceToHaveHits = count from preferences.keywords.niceToHave
base += min(niceToHaveHits * 10, 20)
if remote or hybrid detected: base += 10
if full-time + permanent signals: base += 10
if excluded title keyword: base -= 20
if onsite-only and user wants remote/hybrid: base -= 15
score = clamp(base, 0, 100)
```

`haystack` = title + company + location + description combined.

Threshold: apply only if `score >= 75`.

## Phase 2: External applications

Triggered after Phase 1 completes or daily limit hit on Easy Apply jobs.

1. From search results without `f_AL`, or from saved high-score non-Easy-Apply jobs.
2. Click Apply → may open new tab or redirect to company ATS (Greenhouse, Lever, Workday, etc.).
3. Common ATS patterns:
   - **Greenhouse/Lever**: name, email, phone, resume upload, short answer fields
   - **Workday**: multi-page wizard — attempt first 2 pages; if account creation required → `external-manual`
4. Fill using same field mapping.
5. Submit if confident all required fields are filled correctly.
6. Otherwise log `external-manual` with the external URL.

## Error handling

| Situation | Action |
|-----------|--------|
| CAPTCHA / "Let's confirm you're human" | Stop run, tell user |
| "Application limit reached" on LinkedIn | Stop run for today |
| Modal won't advance after 3 attempts | Log `error`, skip job |
| Network timeout | Retry navigate once, then skip |
| Duplicate URL in CSV | Skip silently |
| Already applied on LinkedIn (badge shown) | Log `skipped: already-applied`, add to CSV |

## Future platforms

Structure for adding portals (not implemented yet):

```
platforms/
  linkedin.md   ← this file
  infojobs.md   ← future
  indeed.md     ← future
```

Each platform doc should define: search URL, auth check, apply flow, field mapping overrides.
