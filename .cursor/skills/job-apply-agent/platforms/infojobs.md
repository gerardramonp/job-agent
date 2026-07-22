# InfoJobs — Platform Reference

InfoJobs is **Phase 2** of the job apply agent. Run it only after LinkedIn Phase 1 is complete (see [SKILL.md](../SKILL.md)).

## Authentication

1. `browser_navigate` → `https://www.infojobs.net/`
2. Dismiss cookie consent if shown: click **Agree and close** / **Aceptar y cerrar**.
3. `browser_snapshot` → check login state:
   - **Logged in**: user menu, "Mis candidaturas", or no "ACCESO CANDIDATOS" prominent link.
   - **Not logged in**: header shows **ACCESO CANDIDATOS**.
4. If not logged in: navigate to `https://www.infojobs.net/candidate/candidate-login/candidate-login.xhtml`, tell the user to log in once in the Playwright browser, wait for confirmation, then continue. Do not store credentials.

Session persists in the same Playwright browser profile as LinkedIn.

## Search (Barcelona & nearby)

Use classic keyword search scoped to **province Barcelona** (covers Barcelona city and nearby towns: Sant Cugat, Granollers, Mataró, Badalona, Terrassa, Sabadell, etc.).

For each role in `preferences.roles.include`:

```
https://www.infojobs.net/ofertas-trabajo/{keyword}?province=Barcelona
```

| Role | Example URL |
|------|-------------|
| QA Engineer | `https://www.infojobs.net/ofertas-trabajo/qa-engineer?province=Barcelona` |
| QA Analyst | `https://www.infojobs.net/ofertas-trabajo/qa-analyst?province=Barcelona` |
| QA Tester | `https://www.infojobs.net/ofertas-trabajo/qa-tester?province=Barcelona` |

Additional keyword variants worth searching:

- `ingeniero-qa`
- `tester-funcional`
- `quality-assurance`
- `ingeniero-calidad-software` (verify description — skip manufacturing QA)

### Search tips

1. After landing on results, confirm the **Barcelona** province filter is active (sidebar checkbox or URL).
2. Paginate through results (`page=2`, `page=3`) until no new qualifying jobs appear.
3. Job cards link to URLs containing `/of-i` or `/of-` followed by an offer ID.
4. Skip offers already in `applications.csv` (match by full URL or offer ID).

## Collect job details

From each listing or detail page, collect:

- title, company, city, work mode (Híbrido / Remoto / Presencial)
- salary range if shown
- full URL (normalize to `https://www.infojobs.net/...` without tracking params)
- full description (expand if collapsed)

## Scoring

Use the **same hard filters and score calculation** as LinkedIn (see [reference.md](../reference.md#scoring-reference)).

Additional InfoJobs-specific skips:

| Situation | Action |
|-----------|--------|
| Title contains `Senior` / `Lead` | Skip |
| `Experiencia mínima: Al menos 4 años` when CV has 2 years | Skip or log `skipped: experience-mismatch` |
| Manufacturing / ISO / food-safety QA (not software) | Skip |
| Presencial only when user wants Remote/Hybrid | Skip |

Accept **Híbrido** and **Remoto** offers in Barcelona province and nearby towns.

## Apply workflow

1. Open job detail page.
2. `browser_snapshot`.
3. Click **Inscribirme en esta oferta** (main CTA, appears twice on page).
4. If redirected to login → stop and ask user to log in.
5. Fill any screening modal/page using the same field mapping as LinkedIn ([reference.md](../reference.md#field-mapping)):
   - Salary → `23000` EUR gross/year
   - English B2+ → Yes
   - Work authorization Spain → Yes
   - Notice period → 15 days
6. Attach CV if file upload appears → `/Users/gerard/Documents/projects/qa-landing/cv-brisa.pdf`
7. Submit / confirm inscription.
8. Verify success (confirmation message, or offer shows "Ya te has inscrito" / inscription badge).
9. Log CSV row with `source=infojobs`.

Between applications, wait 3–8 seconds.

## UI selectors

| Element | Spanish | English fallback |
|---------|---------|------------------|
| Apply button | `Inscribirme en esta oferta` | — |
| Save offer | `Guardar` | — |
| Candidate login | `ACCESO CANDIDATOS` | — |
| Cookie accept | `Aceptar y cerrar` | `Agree and close` |
| Hybrid | `Híbrido` | — |
| Remote | `Remoto` / `Teletrabajo` | — |
| On-site | `Presencial` | — |
| Already applied | `Ya te has inscrito` | — |

Job link pattern: `a[href*='/of-']`

## CSV logging

Same columns as LinkedIn. Set `source=infojobs`.

Example:

```csv
2026-07-15T10:00:00+02:00,infojobs,QA/Tester Funcional,"Functional QA for digital notary platform.",Centro Tecnológico del Notariado,Sant Cugat del Vallès,Hybrid,https://www.infojobs.net/sant-cugat-del-valles/qa-tester-funcional/of-ib2711941a14330a0f12a50549b8998,88,applied,salary: 23000
```

## Error handling

| Situation | Action |
|-----------|--------|
| Cookie dialog blocks UI | Click Agree and close first |
| Login required mid-apply | Ask user to log in, retry |
| CAPTCHA | Stop run, tell user |
| Required question unmapped | `skipped: unmapped-question` |
| Duplicate URL in CSV | Skip silently |
| External redirect (company ATS) | Attempt fill; if complex → `external-manual` |

## Phase 2 completion

InfoJobs Phase 2 is done when:

- All role keywords searched with `province=Barcelona`
- Pages 1–3 scanned per keyword (or until repeats)
- All qualifying offers applied or logged as skipped
- Daily limit (`preferences.application.maxPerDay`) reached
