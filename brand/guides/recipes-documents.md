# Applying the Brand — Documents (Word · PowerPoint · PDF)

These cover the **brand layer**. For the mechanics of building the files, use the existing document skills (`docx`, `pptx`, `pdf`) — this file only tells you which colors, fonts, and logos to apply and how to make them render.

## ALWAYS FIRST: install the fonts
Any document or PDF rendered in this environment will substitute a generic sans for Sharp Grotesk unless the fonts are installed. Before generating, run once:

```bash
sh scripts/install_fonts.sh
```

Use the **exact** family names from `assets/brand-tokens.json` (e.g. `Sharp Grotesk PE SmBold 15`). Colors are RGB/HEX from the same file.

> Portability caveat: installing here fixes rendering for conversions done here (docx/pptx → PDF). A recipient opening the raw `.docx`/`.pptx` on their own machine still needs the fonts locally, or the file must embed them (Word: *File ▸ Options ▸ Save ▸ Embed fonts*; python-pptx can't embed). When in doubt for a shared editable file, set Sharp Grotesk with **Verdana** as the practical fallback (the installed B&G family — not plain Arial, which isn't present) and mention it.

## Word (.docx via docx-js)
Set Sharp Grotesk as the default and override heading styles to navy. Logos go in as PNG via `ImageRun` (use the high-res transparent PNGs).

```javascript
const NAVY = "002070", BLUE2 = "3888FF", GRAY1 = "E8E8EC"; // docx-js wants hex w/o '#'
const doc = new Document({
  styles: {
    default: { document: { run: { font: "Sharp Grotesk PE Book 20", size: 22 } } }, // 11pt body
    paragraphStyles: [
      { id:"Heading1", name:"Heading 1", basedOn:"Normal", next:"Normal", quickFormat:true,
        run:{ font:"Sharp Grotesk PE SmBold 15", size:40, color:NAVY },
        paragraph:{ spacing:{ before:240, after:160 }, outlineLevel:0 } },
      { id:"Heading2", name:"Heading 2", basedOn:"Normal", next:"Normal", quickFormat:true,
        run:{ font:"Sharp Grotesk PE SmBold 20", size:30, color:NAVY },
        paragraph:{ spacing:{ before:200, after:120 }, outlineLevel:1 } },
    ]
  },
  sections: [{ children: [ /* logo + content */ ] }]
});
```

Brand specifics for Word:
- **Header logo:** add the horizontal navy PNG (`assets/logos/horizontal/bg-horizontal-navy.png`) in the section header via `ImageRun` (set `type:"png"`), sized to taste; keep clear space around it.
- **Tables:** header-row shading navy (`fill:"002070"`, white text), body rows striped with Gray 1 (`fill:"E8E8EC"`), `ShadingType.CLEAR`. (See the `docx` skill for the dual-width table rules.)
- **Accents:** rule lines / key figures in Blue 2 or navy. No green.
- Validate the file with the `docx` skill's validator after writing.

## PowerPoint (.pptx via python-pptx)
```python
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
NAVY=RGBColor(0,32,112); NAVYDK=RGBColor(0,0,60); WHITE=RGBColor(255,255,255); BLUE2=RGBColor(56,136,255)

prs=Presentation(); prs.slide_width=Inches(13.333); prs.slide_height=Inches(7.5)  # 16:9
s=prs.slides.add_slide(prs.slide_layouts[6])                                       # blank

# Navy title slide background
s.background.fill.solid(); s.background.fill.fore_color.rgb=NAVY

# White logo on the navy slide
s.shapes.add_picture("assets/logos/horizontal/bg-horizontal-white.png", Inches(0.6), Inches(0.5), height=Inches(0.6))

# Title in Sharp Grotesk SmBold 15, white
tb=s.shapes.add_textbox(Inches(0.6),Inches(3.0),Inches(12),Inches(2)); tf=tb.text_frame
r=tf.paragraphs[0].add_run(); r.text="Project Pursuit"
r.font.name="Sharp Grotesk PE SmBold 15"; r.font.size=Pt(48); r.font.color.rgb=WHITE
```

