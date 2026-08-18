# Brasfield & Gorrie — Color System (2026)

Canonical values live in `assets/brand-tokens.json`. Read those rather than retyping hex codes. This file explains *how* to use them.

## The palette

| Token  | Name    | HEX | RGB | Print | Role |
|--------|---------|-----|-----|-------|------|
| `blue_4` | **Blue 4** | `#002070` | 0,32,112 | PMS 293 C/U | **Primary brand navy.** The B&G blue. Default logo color, headings, primary surfaces, headers. |
| `blue_5` | Blue 5 | `#00143C` | 0,20,60 | PMS 295 C/U | Darkest navy. Deep backgrounds, footers, near-black surfaces. |
| `blue_3` | Blue 3 | `#0028F0` | 0,40,240 | PMS 300 C/U | Vivid mid-blue. Secondary accent, links, data viz. |
| `blue_2` | Blue 2 | `#3888FF` | 56,136,255 | PMS 299 C/U | Bright accent. Highlights, accents/links on dark, callouts. |
| `blue_1` | Blue 1 | `#B0FFFF` | 176,255,255 | PMS 290 C/U | Pale highlight/tint. Sparingly — chart fills, subtle highlights. |
| `gray_1` | Gray 1 | `#E8E8EC` | 232,232,236 | Cool Gray 1 | Light neutral. Panel/section backgrounds, table stripes, dividers. |
| `white`  | White  | `#FFFFFF` | 255,255,255 | 0/0/0/0 | Primary background; type/logo on dark. |
| `black`  | Black  | `#000000` | 0,0,0 | Black 6 C/U | Mono print; hard contrast; body text where navy is too light. |

> **Blue 5 hex note:** the official 2026 Brand Update PDFs misprint Blue 5's hex as `#00003C` alongside RGB 0/20/60. The brand team confirmed (July 2026) that **`#00143C` (RGB 0/20/60) is correct** — it's also what the one-pager's vector art actually uses. If you see `#00003C` in the source docs, it's the typo, not this file.

## What changed in 2026
**Green 1 was removed from the primary palette.** The brand palette is now an all-blue + neutral system: do not use green (or any off-palette color) as a *brand* color — surfaces, headings, accents, CTAs, the mark. If you encounter older B&G material using navy `#003057` or a gold/green accent as brand color, treat it as superseded — the current navy is **Blue 4 `#002070`**.

**But green is not banned company-wide.** Green moved to the **secondary palette** (below) and remains sanctioned for **site logistics and pursuit materials**, and — like the other secondary hues — for differentiating information in charts/graphs.

## Secondary palette (charts, graphs, utility graphics)
An expanded secondary palette exists for specific situations: differentiating information in charts or graphs, and graphical objects that serve a utility — internal documents, UI, presentations, proposals. **Use it monochromatically** (e.g. five shades of green differentiating pie slices), not as brand surfaces or accents. Six families × five steps (1 = lightest → 5 = darkest): **green, yellow, orange, red, purple, gray**. Full RGB/HEX/CMYK/PMS values are in `assets/brand-tokens.json` → `secondary_colors`. Anchor hues: Green 3 `#80C000`, Yellow 3 `#FFC850`, Orange 3 `#F08018`, Red 3 `#E04820`, Purple 3 `#A03080`, Gray 3 `#7C7C84`.

## Print vs. digital strategy
Digital and print colors can't match perfectly (print's gamut is narrower); match as closely as possible and expect monitor variation.
- **Print:** colors toned down and used simplistically; avoid layering many colors; rely on high contrast.
- **Digital:** colors more vivid and bold; the full palette used generously; layers create rich layouts.
CMYK and PMS values for every color are in `brand-tokens.json`.

## Color roles (how the blues divide the work)
Black and white do most of the work; the blues are seasoning. Each blue has a job, and they aren't interchangeable:
- **Blue 4 `#002070` — primary brand navy.** Logo color, headings on light, primary brand surfaces.
- **Blue 5 `#00143C` — the anchor.** Deep full-bleed dark surfaces: hero, footer, statement sections. White text on it.
- **Blue 3 `#0028F0` — the signature.** Electric, saturated — reserve for the single most important element on a surface (primary CTA, one key figure, the mark). **It is a light-surface accent:** Blue 3 only reads on white or Gray 1. **Never put Blue 3 on navy (Blue 4 or Blue 5)** — the two blues are too close and it drops to ~1.8:1, the vibrating, illegible combo. On a navy surface the one accent moment is **white**, or **Blue 2 for a large display figure only** (see contrast table). Overuse anywhere kills it.
- **Blue 2 `#3888FF` — bright accent.** Highlights, links/accents on dark. Light enough for navy but only at display size — never small Blue 2 text on navy, white, or Gray 1.
- **Blue 1 `#B0FFFF` — opt-in only.** A pale-cyan tint, never the default accent, never body text — only a deliberate cyan moment on a dark surface.

