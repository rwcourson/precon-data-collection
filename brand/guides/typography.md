# Brasfield & Gorrie — Typography (2026)

The brand typeface is **Sharp Grotesk PE**. Canonical family names and file mappings are in `assets/brand-tokens.json` (`fonts`). Font files are in `assets/fonts/`.

## Critical detail about the family names
Sharp Grotesk ships each **weight + width** combination as its **own named family**, and every file's subfamily is `Regular`. The trailing number (15 / 20 / 22) is the **width** axis baked into the name — it is *not* a point size and *not* a weight. Consequences:

- Reference fonts by their **full family name** verbatim, e.g. `Sharp Grotesk PE SmBold 15`. Do **not** try to get "semibold" by setting `font-weight: 600` on a `Sharp Grotesk` family — that family does not exist; the weight is part of the name.
- In CSS, each `@font-face` declares `font-weight: normal`. In python-pptx / docx-js, set the literal family string as the font name.

## The styles

### Supplied (use freely — TTFs are in `assets/fonts/`)
| Brand style | Family name (verbatim) | Use for |
|-------------|------------------------|---------|
| **Semibold 15 — PRIMARY** | `Sharp Grotesk PE SmBold 15` | Titles, headlines, any large high-level text. The default heading face. |
| Semibold 20 | `Sharp Grotesk PE SmBold 20` | High-impact subheaders, numbers, table emphasis. |
| Medium 22 | `Sharp Grotesk PE Medium 22` | Subheads. |
| Medium 20 | `Sharp Grotesk PE Medium 20` | Subheads, labels, eyebrows, buttons. |
| Book 20 | `Sharp Grotesk PE Book 20` | **Body copy**, paragraphs, tables, captions. |
| Book Italic 20 | `Sharp Grotesk PE Book Itl 20` | Italic / emphasis within body. |
| Thin 15 | `Sharp Grotesk PE Thin 15` | Large light *display* only. Never body — too fragile at small sizes. |

### Shown in the brand guide but NOT supplied (handle gracefully)
| Brand style | Intended use | What to do |
|-------------|--------------|-----------|
| **Bold 10** | Bold, high-impact titles: advertising, brochure/pursuit/presentation covers, tradeshow banners. Best at **1–3 words in ALL CAPS**; up to 6 words in all caps or Title Case. **Never sentence case, never past 6 words** — use SmBold 15 for longer phrases. **Tracking 10–25** when set all caps. | No file provided. Substitute `Sharp Grotesk PE SmBold 15` (ALL CAPS, tracking ~10–25). Note the substitution if the deliverable is a formal cover. |
| **Book 15** | Bridges Thin 15 and Book 20: high-impact subheaders, org-chart hierarchy, numeric infographics, tables. ALL CAPS (**tracking 10–25**) for short high-impact headers, or Title Case as a subheader. | No file provided. Substitute `Sharp Grotesk PE Book 20`. |

If a task specifically calls for Bold 10 or Book 15 and brand-exact output matters (e.g. a printed cover), tell the user those two widths aren't in this skill's font folder and ask whether to proceed with the closest supplied substitute. (These cuts *do* exist in the wider Sharp Grotesk library — they simply weren't part of the official PE set delivered with this skill. If the user supplies the files, drop them into `assets/fonts/` and wire them up the same way.)

## Casing & spec values (per the official type spec)
- **Headlines / display:** leading ~85–90% of size, tracking 0 to −0.01em. Casing follows the grammar rule below.
- **Eyebrows / labels / buttons:** ALL CAPS, tracking ~0.075em, using the Medium 22 width.
- **Subheads / lead:** sentence case, leading ~1.1.
- **Body / caption:** sentence case, leading ~1.5–1.6, tracking 0.
- **Large numbers:** very tight tracking (~−0.04em), tabular figures, unit on its own line.

**Casing — grammatical structure decides (2026 update):**
- Headline is a **complete sentence** → **sentence case**, ends with punctuation.
- Headline is a **fragment/phrase** (most ad headlines, covers, short-form) → **Title Case, no punctuation** (small words — a, the, of, in, with, and — stay lowercase unless they open the line).
- The positioning statement ("Building a Better Way") is Title Case without punctuation; ALL CAPS allowed when used as a graphic.
- **ALL CAPS** otherwise only for eyebrows/labels/buttons and the Bold 10 / Book 15 short-title treatments (tracking 10–25).
- Long-form/editorial content headers and body follow `editorial-style.md`; approved campaign messages keep their capitalization exactly as written (`messaging.md`).

## Fallbacks
When Sharp Grotesk can't load (e.g. a sandboxed / in-browser preview, HTML that can't embed fonts, or a recipient without the fonts), fall back to **Verdana** first. Verdana is what's actually installed on B&G machines as a complete family (regular, **bold**, *italic*, **_bold-italic_**), so it reliably resolves and covers body, emphasis, and italics — the roles a fallback most needs to get right. Keep Arial/Helvetica in the chain only as a deeper cross-platform safety net.

