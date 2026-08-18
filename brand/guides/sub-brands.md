# Brasfield & Gorrie — Sub-Brands, Regions & Magnus (2026)

From the 2026 Brand Update sections 3.0 (Regional Distinction) and 4.0 (Secondary Brands). The governing idea: **"Branded house, not house of brands."** Every sector, department, region, and platform is a sub-brand *of* B&G — same navy, same typeface, same symbol — never a standalone logo with its own colors or marks.

> **Assets:** the **regional marks ARE supplied** — `assets/logos-regional/<region>/*.png` (transparent RGB PNGs from the official CONNECT Regional Branding pack; regions: `carolinas`, `central`, `florida`, `georgia`, `texas`). The **Magnus 'm' symbol IS supplied** — `assets/logos-magnus/magnus-symbol-<color>.<svg|png>` (the Magnus *wordmark* and the icon+wordmark lockup are not; see 4.4 below). Sector and department marks are **not** supplied — ask for that artwork rather than recreating it. Print-grade CMYK/EPS versions of the regional marks exist in the CONNECT source pack; ask when doing production print work.

## Market sector identity (4.1)
The seven market sectors, expressed as streamlined lockups of the master brand:
**Commercial · Government · Healthcare · Heavy Civil · Industrial · Mission Critical · Self-Perform**

In running text, sector names are lowercase except before "Division" (see `editorial-style.md`).

## Department identity (4.2)
Departments (Human Resources, Virtual Design + Construction, Learning and Development, Accounting, …) get the same streamlined lockup treatment. The **don'ts** are explicit:
- **Don't make your own department logo** and/or use the ampersand to build one.
- **Don't make additions to the B&G logo** to create a new mark (e.g. adding "VDC" to the wordmark).
- **Don't use unapproved typefaces** (no serifs, no novelty faces).

Sub-brand streamlining doesn't forbid fun one-off merch graphics — but those go through the brand team: regional marketing contact, or Ashton Adams / Sonia Marshburn in Communications. Merch and printing go through the regional swagmaster.

## Regional distinction (3.0)
Marks exist for the five corporate regions — **Carolinas, Central, Florida, Georgia, Texas** — primarily for **internal** settings, regionally created merch, and communicating the regional structure at a corporate level. Usable with or without the region name.

### When to use a regional mark — run this check whenever a region or state comes up
1. **Is the deliverable *about* or *for* a region** (regional team deck, office graphic, region-wide initiative or program, merch, field signage), or does it merely *mention* a place (a project that happens to be in Georgia)? Only the former gets a regional mark — a project's location alone doesn't.
2. **Internal/regional audience → use the regional mark** (outline set by default), alongside or instead of a generic master-brand treatment. **External client-facing material → master brand**, regional mark only when regional identity is the point.
3. **Pick the right asset** from the table below: outline mark for most uses, solid for murals/large print, badges only on field applications, state marks/tags only for Central & Carolinas states with regional-leadership permission.
4. **Say what you chose and why** — including when you deliberately stayed master-brand. Don't silently default to the master logo when a regional mark applies.

| Asset | Preference / use |
|---|---|
| **Outline regional marks** | Preferred in most applications: corporate/internal materials, digital/presentations, merch with small imprints. |
| **Solid regional marks** | Alternative for large print impressions: murals, signage, large digital applications. |
| **Regional badges** | Field-oriented applications only — signage and merch. **Not** for corporate or presentation materials. |
| **State marks / state tags** | States within the **Central and Carolinas** regions only. Use with discretion and **with permission of regional leadership**; must not imply the state is its own region. Merch, office graphics/murals, market sector ID / department ID. |
| **Regional brand system** | A flexible kit built from regional + state marks for region-level programs, departments, market-sector focus, and region-wide initiatives. |

### Supplied files — `assets/logos-regional/<region>/`
Transparent RGB PNGs (navy `#002070` artwork). Naming per region:

