---
name: job-apply-agent
description: >-
  Autonomously search and apply to QA jobs on LinkedIn (first) and InfoJobs (second),
  matching the user's CV and preferences, using Playwright MCP. Logs all applications
  to a CSV table. Use when the user asks to apply to jobs, run the job agent,
  search LinkedIn or InfoJobs, auto-apply, or track job applications with Playwright MCP.
---

# Job Apply Agent (Playwright MCP)

Multi-platform QA job search and application workflow. **LinkedIn first** (Barcelona and nearby areas), **InfoJobs second**. Runs end-to-end without user interaction after the first login on each platform.

## Prerequisites

1. **Playwright MCP** must be configured in `~/.cursor/mcp.json` (see project setup).
2. **First run only**: user logs into LinkedIn manually in the browser opened by Playwright MCP. Session persists in `.browser-profile/`.
3. Read profile files before every run:
   - [job-agent/profile/cv.json](../../../job-agent/profile/cv.json)
   - [job-agent/profile/preferences.yaml](../../../job-agent/profile/preferences.yaml)
   - [job-agent/profile/answers.yaml](../../../job-agent/profile/answers.yaml)
4. CV PDF for uploads: [cv-brisa.pdf](../../../cv-brisa.pdf) (project root)

## Playwright MCP tools

Always read the Playwright MCP tool schema before calling. Core tools:

| Tool | Use for |
|------|---------|
| `browser_navigate` | Open URLs |
| `browser_snapshot` | Read page state (always snapshot before acting) |
| `browser_click` | Click buttons/links by ref from snapshot |
| `browser_type` | Type into focused fields |
| `browser_fill_form` | Fill multiple fields at once |
| `browser_select_option` | Dropdowns |
| `browser_check` / `browser_uncheck` | Checkboxes/radios |
| `browser_file_upload` | Upload CV PDF |
| `browser_wait_for` | Wait for text or time between steps |
| `browser_press_key` | Tab, Enter, Escape |

After every navigation or click, take a `browser_snapshot` before the next action.

## Run checklist

Copy and track progress:

```
- [ ] Load profile files (cv.json, preferences.yaml, answers.yaml)
- [ ] Load applications.csv and count today's applied rows (all sources)
- [ ] Phase 0: Verify LinkedIn login
- [ ] Phase 1: LinkedIn — Barcelona & nearby (Easy Apply + external)
- [ ] Phase 0b: Verify InfoJobs login (only after Phase 1 complete)
- [ ] Phase 2: InfoJobs — Barcelona province
- [ ] Print session summary
```

## Platform order (mandatory)

1. **Phase 1 — LinkedIn**: exhaust QA opportunities in Barcelona and nearby areas before opening InfoJobs.
2. **Phase 2 — InfoJobs**: only start when Phase 1 completion criteria are met (below).

Do not alternate platforms mid-run.

## Daily limits and idempotency

- **Max applications per day**: `preferences.application.maxPerDay` (currently 15). **Shared across LinkedIn and InfoJobs.** Stop when reached.
- **Before applying**, read [applications.csv](applications.csv). Skip any job whose `url` already appears (any source).
- Append one CSV row per job processed (applied, skipped, external-manual, or error).

## Phase 0: Authentication

### LinkedIn (start of every run)

1. `browser_navigate` → `https://www.linkedin.com/feed/`
2. `browser_snapshot` → check for logged-in indicators (nav with "Me", messaging icon, feed posts).
3. If login page appears: tell the user to log in once in the browser window, wait for confirmation, then continue. Do not store credentials.

### InfoJobs (after Phase 1 complete)

1. `browser_navigate` → `https://www.infojobs.net/`
2. Dismiss cookie consent (**Agree and close**) if shown.
3. `browser_snapshot` → logged in if user menu / "Mis candidaturas" visible; not logged in if **ACCESO CANDIDATOS** is prominent.
4. If not logged in: open `https://www.infojobs.net/candidate/candidate-login/candidate-login.xhtml`, ask user to log in once, wait, then continue.

## Phase 1: LinkedIn (Barcelona & nearby)

For each role in `preferences.roles.include` (e.g. "QA Engineer", "QA Analyst", "QA Tester"):

### 1. Search (classic mode — NOT AI search)

