# Product color system

Tokens live in `src/app/globals.css`. Components consume **roles**, not hex
literals. Light ( `:root` ) and dark ( `.dark` ) independently map the same
roles — dark is not an inversion of the light navy.

Sign-in is a theme-independent navy lockup and does not use these surfaces.

## Brand

| Role | Value | Use |
|---|---|---|
| Identity | `#0c2048` | Ampersand, headings, `--brand` |
| Interaction | `#0028f0` | Clicks, focus, active rail (`--accent-600`) |

Do not paint brand onto large surfaces (page, sidebar, cards, borders).

## Layers

1. **Neutral foundation** — `--surface-canvas` (page), `--surface-frame`
   (sidebar), `--surface-card`, `--surface-raised` (menus / dialogs). Adjacent
   layers must be distinct. Light uses small steps (~0.02 L). Dark uses larger
   steps (~0.04 L) and **lightens as it elevates**.
2. **Functional accent** — `--accent-50` … `--accent-950` (hue 264). Roles pick
   a step: light primary is 600 / hover 700; dark primary is 400 / hover 300.
   Hover wells stay neutral; selected / info uses `--accent-soft`.
3. **Semantic communication** — success, warning, danger, and info keep their
   own hues. Status UI also has a label or icon; color is not the only cue.
4. **Theming** — change the role mappings in `:root` / `.dark`. Do not recolor
   components.

## Type scale

Four steps, **12px floor**, pinned in `px` in `src/app/globals.css` so they do not shrink under `html { text-sm }`. Guard: `src/lib/type-scale.contract.test.ts`.

| Class | Size | Use |
|---|---|---|
| `text-xs` | 12px | Chrome: captions, table headers, badges, hints, toolbar labels, sm buttons |
| `text-sm` | 14px | Content: body, sheets, nav, inputs, default buttons (`html` default) |
| `text-base` | 16px | Card, dialog, and sheet titles |
| `text-xl` | 20px | Page titles, KPIs, auth |

Do not add `text-2xs`, `text-[11px]`, `text-[13px]`, `text-lg`, or `text-2xl`.

## Text and borders

| Token | Role |
|---|---|
| `--text-primary` / `text-foreground` | Titles, primary copy |
| `--text-secondary` / `text-ink-secondary` | Supporting copy (page and card descriptions) |
| `--text-muted` / `text-muted-foreground` | Labels, meta, placeholders |
| `--border-subtle` | Default edges |
| `--border-strong` | Controls that need a harder edge |

## Charts

`--chart-1` … `--chart-8` rotate hue at matched lightness and chroma. Series 1
is B&G blue; the rest are teal, violet, amber, rose, steel, sky, and green.
Do not build a dashboard from one cobalt ramp.

chart-elements reads these CSS variables. The `data-chart-palette="cobalt"`
attribute is a leftover name; the live series come from the tokens above.

## Rules

- Prefer `bg-background`, `bg-card`, `bg-sidebar`, `bg-popover`, `text-primary`,
  `bg-accent-hover` over new hex values.
- Primary buttons use `--accent-hover` on hover, not `primary/90`.
- Soft tone utilities (`.tone-info`, `.tone-success`, `.tone-warning`,
  `.tone-danger`) already bind to the semantic tokens.
