import {
  addCustomColumn,
  addReferenceValue,
  deleteCustomColumn,
  setReferenceValueRetired,
} from "@/actions/admin";
import { createApiToken, revokeApiToken } from "@/actions/api-tokens";
import { saveAccessSettings } from "@/actions/access";
import {
  confirmDestiniImport,
  previewDestiniCsvText,
} from "@/actions/destini";
import {
  deleteDistributionList,
  sendDistributionNow,
  upsertDistributionList,
} from "@/actions/distribution";
import {
  probeSmartsheetRead,
  probeWarehouseRead,
  runWarehouseFeed,
} from "@/actions/integrations";
import {
  decideMatchCandidate,
  runSalesforceSync,
} from "@/actions/salesforce-inbox";
import {
  confirmLegacyBaseline,
  resolveFlag,
  rescanDataQuality,
} from "@/actions/data-quality";
import {
  proposeFieldPromotion,
  reviewFieldPromotion,
} from "@/actions/governance";
import { saveNotificationSettings } from "@/actions/notifications-settings";
import { db } from "@/db";
import {
  auditLog,
  customColumns,
  salesforceMatchCandidates,
  referenceListValues,
} from "@/db/schema";
import { jsonError, jsonOk, mapError, withMobileAuth } from "@/lib/mobile-http";
import { canManageReferenceLists } from "@/lib/permissions";
import { desc } from "drizzle-orm";

/** Roles allowed to run admin mutations from the mobile API. */
export const MOBILE_ADMIN_ROLES = new Set([
  "corporate_admin",
  "rpd",
  "admin_jsa",
]);

export function isMobileAdminRole(role: string): boolean {
  return MOBILE_ADMIN_ROLES.has(role);
}

export async function GET(req: Request) {
  return withMobileAuth(req, async (principal) => {
    const section = new URL(req.url).searchParams.get("section") ?? "index";
    const user = principal.user;

    if (section === "index") {
      return jsonOk({
        sections: [
          { key: "columns", label: "Data Columns" },
          { key: "lists", label: "Reference Lists" },
          { key: "audit", label: "Audit Log" },
          { key: "integrations", label: "Integrations" },
          { key: "salesforce", label: "Salesforce Inbox" },
          { key: "distribution", label: "Distribution" },
          { key: "destini", label: "Destini import" },
          { key: "trash", label: "Trash" },
          { key: "access", label: "Access & tokens" },
          { key: "notifications", label: "Notifications" },
          { key: "quality", label: "Data quality" },
          { key: "promotions", label: "Field promotions" },
        ],
        role: user.role,
      });
    }

    if (section === "lists") {
      const rows = await db.select().from(referenceListValues);
      return jsonOk({ data: rows });
    }
    if (section === "columns") {
      const rows = await db.select().from(customColumns);
      return jsonOk({ data: rows });
    }
    if (section === "audit") {
      const rows = await db
        .select()
        .from(auditLog)
        .orderBy(desc(auditLog.createdAt))
        .limit(100);
      return jsonOk({ data: rows });
    }
    if (section === "salesforce") {
      const rows = await db.select().from(salesforceMatchCandidates).limit(100);
      return jsonOk({ data: rows ?? [] });
    }

    return jsonOk({ section, data: [] });
  });
}

