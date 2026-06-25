# Job Apply Agent

Human-in-the-loop job application assistant for Spain-focused job boards.

## Setup

```bash
cd job-agent
npm install
npx playwright install chromium
cp .env.example .env
# Add ANTHROPIC_API_KEY to .env
npm run login
```

Fill in profile files under `profile/`:

- `cv.json`
- `preferences.yaml`
- `answers.yaml`

Place `cv-brisa.pdf` in `profile/` or repo root for uploads during apply-assist.

## Commands

```bash
npm run discover -- --source linkedin   # or infojobs | tecnoempleo | indeed | all
npm run match
npm run queue -- --top 10
npm run apply
```

## Workflow

1. `discover` scrapes job listings into `data/jobs.db`
2. `match` applies hard rules + Claude scoring and queues strong fits
3. `queue` prints links and writes `data/queue.html`
4. `apply` opens each queued job, pre-fills fields, uploads CV, and waits for you to submit manually

## Safety

- Uses persistent browser profile (`browser/user-data/`) — log in once with `npm run login`
- Never auto-submits applications
- Respects `application.maxPerDay` from preferences
- Secrets stay in `.env` (gitignored)
