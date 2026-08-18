# Brasfield & Gorrie — Logo & Mark Usage (2026)

Files live in `assets/logos/<type>/bg-<type>-<color>.<svg|png>`. To pick the right file, run:

```
python scripts/select_logo.py --type <stacked|horizontal|symbol> --background <light|navy|dark|photo|mono> [--format svg|png]
```

Prefer **SVG** wherever the surface supports it (web, modern documents, anything scalable). Use **PNG** (transparent, high-res) for raster contexts. Extra fixed-size PNGs (square avatar, 150px, 600px) are in `assets/logos-extras/`.

## The three marks

| Type | What it is | When to use |
|------|------------|-------------|
| `horizontal` | Single-line wordmark | **Preferred when space permits.** Wide formats: site nav, document/email headers, signage, slide footers. |
| `stacked` | Two-line wordmark (BRASFIELD / & GORRIE) | When horizontal space is limited, or square/portrait space. |
| `symbol` | The ampersand alone | Tight space or where brand context is already established: favicons, app icons, avatars, watermark, as a cropped graphic element. |

**The "General Contractors" descriptor:** never under the *horizontal* lockup — if further context is demanded, switch to the stacked lockup instead. An official **stacked-with-"General Contractors"** variant exists for exactly that case (only when context is demanded; it has its own larger minimum size, below). That variant's artwork is **not supplied in this skill** — ask for it rather than typesetting the descriptor yourself.

## Color on background (the #1 rule)
The picker enforces this, but the logic:

| Background | Logo color | File token |
|------------|-----------|-----------|
| White, Gray 1, light/airy photo | **Navy** (Blue 4) — default | `navy` |
| Brand navy (Blue 4 / Blue 5) | **White** | `white` |
| Black / any dark surface | **White** | `white` |
| Photography / busy imagery | **White**, placed over a darker region (add a navy scrim if the image is light) | `white` |
| Single-color / mono print | **Black** | `black` |

`brightblue` (Blue 2) logos exist for a special accent treatment **on navy only** — use sparingly, never as the default. Never put a navy logo on a dark background or a white logo on white.

**Fix contrast by switching the logo color, never by adding a plate behind it.** If the navy logo would be invisible on a navy header, the answer is the **white** logo placed directly on the navy — *not* the navy logo dropped onto a white box, chip, rounded rectangle, or panel. A white (or any colored) plate behind the wordmark is off-brand: it boxes the mark in, fights the clean full-bleed navy surfaces, and is the most common way this goes wrong. The logo always sits directly on the surface; the only thing around it is clear space (below). The single allowed "container" is the brand's own framed treatments in `example.html`, never an ad-hoc plate invented to rescue a wrong-color logo.

## Clear space (exclusion zone)
Keep clear space on **all sides equal to the height of the capital "B" in "Brasfield."** It scales with the mark — bigger logo, bigger buffer. Nothing (text, photo edges, other logos, page trim) intrudes into that zone. SVGs include a little built-in padding, but still budget the B-height around them.

## Minimum size
Official minimums (2026 guide, absolute floors — give it more when you can):

| Lockup | Minimum |
|---|---|
| Stacked | **0.75 in / 100 px** wide |
| Horizontal | **1.25 in / 200 px** wide |
| Stacked with "General Contractors" | **1.5 in / 200 px** wide (larger to keep the descriptor legible) |
| Symbol | ~24 px (not specified in the guide; practical floor) |

Values in `brand-tokens.json` → `logo.min_width_px` / `logo.min_width_in`.

## Don'ts (the guide's misuse list, plus practice)
- Don't stretch, condense, rotate, or skew it. Scale proportionally.
- Don't alter the size relationship between the ampersand symbol and the wordmark.
- Don't alter the space between the letters (no tracking changes).
- Don't outline the mark, add drop shadows or effects, or apply gradients.
- Don't fill it with imagery or texture, and don't use more than one color in the mark.
- Don't recolor it to off-palette colors.
- Don't place it with inadequate contrast — match logo color to background (white on dark, navy on light).
- Don't put the logo on a plate/box/chip/rounded rectangle to force contrast — switch to the white or black logo so it sits directly on the surface.
- Don't reconstruct the wordmark by typing "BRASFIELD & GORRIE" in Sharp Grotesk — always use the supplied artwork.
- Don't crowd it — respect the exclusion zone.

## Sub-branding — "Branded house, not house of brands"
Market sectors and departments are expressed as a streamlined lockup of the **symbol + a thin divider + the unit name** (e.g. Commercial, Government, Virtual Design and Construction, Human Resources), set in the brand type (Medium/Semibold). They are sub-brands *of* B&G — same navy, same typeface, same symbol — never separate logos with their own colors or marks.

Full rules — the seven market sectors, department-identity don'ts, the regional/state mark system, Magnus branding, and corporate-initiative exceptions — are in **`references/sub-brands.md`**. Regional marks (badges, state marks, state tags for the five regions) **are supplied** in `assets/logos-regional/<region>/`, and the **Magnus 'm' symbol** is supplied in `assets/logos-magnus/` (its wordmark and full lockup are not). Sector and department marks are not supplied — ask for that artwork rather than recreating it.

## The symbol as a graphic element
The ampersand can be **cropped very tightly** and used as a large background shape, a window/mask for photography, or line-work — emphasizing a gesture of the mark rather than reading as a full logo. Keep these crops in brand blues (or white/Gray 1), low-key behind content, and never so busy that they compete with text. This is a styling device, distinct from the logo itself.
