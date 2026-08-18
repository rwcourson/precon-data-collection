import { NextRequest } from "next/server";
import { pdfResponse } from "@/lib/pdf";
import { buildStatusReport, renderStatusReportHtml } from "@/lib/status-report";
import { getWorkspace } from "@/lib/workspace-server";
import { loadAdminSectionForPrincipal } from "@/lib/authorization/loaders";
import { getWebPrincipal } from "@/lib/authorization/web-principal";

export const dynamic = "force-dynamic";
// Synchronous PDF build via headless Chromium.
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const [principal, workspace] = await Promise.all([getWebPrincipal(), getWorkspace()]);
  if (!(await loadAdminSectionForPrincipal(principal, "status"))) {
    return new Response("Not found", { status: 404 });
  }
  const report = await buildStatusReport(workspace);
  const html = renderStatusReportHtml(report);

  if (req.nextUrl.searchParams.get("format") === "html") {
    return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  }

  const stamp = report.generatedAt.toISOString().slice(0, 10);
  return pdfResponse(html, `Precon Data Collection Status and Roadmap ${stamp}`, {
    landscape: false,
    footer: "Brasfield & Gorrie Preconstruction — Status & Roadmap — Confidential",
  });
}