**The official system-font hierarchy** (extended brand guide, Text Hierarchy §3.3 — a sanctioned spec, not an improvisation). Use these exact roles when fonts can't be embedded:

| Role | Typeface | Size | Leading | Case | Tracking |
|---|---|---|---|---|---|
| Eyebrow / label | **Verdana Bold** | small | — | ALL CAPS | 50 to 100 |
| Headline / title | **Arial Narrow Bold** | large | 85% of size | sentence case | 0 to −20 |
| Subhead / lead | **Verdana Bold** | medium | 100–115% of size | sentence case | 0 to −25 |
| Body / caption | **Verdana Regular** | medium/small | 150–167% of size | sentence case | 0 |
| Large numbers | **Arial Narrow** | large | — | — | 0 to −25 |

(Tracking values are in thousandths of an em — 50 = 0.05em — the same unit Office and InDesign use.) The leading values mirror the Sharp Grotesk hierarchy, so a fallback layout keeps the brand's proportions even in system faces.

```
"Sharp Grotesk PE Book 20", "Sharp Grotesk PE SmBold 15", Verdana, Arial, "Helvetica Neue", Helvetica, sans-serif
```

**Two caveats to set expectations honestly:**
- **Do not rely on plain "Arial" resolving on B&G machines.** The installed Arial file is **Arial Narrow Bold** (`ARIALNB.TTF`) — a condensed *bold-only* face that the name `Arial` will **not** select. Per the official hierarchy above, Arial Narrow is exactly a **display face**: headlines (Bold) and large numbers. Reach for `"Arial Narrow"` explicitly and only at large sizes; never for body. Note the spec's large-numbers row calls for regular-weight Arial Narrow, which the bold-only install can't render — big numbers will come out bold; flag it if the difference matters.
- **Verdana has only Regular and Bold — no thin, medium, or semibold.** The brand's display roles (SemiBold 15 headlines, Medium 20/22 subheads/eyebrows/buttons) collapse onto Regular-or-Bold, and the **Thin 15** large-number treatment cannot be reproduced at all — it renders heavy. Verdana also sets noticeably **wider** than Sharp Grotesk, so headlines and big numbers rewrap/sprawl. When brand-exact display type matters, say so and recommend installing Sharp Grotesk rather than shipping the fallback.

## Hierarchy & defaults
- **Headings / titles:** SmBold 15. Keep line-height tight (~1.05–1.15) and tracking slightly negative for large sizes.
- **Subheads / labels / eyebrows / buttons:** Medium 20 (or Medium 22). Eyebrows and buttons in UPPERCASE with ~0.08–0.12em letter-spacing reads very "B&G".
- **Body:** Book 20, line-height ~1.5–1.6.
- **Big numbers / stats / org charts:** SmBold 20 (the guide pairs numerics with the Semibold/Book widths).
- **Italic/emphasis:** Book Itl 20.
- **Thin 15** is a special display tool — large sizes only.

## Per-format mechanics
Embedding/applying these fonts differs by output type. See:
- Web / HTML / PDF-from-HTML → `references/recipes-web.md`
- Word / PowerPoint / PDF-from-Office → `references/recipes-documents.md`

**Web shortcut — the unified family.** `assets/css/brand.css` also defines a single `"Sharp Grotesk"` family that maps `font-weight` to the right cut (200 = Thin 15, 400 = Book 20 + italic, 500 = Medium 20, 600 = SmBold 15), plus `"Sharp Grotesk Caps"` (Medium 22) for eyebrows/buttons. So on the web you can write `font-family:"Sharp Grotesk"; font-weight:600` instead of the long exact name. **Office (Word/PowerPoint) cannot use this mapping** — there you must set the exact per-file family name (e.g. `Sharp Grotesk PE SmBold 15`).

Before any document or PDF rendering in this environment, run `scripts/install_fonts.sh` so the renderer resolves the real fonts.