export async function POST(req: Request) {
  return withMobileAuth(req, async (principal) => {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return jsonError("Invalid JSON", 400);
    }
    const action = String(body.action ?? "");

    try {
      // Mutations that require admin — enforce early for non-admin 403 proof
      const adminActions = new Set([
        "add-reference",
        "retire-reference",
        "add-column",
        "delete-column",
        "access",
        "create-token",
        "revoke-token",
        "warehouse",
        "probe-warehouse",
        "probe-smartsheet",
        "destini-confirm",
        "distribution-upsert",
        "distribution-delete",
        "distribution-send",
        "sf-sync",
        "sf-decide",
        "quality-rescan",
        "quality-resolve",
        "quality-baseline",
        "promote",
        "review-promotion",
        "notification-settings",
      ]);

      if (adminActions.has(action) && !isMobileAdminRole(principal.user.role)) {
        return jsonError("Permission denied: admin access required", 403, {
          code: "FORBIDDEN",
        });
      }

      switch (action) {
        case "add-reference": {
          if (!canManageReferenceLists(principal.user)) {
            return jsonError(
              "Only the Corporate Precon Admin manages company-wide reference lists",
              403,
              { code: "FORBIDDEN" },
            );
          }
          await addReferenceValue(String(body.listKey), String(body.value));
          return jsonOk({ ok: true });
        }
        case "retire-reference": {
          await setReferenceValueRetired(Number(body.id), Boolean(body.retired));
          return jsonOk({ ok: true });
        }
        case "add-column": {
          await addCustomColumn(body as Parameters<typeof addCustomColumn>[0]);
          return jsonOk({ ok: true });
        }
        case "delete-column": {
          await deleteCustomColumn(Number(body.id));
          return jsonOk({ ok: true });
        }
        case "create-token": {
          const result = await createApiToken(body);
          return jsonOk({ result });
        }
        case "revoke-token": {
          await revokeApiToken(Number(body.id));
          return jsonOk({ ok: true });
        }
        case "access": {
          await saveAccessSettings(body as Parameters<typeof saveAccessSettings>[0]);
          return jsonOk({ ok: true });
        }
        case "warehouse": {
          const result = await runWarehouseFeed(Boolean(body.previewOnly ?? true));
          return jsonOk({ result });
        }
        case "probe-warehouse": {
          return jsonOk({ result: await probeWarehouseRead() });
        }
        case "probe-smartsheet": {
          return jsonOk({ result: await probeSmartsheetRead() });
        }
        case "destini-preview": {
          const preview = await previewDestiniCsvText(String(body.text ?? ""));
          return jsonOk({ preview });
        }
        case "destini-confirm": {
          const result = await confirmDestiniImport(
            body as Parameters<typeof confirmDestiniImport>[0],
          );
          return jsonOk({ result });
        }
        case "distribution-upsert": {
          const result = await upsertDistributionList(body);
          return jsonOk({ result });
        }
        case "distribution-delete": {
          await deleteDistributionList(Number(body.id));
          return jsonOk({ ok: true });
        }
        case "distribution-send": {
          const result = await sendDistributionNow(Number(body.id));
          return jsonOk({ result });
        }
        case "sf-sync": {
          return jsonOk({ result: await runSalesforceSync() });
        }
        case "sf-decide": {
          await decideMatchCandidate(
            Number(body.id),
            body.decision as "approve" | "reject" | "dismiss",
            body.note as string | undefined,
          );
          return jsonOk({ ok: true });
        }
        case "quality-rescan": {
          return jsonOk({ result: await rescanDataQuality() });
        }
        case "quality-resolve": {
          await resolveFlag(Number(body.id), String(body.note ?? ""));
          return jsonOk({ ok: true });
        }
        case "quality-baseline": {
          return jsonOk({ result: await confirmLegacyBaseline() });
        }
        case "promote": {
          await proposeFieldPromotion(Number(body.columnId), body.note as string | undefined);
          return jsonOk({ ok: true });
        }
        case "review-promotion": {
          await reviewFieldPromotion(
            Number(body.id),
            body.decision as Parameters<typeof reviewFieldPromotion>[1],
          );
          return jsonOk({ ok: true });
        }
        case "notification-settings": {
          await saveNotificationSettings(
            body as Parameters<typeof saveNotificationSettings>[0],
          );
          return jsonOk({ ok: true });
        }
        default:
          return jsonError(`Unknown admin action: ${action}`, 400);
      }
    } catch (err) {
      return mapError(err);
    }
  });
}
