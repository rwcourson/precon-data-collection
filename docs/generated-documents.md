# Generated documents and slideshows

How this app builds PowerPoint (and, later, Word/PDF) so outputs stay on the 2026 Brasfield & Gorrie brand.

The kit lives in [`brand/`](../brand/README-SLIDESHOW.md). Code reads [`src/lib/brand`](../src/lib/brand/tokens.ts). Do not hardcode navy, Calibri, or “B&G” in a generator.

## Guardrails

- Write **Brasfield & Gorrie** with the ampersand. Do not use “B&G” as company shorthand in generated copy.
- Lead with Blue 4 (`#002070`) and white. Accents are Blue 3 on light, Blue 2 on dark. No green as a brand surface.
- Square corners, hairline rules, no decorative shadows or gradients.
- Title slides: Blue 4 (or Blue 5), white horizontal logo, white Sharp Grotesk PE SmBold 15.
- Content slides: white, navy headings, navy horizontal logo, Book 20 body.
- Chart series order: Blue 4 → Blue 2 → Blue 3 → Blue 5 → Gray 1.
- Logo color matches the surface (white on navy, navy on light). Never put the mark on a contrast-forcing plate.

Exact tokens, fonts, and logo files: `brand/brand-tokens.json`, `brand/guides/`.

## What the app generates today

| Export | Route | Builder |
| --- | --- | --- |
| Studio canvas | `GET /api/export/pptx?dashboardId=` (or POST widgets / configs) | `buildCanvasPptx` |
| Forecast volume projection | `GET /api/export/pptx` | `buildForecastPptx` |

Studio must never download the forecast deck. Both builders share `createBrandedPptx` / `addTitleSlide` / `addContentSlide`.

Sharp Grotesk PE family names are set on every run. Recipients without the fonts installed see PowerPoint’s substitute; Verdana is the sanctioned Office fallback (`brand/guides/typography.md`).

Logos are rasterized PNGs under `src/lib/brand/assets/` so serverless tracing can ship them. `next.config.ts` includes that folder on `/api/export/pptx`.

## Adding another document type

1. Read `brand/guides/recipes-documents.md` and `brand/guides/design-system.md`.
2. Import colors/fonts from `@/lib/brand` — do not copy hex literals into a new file.
3. Keep generators free of Next request objects so Vitest can drive them (`pptx-canvas.ts` / `pptx-forecast.ts` pattern).
4. Principal-scope the route the same way the PPTX handler does (`getWebPrincipal`, `loadDashboardForPrincipal` / `listRoundsWithJobsForPrincipal`).