Brand specifics for PowerPoint:
- **Title/section slides:** navy (Blue 4) or deep navy (Blue 5) background, white logo, white SmBold 15 title.
- **Content slides:** white background, navy SmBold headings, Book 20 body, navy/white logo in a corner, Blue 2 accents.
- **Charts:** series order Navy → Blue 2 → Blue 3 → Blue 5 → Gray 1.
- Set `font.name` on every run (python-pptx won't inherit a brand default reliably).

## PDF
Two routes — both need `install_fonts.sh` run first.

1. **HTML → PDF (the route for branded PDF layouts).** Build the page with `references/recipes-web.md` + `brand.css`, then print it to PDF with whatever renderer is on hand — **a Chromium-based renderer is preferred** because Chrome's text engine kerns and shapes Sharp Grotesk correctly. No specific tool is required:

   ```bash
   # Plain Chrome/Chromium CLI — no installs needed:
   chrome --headless --print-to-pdf=output.pdf --no-pdf-header-footer input.html
   # (macOS: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
   ```

   If you're already scripting in Node, Puppeteer or Playwright work too (`page.pdf({ printBackground: true, preferCSSPageSize: true })`, and await `document.fonts.ready` so Sharp Grotesk loads before printing).

   **Caution on non-Chromium renderers:** weasyprint and reportlab have produced visibly broken Sharp Grotesk letter-spacing in headlines (seen in production, July 2026). If they're all that's available, check the output's headline kerning before shipping and flag the substitution if it looks off.

   Reference the `@font-face` files with absolute `file://` paths or base64-embed them (see `recipes-web.md`) so the real fonts actually load; SVG logos render crisply.

   **Logo on a navy header/footer:** use the **white** logo straight on the navy — never the navy logo on a white box/plate to make it show up (see `references/logos.md`). Keep the surrounding padding consistent on every page (one spacing value, reused), so headers and footers don't drift. A correct, copyable pattern:
   ```html
   <style>
     .doc-header{
       background:var(--bg-blue-4);          /* full-bleed navy, no inner plate */
       padding:18px 48px;                    /* same value top/bottom on every page */
       border-bottom:3px solid var(--bg-blue-3);
       display:flex; align-items:center; justify-content:space-between;
     }
     .doc-header img{ height:32px; display:block; }   /* white logo, sized by height only */
     .doc-footer{
       background:var(--bg-blue-5);
       padding:18px 48px;
       display:flex; align-items:center; gap:16px;
       color:rgba(255,255,255,.7);
     }
     .doc-footer img{ height:24px; display:block; }
   </style>
   <header class="doc-header">
     <img src="assets/logos/horizontal/bg-horizontal-white.svg" alt="Brasfield &amp; Gorrie">
     <span class="bg-eyebrow">Company History</span>
   </header>
   <!-- … on a WHITE content page, swap to bg-horizontal-navy.svg, same padding … -->
   ```
   For a light/white cover or content page, use `bg-horizontal-navy.svg` (or `stacked` in portrait/square space) on the white surface — again directly, no box. Run `select_logo.py` if unsure which file.

2. **Office → PDF.** Only when the deliverable *starts* as a `.docx`/`.pptx`: build it as above, then convert with LibreOffice (the `docx`/`pptx` skills wrap this). Because the fonts are installed, Sharp Grotesk renders correctly in the PDF. If the ask is simply "a branded PDF," don't detour through Office — go HTML → PDF (route 1).

For filling or assembling existing PDFs, use the `pdf` skill's manipulation tools (pypdf etc.); but any *new rendered pages* you add (covers, headers) are built via HTML → PDF, then merged.

## Quick checklist
- `install_fonts.sh` run before rendering.
- Branded PDFs rendered from HTML, preferably with a Chromium-based renderer; if using weasyprint/reportlab, verify headline kerning first.
- Exact family names; navy headings, Book 20 body.
- Logo color matches the slide/page background (white on navy/dark, navy on light); placed directly on the surface, never on a white/colored plate or box; clear space respected.
- Navy + white lead, Blue 2/Blue 3 accents, Gray 1 neutral, no green.