| File | What it is | Guide category |
|---|---|---|
| `state-outline.png` / `state-icon.png` | Region silhouette (outline) with the ampersand | **Outline regional mark** — the default |
| `state-icon-fill.png` / `state-fill.png` / `state-outline-fill.png` | Solid-filled silhouette, ampersand knocked out | **Solid regional mark** — murals/large print |
| `state-icon-text.png` | Outline mark + region name lockup | Outline mark **with** region name |
| `badge-outline.png` | Circular "BRASFIELD & GORRIE / [REGION] REGION" badge, outline | **Regional badge** — field/merch only |
| `badge-blue-fill.png` | Same badge, solid navy fill | **Regional badge** — field/merch only |
| `<state>-state-tag.png` / `state-tag.png` | Ampersand + divider + state abbreviation (e.g. "& \| NC") | **State tag** — Central & Carolinas states get per-state files (`alabama-`, `mississippi-`, `tennessee-`, `north-carolina-`, `south-carolina-`) |
| `<state>-state-icon-text.png` (Central only) | Per-state outline mark + name | **State mark** |

Naming follows the source pack, so file sets vary slightly by region (e.g. Florida's solid mark is `state-outline-fill.png`, Central's is `state-fill.png`). List the region's folder rather than assuming an exact name. Resolution is modest (marks ~250–500 px, badges ~830 px) — fine for documents, slides, and web at normal sizes; for murals/signage or print-grade output, ask for the vector EPS/PDF from the CONNECT pack.

## Magnus branding (4.4)
Magnus is B&G's platform sub-brand. Rules from the 2.0 launch:
- The logo = the **'m' icon** + the wordmark **'magnus'** — lowercase when it appears with the icon. The icon can stand alone where context exists.
- **Never affix "AI" to the wordmark.** Version designations ("2.0", etc.) only during a launch phase, never permanently.
- **Colors:** Blue 3 `#0028F0`, Blue 5 `#00143C`, and **Magnus Blue `#1DFFFF`** — a vibrant, digital-only variant of Blue 1. Magnus Blue **will not reproduce accurately in traditional CMYK print**; for print, fall back to Blue 1 `#B0FFFF` or flag it.
- Values also live in `assets/brand-tokens.json` → `magnus`.

### Supplied files — `assets/logos-magnus/`
The **'m' symbol is supplied**, taken from the shipping product artwork (vector-exact, not a redraw): `magnus-symbol-<color>.svg` and `.png` in five colors. SVGs are cropped tight to the mark (viewBox `45.8 124.2 420.4 269.9`); PNGs are transparent 1024×657. The mark is wider than it is tall — aspect ratio **1.5576:1** — so size it by *width* and never squash it to a square.

| Background | Use | File token |
|---|---|---|
| Blue 5 / navy / black / any dark digital surface | **Magnus Blue** — the signature treatment | `magnusblue` |
| White, Gray 1, light surfaces | **Blue 3** — the default on light | `blue3` |
| White/light where Blue 3 is too loud (dense documents, body-adjacent placement) | **Blue 5** | `blue5` |
| Photography, busy imagery, dark surfaces where Magnus Blue is too vivid | **White** | `white` |
| Single-color / mono print, or CMYK where Magnus Blue can't reproduce | **Black** | `black` |

Same background discipline as the master brand: **switch the mark's color to fix contrast, never add a plate or box behind it.** Magnus Blue on a light background fails badly (it's a near-cyan) — on light, use `blue3` or `blue5`. Clear space on all sides = the height of the symbol's left stem. Practical minimum ~24 px wide.

**Not supplied: the `magnus` wordmark and the full icon+wordmark lockup.** Only the symbol ships here. When a deliverable needs the complete Magnus logo, **ask for the artwork** — do not typeset "magnus" in Sharp Grotesk (or anything else) next to the icon and call it the lockup. Use the symbol alone only where Magnus context is already established, which is exactly what the guide permits it for.

## Corporate initiatives (4.5)
Select company-wide programs may use colors, typography, and design elements **outside** the core standards, on a limited basis, developed in close coordination with company leadership. These are deliberate exceptions — don't generalize from them, and don't fold their styles back into regular B&G material.
