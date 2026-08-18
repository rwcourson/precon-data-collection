import "server-only";

/**
 * Real PDF rendering (BRD Sections 6, 13, 14). Print-ready HTML is rendered by
 * headless Chromium so exports download as `application/pdf` instead of asking
 * the user to run the browser print dialog.
 *
 * Chromium is not guaranteed to be present in every environment, so a failed
 * launch falls back to serving the same HTML with its print toolbar — the
 * export always works, it just downgrades.
 */

export type PdfOptions = {
  landscape?: boolean;
  /** Rendered into the repeating page footer alongside page numbers. */
  footer?: string;
};

type RenderResult =
  | { kind: "pdf"; body: Uint8Array }
  | { kind: "html"; body: string };

let chromiumUnavailable = false;

export async function renderPdf(html: string, opts: PdfOptions = {}): Promise<Uint8Array | null> {
  if (chromiumUnavailable) return null;

  let browser: Awaited<ReturnType<typeof launch>> | null = null;
  try {
    browser = await launch();
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    const buffer = await page.pdf({
      format: "Letter",
      landscape: opts.landscape ?? true,
      printBackground: true,
      margin: { top: "14mm", bottom: "16mm", left: "10mm", right: "10mm" },
      displayHeaderFooter: true,
      headerTemplate: "<div></div>",
      footerTemplate: `
        <div style="width:100%;padding:0 10mm;font-family:Helvetica,Arial,sans-serif;font-size:8px;color:#94a3b8;display:flex;justify-content:space-between;">
          <span>${escapeHtml(opts.footer ?? "Brasfield & Gorrie Preconstruction — Confidential")}</span>
          <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
        </div>`,
    });
    return new Uint8Array(buffer);
  } catch (err) {
    // One failure means the binary is missing or blocked; stop retrying.
    console.error("PDF rendering unavailable — falling back to print HTML:", err);
    chromiumUnavailable = true;
    return null;
  } finally {
    await browser?.close().catch(() => {});
  }
}

/** Renders to PDF when possible, otherwise returns the print-ready HTML. */
export async function renderPdfOrHtml(html: string, opts: PdfOptions = {}): Promise<RenderResult> {
  const pdf = await renderPdf(html, opts);
  return pdf ? { kind: "pdf", body: pdf } : { kind: "html", body: html };
}

/** Builds the HTTP response for a PDF export, handling the HTML fallback. */
export async function pdfResponse(
  html: string,
  filename: string,
  opts: PdfOptions = {},
): Promise<Response> {
  const result = await renderPdfOrHtml(html, opts);
  if (result.kind === "html") {
    return new Response(result.body, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
  return new Response(result.body as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${safeName(filename)}.pdf"`,
    },
  });
}

async function launch() {
  // Imported lazily so bundling never pulls Playwright into the client graph.
  if (process.env.VERCEL) {
    // Hosted: no system Chromium exists, so use the serverless build shipped
    // by @sparticuz/chromium and drive it with playwright-core.
    const [{ chromium }, { default: sparticuz }] = await Promise.all([
      import("playwright-core"),
      import("@sparticuz/chromium"),
    ]);
    const executablePath = await sparticuz.executablePath();
    return chromium.launch({
      executablePath,
      args: sparticuz.args,
      headless: true,
    });
  }
  const { chromium } = await import("playwright");
  return chromium.launch({ args: ["--no-sandbox"] });
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export const safeName = (s: string) =>
  s.replace(/[^a-z0-9-_ ]/gi, "").trim().replace(/\s+/g, "-").toLowerCase() || "export";
