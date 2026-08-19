import { and, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { estimateRounds, jobs, users } from "@/db/schema";
import {
  listAdminSectionsForPrincipal,
  principalJobVisibilityPredicate,
  searchSheetsForPrincipal,
} from "@/lib/authorization/loaders";
import { getWebPrincipal } from "@/lib/authorization/web-principal";

const PAGES = [
  { href: "/", label: "Overview", keywords: ["home", "overview", "start"] },
  {
    href: "/bid-schedule",
    label: "Bid Schedule",
    keywords: ["bid", "schedule", "pursuit", "pursuits"],
  },
  {
    href: "/bid-schedule?section=active",
    label: "Bid Schedule · Active",
    keywords: ["active"],
  },
  {
    href: "/bid-schedule?section=upcoming",
    label: "Bid Schedule · Upcoming",
    keywords: ["upcoming"],
  },
  {
    href: "/bid-schedule?section=outstanding",
    label: "Bid Schedule · Outstanding",
    keywords: ["outstanding"],
  },
  {
    href: "/post-bid",
    label: "Post-Bid Entry",
    keywords: ["post", "post-bid", "entry", "data"],
  },
  {
    href: "/sheets",
    label: "Sheets",
    keywords: [
      "sheet",
      "sheets",
      "workspace",
      "folder",
      "grid",
      "smartsheet",
      "view",
    ],
  },
  {
    href: "/dashboards",
    label: "Dashboards",
    keywords: ["dashboard", "charts", "kpi", "metrics"],
  },
  {
    href: "/dashboards?level=corporate",
    label: "Dashboards · Corporate",
    keywords: ["corporate"],
  },
  {
    href: "/dashboards?level=region",
    label: "Dashboards · Region",
    keywords: ["region"],
  },
  {
    href: "/dashboards?level=division",
    label: "Dashboards · Division",
    keywords: ["division"],
  },
  {
    href: "/reports",
    label: "Report Builder",
    keywords: ["report", "reports", "export"],
  },
  {
    href: "/reports/annual",
    label: "Annual Regional Report",
    keywords: ["annual", "yearbook", "leadership", "yearly", "trend"],
  },
  {
    href: "/admin",
    label: "Admin",
    keywords: ["admin", "settings", "governance"],
  },
  {
    href: "/admin?tab=columns",
    label: "Admin · Data Columns",
    keywords: ["columns", "schema"],
  },
  {
    href: "/admin?tab=lists",
    label: "Admin · Reference Lists",
    keywords: ["lists", "reference"],
  },
  {
    href: "/admin?tab=audit",
    label: "Admin · Audit Log",
    keywords: ["audit", "log"],
  },
  {
    href: "/admin?tab=mcp",
    label: "Admin · MCP Access",
    keywords: ["mcp", "oauth", "ai", "claude", "cursor"],
  },
  {
    href: "/settings/connections",
    label: "AI connections",
    keywords: ["mcp", "ai", "claude", "cursor", "connections", "oauth"],
  },
  {
    href: "/admin?tab=integrations",
    label: "Admin · Integrations",
    keywords: ["integrations", "databricks", "salesforce"],
  },
] as const;

/** Strip LIKE wildcards so user input can't broaden the pattern. */
function sanitizeQuery(raw: string) {
  return raw
    .trim()
    .replace(/[%_\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function GET(request: Request) {
  const principal = await getWebPrincipal();
  const { searchParams } = new URL(request.url);
  const q = sanitizeQuery(searchParams.get("q") ?? "");
  if (q.length < 1) {
    return NextResponse.json({ pages: [], jobs: [], rounds: [] });
  }

  const pattern = `%${q}%`;
  const qLower = q.toLowerCase();
  const adminSections = await listAdminSectionsForPrincipal(principal);

  const pages = PAGES.filter(
    (page) => !page.href.startsWith("/admin") || adminSections.length > 0
  )
    .filter((p) => {
      if (p.label.toLowerCase().includes(qLower)) return true;
      return p.keywords.some((k) => k.includes(qLower) || qLower.includes(k));
    })
    .map(({ href, label }) => ({ href, label }));

  // Short queries: pages only until 2+ chars (avoid flooding with every job)
  if (q.length < 2) {
    return NextResponse.json({ pages, jobs: [], rounds: [], sheets: [] });
  }

  const [jobHits, roundHits, sheetHits] = await Promise.all([
    db
      .select({
        id: jobs.id,
        jobNumber: jobs.jobNumber,
        jobName: jobs.jobName,
        region: jobs.region,
        preconDepartment: jobs.preconDepartment,
      })
      .from(jobs)
      .where(
        and(
          isNull(jobs.deletedAt),
          principalJobVisibilityPredicate(jobs.id, principal),
          or(
            ilike(jobs.jobNumber, pattern),
            ilike(jobs.jobName, pattern),
            ilike(jobs.region, pattern),
            ilike(jobs.preconDepartment, pattern)
          )
        )
      )
      .orderBy(jobs.jobNumber)
      .limit(10),
    db
      .select({
        id: estimateRounds.id,
        jobNumber: jobs.jobNumber,
        jobName: jobs.jobName,
        estimatePhase: estimateRounds.estimatePhase,
        status: estimateRounds.status,
        region: estimateRounds.region,
        city: estimateRounds.city,
        state: estimateRounds.state,
        marketSector: estimateRounds.marketSector,
        preconDepartment: estimateRounds.preconDepartment,
        leadName: users.name,
      })
      .from(estimateRounds)
      .innerJoin(jobs, eq(jobs.id, estimateRounds.jobId))
      .leftJoin(users, eq(users.id, estimateRounds.estimateLeadId))
      .where(
        and(
          isNull(estimateRounds.deletedAt),
          isNull(jobs.deletedAt),
          principalJobVisibilityPredicate(jobs.id, principal),
          or(
            ilike(jobs.jobNumber, pattern),
            ilike(jobs.jobName, pattern),
            ilike(estimateRounds.estimatePhase, pattern),
            ilike(estimateRounds.city, pattern),
            ilike(estimateRounds.state, pattern),
            ilike(estimateRounds.region, pattern),
            ilike(estimateRounds.marketSector, pattern),
            ilike(estimateRounds.preconDepartment, pattern),
            sql`cast(${estimateRounds.status} as text) ilike ${pattern}`,
            ilike(users.name, pattern),
            sql`cast(${estimateRounds.id} as text) = ${q}`
          )
        )
      )
      .orderBy(jobs.jobNumber)
      .limit(12),
    searchSheetsForPrincipal(principal, pattern, 10),
  ]);

  return NextResponse.json({
    pages,
    sheets: sheetHits.map((s) => ({
      href: `/sheets/${s.id}`,
      label: s.name,
      hint: [
        s.region ?? "Corporate",
        s.folder,
        s.kind === "view" ? "pursuit view" : "standalone",
      ]
        .filter(Boolean)
        .join(" · "),
    })),
    jobs: jobHits.map((j) => ({
      href: `/jobs/${j.id}`,
      label: `${j.jobNumber} · ${j.jobName}`,
      hint: [j.region, j.preconDepartment].filter(Boolean).join(" · "),
    })),
    rounds: roundHits.map((r) => ({
      href: `/rounds/${r.id}`,
      label: `${r.jobNumber} · ${r.jobName}`,
      hint: [
        r.estimatePhase,
        r.status?.replaceAll("_", " "),
        r.city,
        r.state,
        r.leadName ? `Lead: ${r.leadName}` : null,
      ]
        .filter(Boolean)
        .join(" · "),
    })),
  });
}
