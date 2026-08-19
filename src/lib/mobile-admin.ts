import "server-only";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import {
  auditLog,
  customColumns,
  referenceListValues,
  salesforceMatchCandidates,
} from "@/db/schema";
import {
  type AdminSection,
  listAdminSectionsForPrincipal,
  loadAdminSectionForPrincipal,
} from "@/lib/authorization/loaders";
import type { Principal } from "@/lib/authorization/types";

/** Roles allowed to run administrative mutations through the mobile API. */
export const MOBILE_ADMIN_ROLES: ReadonlySet<string> = new Set([
  "corporate_admin",
  "rpd",
  "admin_jsa",
]);

export function isMobileAdminRole(role: string): boolean {
  return MOBILE_ADMIN_ROLES.has(role);
}

export const MOBILE_ADMIN_SECTION_LABELS: Record<AdminSection, string> = {
  columns: "Data Columns",
  promotions: "Field promotions",
  lists: "Reference Lists",
  review: "Needs review",
  notifications: "Notifications",
  distribution: "Distribution",
  salesforce: "Salesforce Inbox",
  tokens: "API tokens",
  people: "People",
  access: "Access",
  audit: "Audit Log",
  integrations: "Integrations",
  migration: "Migration",
  destini: "Destini import",
  quality: "Data quality",
  trash: "Trash",
  status: "Status",
  mcp: "MCP access",
};

export type MobileAdminQueries = {
  lists: () => Promise<unknown[]>;
  columns: () => Promise<unknown[]>;
  audit: () => Promise<unknown[]>;
  salesforce: () => Promise<unknown[]>;
};

const DEFAULT_ADMIN_QUERIES: MobileAdminQueries = {
  lists: () => db.select().from(referenceListValues),
  columns: () => db.select().from(customColumns),
  audit: () =>
    db.select().from(auditLog).orderBy(desc(auditLog.createdAt)).limit(100),
  salesforce: () => db.select().from(salesforceMatchCandidates).limit(100),
};

export async function readMobileAdminSection(
  principal: Principal,
  section: string,
  queries: MobileAdminQueries = DEFAULT_ADMIN_QUERIES
): Promise<
  { ok: true; payload: Record<string, unknown> } | { ok: false; status: 404 }
> {
  if (section === "index") {
    const allowed = await listAdminSectionsForPrincipal(principal);
    if (allowed.length === 0) return { ok: false, status: 404 };
    return {
      ok: true,
      payload: {
        sections: allowed.map((key) => ({
          key,
          label: MOBILE_ADMIN_SECTION_LABELS[key],
        })),
        role: principal.user.role,
      },
    };
  }

  if (!(await loadAdminSectionForPrincipal(principal, section))) {
    return { ok: false, status: 404 };
  }

  const query = queries[section as keyof MobileAdminQueries];
  return {
    ok: true,
    payload: query ? { data: await query() } : { section, data: [] },
  };
}
