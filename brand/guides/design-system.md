# Brasfield & Gorrie — Design System (visual foundations & voice)

How to make B&G work *look and feel* right, beyond raw colors/type/logos. This is the layer that separates on-brand from generic. Tokens and component classes that implement all of this live in `assets/css/brand.css`; the factual palette is in `brand-colors.md` and the type system in `typography.md`.

## Design philosophy
**Premium without being precious. Polished without losing its edge.** B&G is a builder — outputs should look like they were made by people who care about details, not by a marketing template. Lean toward the feel of brands like Yeti (rugged precision), Ferrari (engineered elegance), Patagonia (material honesty), Aesop (editorial restraint). Avoid the opposite: generic SaaS, corporate stock, soft pastel, anything overly playful.

Concretely that means: hard edges over soft ones, hairline rules over boxes and shadows, hard color blocks over gradients, restraint over decoration, real construction photography over stock, and whitespace used as structure rather than filler.

## Color in practice
The factual values are in `brand-colors.md`. The *roles* that make layouts feel intentional:
- **Black and white do most of the work.** Blues are seasoning, not the meal.
- **Blue 4 `#002070` — primary brand navy.** The logo color and the default for headings on light.
- **Blue 5 `#00143C` — the anchor.** Deep almost-black navy for full-bleed hero/footer/statement surfaces. White text on it; accents in white (or Blue 1 if a cyan moment is wanted).
- **Blue 3 `#0028F0` — the signature.** Electric and saturated. Reserve it for the single most important thing on a surface: the primary CTA, a key figure, the brand mark. **It only works on light surfaces (white / Gray 1).** Do not set Blue 3 on navy — the contrast is ~1.8:1 and it vibrates; on a navy hero/footer the one accent moment is **white**, or **Blue 2 at large display size**. Overusing it anywhere kills the effect.
- **Blue 2 `#3888FF` — bright accent.** Highlights and accents, especially on dark.
- **Blue 1 `#B0FFFF` — opt-in only.** A pale-cyan tint, never the default accent and never body text — reach for it only when you deliberately want one cyan highlight on a dark surface.
- **No gradients between blues. No green. No warm colors.** Hard blocks with edges.

## Type in practice
One family only — **Sharp Grotesk** (see `typography.md` for cuts and the exact family names). Get contrast from weight + width, never a second typeface. Per the official type spec:
- **Headlines / display:** Semibold (SmBold 15), **sentence case**, tight leading (~85–90% of size), tracking 0 to −0.01em. Quietly confident, not shouting. (Caps is *not* the default for headlines — see casing below.)
- **Eyebrows / labels / buttons:** Medium 22, **ALL CAPS**, tracked ~0.075em. Often paired with a short leading hairline rule.
- **Subheads / lead:** Medium 20, sentence case, leading ~1.1.
- **Body / caption:** Book 20, sentence case, leading ~1.55, tracking 0.
- **Large numbers:** Thin 15, very tight tracking (−0.04em), unit on its own line, tabular figures.
- **High-impact short titles** (1–3 words, advertising/covers): the Bold 10 cut set ALL CAPS is the brand's tool for this — see `typography.md` for availability/substitution.

**Casing rule (2026): grammatical structure decides.** A headline that's a complete sentence is sentence case with punctuation; a fragment/phrase (most display headlines) is **Title Case without punctuation**. ALL CAPS is reserved for eyebrows, labels, buttons, and the Bold 10/Book 15 short-title treatments. Body is always sentence case. Full rule in `typography.md`; approved campaign messages keep their casing exactly as written (`messaging.md`). (Older notes calling for all-caps "Black 900" headlines are wrong — the Black width is not used.)

## Spacing & layout
- **4px base, generous rhythm.** Section padding ~96px desktop / ~48px mobile; section-to-section ~128px; card padding ~32px+; headline-to-body ~16px. Whitespace is structural.
- **Strong left-alignment**, asymmetry over symmetry — don't center everything. Eyebrow + display headline + lead, stacked and left-aligned, is the signature opening.
- **Rules over boxes.** A 1px hairline separates sections more often than a border or background change. `--bg-hairline` on light, `--bg-hairline-on-dark` on dark.
- Max content width ~1200–1440px; display headlines may break full-bleed.

## Corners, borders, shadows
- **Default corner radius: 0.** Hard corners. 2px only on inputs/chips. **999px (pill) only on status badges** — never on buttons.
- **Cards are bordered, not shadowed:** white surface, 1px gray hairline, 0 radius, generous padding. An "anchor" card variant is Blue 5 with white text and no border. Never a rounded card with a colored left border (that reads as generic slop).
- **Shadows are rare** — reserve a single soft shadow for genuinely floating elements (menus, modals). Never on body cards.
- **No colored borders.** Borders are gray, white-translucent, or absent.

