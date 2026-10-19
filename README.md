# AV-EAI Survey Website

Companion website for **Seeing, Hearing, and Acting: A Survey of Audio-Visual Collaboration for Embodied Intelligence**.

The site is deliberately buildless: GitHub Pages can serve the repository root directly, and the literature explorer is generated from the manuscript source rather than maintained by hand.

## Local preview

Serve the repository over HTTP (opening `index.html` directly will prevent browsers from loading the JSON data):

```bash
python -m http.server 4173
```

Then open `http://127.0.0.1:4173/`.

## Refresh the literature data

The generator reads `../PAMI_Audio-Visual_Survey/main.tex` and `../PAMI_Audio-Visual_Survey/literature.bib` by default:

```bash
node scripts/build-data.mjs
```

To use another source folder:

```bash
AVEI_SOURCE_DIR=/absolute/path/to/source node scripts/build-data.mjs
```

Generated outputs:

- `data/papers.json` — resolved, actively cited literature records
- `data/build-report.json` — unresolved citations, unused BibTeX entries, and category counts

## Content map

- `data/site.json` — title, authors, affiliations, abstract, links, contact, and citation
- `data/taxonomy.json` — Perception–Reasoning–Interaction capability taxonomy
- `data/benchmarks.json` — representative benchmark field guide
- `assets/figures/` — web-rendered versions of manuscript figures
- `assets/paper.pdf` — current survey PDF

Empty `arxiv` and `rednote` values in `data/site.json` are hidden automatically. Add the final links there when available.

## GitHub Pages

The site is published from the `Cj1hao/Awesome_AVEI` repository using GitHub Pages from the repository root on the default branch. No framework build or deployment action is required.

## Known source gaps

The generated report currently records six unresolved citation placeholders in the manuscript. The provisional citation, public arXiv link, and Rednote link should be updated after release.
