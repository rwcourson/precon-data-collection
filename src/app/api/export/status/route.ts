import { NextRequest } from "next/server";
import { pdfResponse } from "@/lib/pdf";
import { buildStatusReport, renderStatusReportHtml } from "@/lib/status-report";
import { getWorkspace } from "@/lib/workspace-server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const workspace = await getWorkspace();
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
