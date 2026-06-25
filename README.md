# Brisa Lázaro — Online CV

A minimal, single-file online CV with PDF download. No build step, no dependencies.

## Preview locally

Open `index.html` in your browser, or run a simple local server:

```bash
# Python
python3 -m http.server 8080

# Node (if you have npx)
npx serve .
```

Then visit `http://localhost:8080`.

## Download as PDF

Click **Download PDF**, then in the print dialog:

1. Turn off **Headers and footers** (under More settings in Chrome)
2. Choose **Save as PDF** as the destination

This uses your browser's print engine, so the PDF matches what you see on screen exactly.

## Edit content

All content lives in `index.html`. Search for the section you want to change (header, skills, experience, etc.) and edit the HTML directly.

Contact details are at the top of the file — replace the placeholder email, LinkedIn, and GitHub links.

For longer-form reference, see `cv-content.md`.

## Deploy

Upload the project folder to any static host:

- **GitHub Pages** — push to a repo, enable Pages from the `main` branch (root).
- **Netlify / Vercel** — drag-and-drop the folder or connect the repo; no build command needed.
- **Any web server** — copy `index.html` to your public directory.

That's it. One file to maintain, one file to deploy.
