# Brisa Lázaro — QA Portfolio

A static portfolio site for a Junior QA Engineer. No build step, no dependencies — just HTML, CSS, and vanilla JS.

**Live site:** [gerardramonp.github.io/job-agent](https://gerardramonp.github.io/job-agent/)

## What's included

- **`index.html`** — Portfolio landing page (hero, about, skills, experience, portfolio with bugs found, contact)
- **`cv.html`** — Printable CV with PDF download via browser print
- **`cv-content.md`** — Source-of-truth reference for CV text
- **`robots.txt`** / **`sitemap.xml`** — SEO files for search engines

## Preview locally

```bash
python3 -m http.server 8080
# or: npx serve .
```

Then visit `http://localhost:8080`.

## Deploy to GitHub Pages

1. Push this repo to GitHub (`main` branch).
2. Go to **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
4. Choose branch **`main`**, folder **`/ (root)`**, then **Save**.
5. After a minute or two, the site is live at `https://<username>.github.io/job-agent/`.

The `.nojekyll` file ensures GitHub Pages serves all files as-is (no Jekyll processing).

### Custom domain (optional)

Add a `CNAME` file with your domain, then configure DNS at your registrar. Update `sitemap.xml` and the canonical/OG URLs in `index.html` to match.

## Update content

### Portfolio projects

Open `index.html`, find the **Portfolio** section, and copy the HTML comment template at the bottom of the grid. Fill in project name, role, stack, summary, link, and bug entries. Severity classes: `severity--critical`, `severity--high`, `severity--medium`, `severity--low`.

### CV

Edit `cv.html` directly, or update `cv-content.md` as reference and sync changes into `cv.html`.

### Contact details

Search for `brisa.lazaroc@gmail.com` in `index.html` and `cv.html` to update email, phone, and LinkedIn links.

## Download CV as PDF

Open `cv.html`, click **Download PDF**, then in the print dialog:

1. Turn off **Headers and footers**
2. Choose **Save as PDF**

## QA easter eggs

- **Before/After QA toggle** in the hero — switches between a "buggy" and polished hero
- **Console message** — open DevTools to see a QA-themed greeting
- **Report a bug** button in the footer — opens a pre-filled bug report email

## OG image (optional)

Add an `og-image.png` (1200×630px recommended) to the repo root for social media previews. The meta tags already reference it.