## Buttons & interaction
- **Primary button:** solid Blue 3, white uppercase label, 0 radius.
- **Secondary/ghost:** transparent with a 1px Blue 5 border (or white on dark), same label treatment.
- **States are opacity only.** Hover ≈ 0.85, press ≈ 0.7. **Never** a color shift, glow, shadow growth, scale bounce, or movement. Links keep their underline at rest; opacity is the only hover signal.
- No icon-only buttons unless the icon is unmistakable — add a label.

## Motion
Restrained and engineered. Durations 140–480ms (never longer for UI). One signature easing curve: `cubic-bezier(0.22, 1, 0.36, 1)` — fast start, gentle stop. Prefer cross-fades and opacity-led entrances over slides; no spring physics, no parallax. A single horizontal rule animating across the screen is the house "section break" transition.

## Imagery
Full-bleed, edge-to-edge, no rounded corners, no padding. Real construction — workers, steel, concrete, equipment — never stock business meetings. Cool, slightly desaturated grade (skies and concrete read blue-leaning), never warm, never an Instagram filter; light grain OK on hero photography. **Avoid blur/frosted-glass effects** — the brand is honest materials, not glassy chrome.

**Photography direction (2026 guide, 1.7)** — four categories, used together:
- **Structure & detail:** close-ups of rebar assemblies, formwork systems — technical depth, credibility.
- **Scale & context:** wide site photography — opens a section, sets a scene, conveys ambition/complexity.
- **The human element:** crews at work — a worker on a reinforced column, a silhouette against the sky — behind every project is a team with craft and purpose.
- **Process & craft:** material-level detail — concrete being placed, equipment at work — pairs with copy about *how* we build.

**Photo overlays (2026 guide, 1.6)** are the brand's image treatment: a blue-family color overlay (Blue 4/Blue 5 duotone-style, or vivid blue for bolder moments) that unifies photography, sets mood, and creates contrast for overlaid content. Intensity ranges subtle → bold by context; typical applications are advertising, pursuit/presentation covers, tradeshow banners, and video. For text legibility, overlay Blue 5 at 60–80% opacity rather than blurring. Consistent overlay treatment is what moves the photography from documentation to a visual language.

## Iconography
There is no proprietary B&G icon set in the provided materials. As a coherent substitute, use **Lucide** outline icons: 1.5–2px strokes, geometric, no fills, terminals not rounded-friendly. Stroke color matches text (`currentColor`), not a brand blue unless the icon *is* a CTA. Sizes 16/20/24/32 to match neighboring text. **Never fill icons; never use emoji or Unicode pictographs (▶ ◆ ★) as icons.** This is a flagged substitution — if B&G has an internal icon library, swap it in.

## The ampersand (typographic rule)
The `&` belongs to the logo. Don't use it as a typographic flourish in headlines or body, and don't type `&` in Sharp Grotesk and treat it as the mark — the real mark is a custom italic form. Use the official ampersand asset (`assets/logos/symbol/bg-symbol-*.svg|png`) only for: the lockup itself, a large low-opacity watermark in the corner of a hero/full-bleed surface, or a deliberate 96px+ decorative flourish on a quiet page. In running copy, write the word "and." (See `editorial-style.md` for the company-name rules.)

## Brand voice
Plain-spoken, pragmatic, quietly confident — builders, not marketers. This complements the mechanical rules in `editorial-style.md`.
- **First-person plural, active, present tense.** "We self-perform concrete." Not "Concrete is self-performed."
- **Short over long.** A four-word sentence is often right; break anything past ~22 words.
- **Specifics over adjectives.** "8.4 million square feet" beats "massive footprint"; "self-perform" beats "vertically integrated."
- **No hype, no superlatives.** Avoid "best-in-class," "world-class," "cutting-edge," "innovative solutions," "unlock your vision." Let the work speak.
- **Industry terms, used correctly** — self-perform, preconstruction, design-build, CM at-risk, MEP. Define only for non-trade audiences.
- **No exclamation marks. No emoji. Ever.** Em dashes for emphasis, used sparingly.
- In voice: *"We build what matters. Hospitals, microchip fabs, water treatment plants. The infrastructure that runs the Southeast."*

## Honest caveats
These foundations were assembled partly from a strategic brief and reference imagery, not a production codebase or Figma source of truth. The Lucide icon set and any placeholder photography are substitutions. If B&G has an authoritative component library, deck template, or icon set, align to it and flag the difference.