See `references/design-system.md` for how these play out in layouts.

## How to use it

**Lead with navy and white.** Blue 4 on white (or white on Blue 4) is the default B&G look — see the brand one-pager, which is a navy header over white. Most of any layout should be navy, white, and Gray 1.

**Blues are a hierarchy, not interchangeable.** Going darkest→brightest: Blue 5 → Blue 4 → Blue 3 → Blue 2 → Blue 1. Use Blue 4 as the anchor; reach down to Blue 5 for depth (footers, deep panels) and up to Blue 2/Blue 3 for accents and interactive elements. Blue 1 is a highlight only.

**Accents are accents.** Blue 2 and Blue 3 should punctuate, not dominate. A single accent rule, a link color, a key stat, a chart series — yes. Large fields of bright blue — no.

**Gray 1 is the only neutral.** Use it for quiet backgrounds and separation so navy stays the star. Avoid inventing other grays; if you need a mid gray for body text, prefer near-black ink (`#11131A`) or Black.

## Accessibility / contrast — tested pairings
Measured WCAG ratios. **Use a foreground only on backgrounds where it passes the size you need.** Body/labels/small text need ≥ 4.5:1; large display (≥ ~24px bold) needs ≥ 3:1.

| Foreground | Background | Ratio | Verdict |
|---|---|---|---|
| White | Blue 4 / Blue 5 | 14.6 / 18.0 | ✅ anything |
| Blue 4 / Black | White | ~12 / 21 | ✅ anything |
| Blue 4 | Gray 1 | 11.9 | ✅ anything |
| Blue 1 `#B0FFFF` | Blue 4 / Blue 5 | ~13 | ✅ anything (the cyan highlight on navy) |
| Blue 3 `#0028F0` | White | 8.2 | ✅ anything (links/accents on light) |
| Blue 3 | Gray 1 | 6.7 | ✅ anything |
| Blue 2 `#3888FF` | Blue 5 | 5.3 | ✅ anything |
| Blue 2 | Blue 4 | 4.3 | ⚠️ **large display only** (e.g. a big stat figure); never small text |
| **Blue 3** | **Blue 4 / Blue 5** | **1.8 / 2.2** | ❌ **never** — the vibrating, unreadable combo |
| **Blue 2** | **White** | 3.4 | ❌ small text; large/icons only |
| **Blue 2** | **Gray 1** | 2.8 | ❌ never for text |
| **White / light text** | **Blue 1 or Blue 2** | 1.1 / 3.4 | ❌ never — these light chips carry **navy or black** text |

Quick rules that follow from the table:
- **Accent on navy = white, or Blue 2 at large display size. Never Blue 3.** (This is the most common mistake — e.g. an accent headline word or pull-quote glyph set in Blue 3 on a navy hero.)
- **Accent on white/Gray 1 = Blue 3** (links, one key figure, rule). Blue 2 on light is decorative/large only.
- **Blue 1 and Blue 2 are light chips:** any label sitting *on* them must be navy or black, never white. (A palette swatch labeled in white on the Blue 1/Blue 2 chip is unreadable.)
- **Blue 1** is a navy-surface highlight; never text on white.

## Suggested pairings
- **Default surface:** White background, Blue 4 headings, near-black body, Blue 2 accent rule/links.
- **Navy surface:** Blue 4 (or Blue 5) background, White text, White (or Blue 2 **at display size only**) for the one accent/figure, Blue 1 for subtle highlights. **Never Blue 3 on navy** — see the contrast table.
- **Panel/section break:** Gray 1 background to separate sections on white without a hard border.
- **Data viz series order:** Blue 4, Blue 2, Blue 3, Blue 5, Gray 1 (then tints). Keeps charts on-brand and legible. When more differentiation is needed than the blues allow, use one secondary family monochromatically (five steps of green/orange/etc. — see the secondary palette above), not a rainbow.