**Important:** Use LinkedIn's classic keyword + location search. Do NOT use LinkedIn's AI job search mode (the conversational "AI-powered" job search experience). Always drive the classic results page (`/jobs/search/`) by typing the job title and selecting a location from the dropdown, then applying filters.

**Critical — location must use `geoId`, not text.** Navigating directly to a URL with `location=Barcelona, Catalonia, Spain` returns unrelated developer jobs. LinkedIn only scopes results correctly when the location is resolved via the autocomplete dropdown (which sets `geoId`). Always use the UI flow below, or copy the `geoId` from the resulting URL after a manual search.

Steps (UI-driven — required):

1. `browser_navigate` → `https://www.linkedin.com/jobs/` (classic Jobs home).
2. `browser_snapshot`. If an AI search box / AI assistant is presented, ignore it and use the classic top search bar with the two separate fields ("Search by title, skill, or company" + "City, state, or zip code"). Never type natural-language queries into an AI search box.
3. Click the **title** field, `browser_type` the role (e.g. `QA Tester`) with `slowly: true`.
4. Click the **location** field, clear it, `browser_type` `Barcelona, Catalonia, Spain` with `slowly: true`. **Must** pick the first matching dropdown suggestion ("Barcelona, Catalonia, Spain") via `browser_click` — do not press Enter without selecting.
5. `browser_snapshot` → confirm the results URL contains `geoId=` (e.g. `geoId=107025191` for Barcelona).
6. Apply filters on the results page using the filter UI:
   - **Easy Apply** toggle → on (`f_AL=true`).
   - **Date posted** → Past week (`f_TPR=r604800`).
   - **Sort** → Most recent (`sortBy=DD`).

After filters are applied, the URL should look like:

```
https://www.linkedin.com/jobs/search/?keywords=QA+Tester&geoId=107025191&f_AL=true&f_TPR=r604800&sortBy=DD
```

**Do NOT** build search URLs with `location=Barcelona, Catalonia, Spain` — that text param does not bind the geo filter and returns noisy results. If you must navigate by URL, use `geoId` from a prior UI search.

- `geoId=107025191` → Barcelona, Catalonia, Spain (from location autocomplete)
- `f_AL=true` → Easy Apply filter
- `f_TPR=r604800` → past week
- Iterate roles until daily limit reached or all roles searched.

### 2. Collect job cards

From search results snapshot, collect for each listing:
- title, company, location, job URL
- whether "Easy Apply" badge is present

Open each promising job in the same tab or navigate to its URL. Expand description ("Show more" / "Ver más") if collapsed.

### 3. Score each job

Apply hard filters first (reject immediately if any fail):

| Rule | Source |
|------|--------|
| Title contains excluded keyword (`Lead`, `Senior`) | `preferences.roles.exclude` |
| Title matches at least one included role | `preferences.roles.include` |
| Location: Spain/Barcelona metro, remote, or Spanish posting | `preferences.location` |
| Work mode in accepted list (Remote, Hybrid) | `preferences.location.workModes` |
| Nearby towns (Granollers, Sant Cugat, Mataró, Badalona, Terrassa, Sabadell) | Accept if Hybrid/Remote and software QA |
| At least 1 `mustHave` keyword in title+description | `preferences.keywords.mustHave` |
| No excluded company keywords | `preferences.company.excludeKeywords` |

Then compute fit score (0–100):

- **+30** title matches included role exactly
- **+10** per mustHave keyword found (max +40)
- **+10** per niceToHave keyword found (max +20)
- **+10** remote or hybrid match
- **+10** full-time permanent contract signals in description
- **−20** per excluded title keyword hit
- **−15** onsite-only when user wants remote/hybrid

Apply only if score ≥ `preferences.application.scoreThreshold` (75) **and** job has Easy Apply.

Log skipped jobs with reason in `notes`.

### 4. Easy Apply workflow

For each qualifying job:

1. Click **Easy Apply** / **Solicitud sencilla**.
2. Loop through modal steps until Submit or Review:
   - **Contact info**: pre-filled from LinkedIn profile — verify, don't overwrite unless empty.
   - **Resume**: upload CV via `browser_file_upload` → absolute path to `cv-brisa.pdf`.
   - **Questions**: fill using [reference.md](reference.md) field mapping and canned answers. For open-text questions, write concise answers grounded in CV facts and preferences — never invent experience, certifications, or skills not in `cv.json`.
   - **Cover letter / message**: use `answers.coverLetter.shortPitch` (formal tone).
   - **Salary**: `23000 EUR gross/year` (from `answers.compensation.desiredEurGross`).
   - **Work authorization**: Yes (authorized in Spain, no visa sponsorship).
   - **Notice period**: `15 days`.
   - **Radio/checkbox**: select Yes/No per mapping in reference.md.
   - If a required question has no mapped answer and cannot be answered from CV/answers: log `skipped: unmapped-question`, close modal, move on.
3. Click **Submit** / **Enviar solicitud** on the final step.
4. Wait for confirmation ("Application sent" / "Solicitud enviada").
5. Append CSV row: `status=applied`.

Between applications, wait 3–8 seconds (use `browser_wait_for`) to avoid rate limits.

### Phase 1b: LinkedIn external applications

After the Easy Apply queue is exhausted, revisit high-scoring jobs (score ≥ 75) that are **not** Easy Apply:

1. Click **Apply** / **Solicitar** → external link opens.
2. Attempt to fill the form using the same field mapping.
3. Upload CV if file input present.
4. If form can be completed: submit and log `status=applied`.
5. If form is too complex (captcha, account creation, multi-page ATS unknown): log `status=external-manual` with URL in notes. Do not guess.

### Phase 1 completion criteria (required before InfoJobs)

Phase 1 is **done** when all of the following are true:

- Every role in `preferences.roles.include` searched with `geoId=107025191` (UI autocomplete flow).
- If past-week filter yields few QA results, repeat searches **without** `f_TPR=r604800`.
- Results pages 1–3 reviewed per role (or until only repeats/skips).
- All qualifying Easy Apply jobs applied or logged as skipped.
- High-score non–Easy Apply jobs attempted (Phase 1b).
- No new qualifying LinkedIn jobs found, **or** daily limit reached.

Only then proceed to Phase 2.

## Phase 2: InfoJobs (Barcelona province)

Full platform details: [platforms/infojobs.md](platforms/infojobs.md)

For each role in `preferences.roles.include`:

1. Search `https://www.infojobs.net/ofertas-trabajo/{keyword}?province=Barcelona`.
2. Paginate results; collect job cards (`a[href*='/of-']`).
3. Score with same rules as LinkedIn.
4. Open detail page → click **Inscribirme en esta oferta**.
5. Fill screening questions (salary **23000**, English B2 → Yes, etc.) using [reference.md](reference.md).
6. Upload `cv-brisa.pdf` if prompted.
7. Confirm inscription; log `source=infojobs`.

Nearby towns in Barcelona province (Sant Cugat, Granollers, Mataró, etc.) are in scope.

## CSV logging

Append to [applications.csv](applications.csv):

```
applied_at,source,title,description,company,location,work_mode,url,score,status,notes
```

- `applied_at`: ISO 8601 datetime (e.g. `2026-06-29T16:30:00+02:00`)
- `source`: `linkedin` | `infojobs`
- `description`: first 200 chars of job description (escape commas with quotes)
- `status`: `applied` | `skipped` | `external-manual` | `error`
- `notes`: skip reason, error detail, or empty

Use proper CSV quoting when fields contain commas.

## Session summary

At end of run, print:

```
Job Apply Agent — Session Summary
==================================
LinkedIn applied:   N
InfoJobs applied:   N
Skipped:            N (with top reasons)
External-manual:    N (manual follow-up needed)
Errors:             N
Daily total:        N / {maxPerDay}
```

List any `external-manual` URLs for manual follow-up.

## Safety rules

- Never invent facts not in `cv.json`, `answers.yaml`, or `preferences.yaml`.
- Never auto-submit if the form shows a preview with blank required fields.
- Stop immediately on CAPTCHA or "unusual activity" — tell user to resolve manually.
- Do not apply to jobs already in `applications.csv`.
- Do not exceed `preferences.application.maxPerDay` applications per calendar day (all platforms combined).
- Complete LinkedIn Phase 1 before starting InfoJobs.

## Additional resources

- LinkedIn selectors, field mapping, and scoring: [reference.md](reference.md)
- InfoJobs search, apply flow, and selectors: [platforms/infojobs.md](platforms/infojobs.md)
