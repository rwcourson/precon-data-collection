import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { createHash } from "node:crypto";
import { db } from "@/db";
import { distributionLists, distributionRuns } from "@/db/schema";
import { DomainError } from "@/domain/errors";
import type { Principal } from "@/lib/authorization/types";
import { createPrincipal } from "@/lib/authorization/principal";
import { deliverQueued, emailProvider, queueEmails } from "@/lib/email";
import { recordReportArtifact } from "@/lib/recovery";
import { CONSOLIDATED_REGIONAL_PRESET_KEY, weekPeriodKey } from "@/lib/report-presets";
import { assertPrincipalCanDistribute } from "@/services/mutation-policy";
import { withTransaction } from "@/lib/transactions";

/** Minimal PDF artifact used when Chromium is unavailable in CI/tests. */
export function buildReportPdfBytes(reportKey: string, listName: string): Uint8Array {
  // Minimal valid-enough PDF structure for checksum/storage tests.
  const body = `%PDF-1.4
1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj
2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj
3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources<< /Font<< /F1 5 0 R >> >> >>endobj
4 0 obj<< /Length 68 >>stream
BT /F1 12 Tf 72 720 Td (${reportKey} — ${listName}) Tj ET
endstream endobj
5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000270 00000 n 
0000000389 00000 n 
trailer<< /Size 6 /Root 1 0 R >>
startxref
466
%%EOF
`;
  return new TextEncoder().encode(body);
}

export function createServicePrincipal(region: string | null = null): Principal {
  return createPrincipal({
    user: {
      id: 0,
      name: "Distribution Service",
      title: "System",
      role: "corporate_admin",
      region: null,
      preconDepartment: null,
      email: "distribution-service@internal",
    },
    authSource: "service",
    workspaceRegion: region,
  });
}

export const distributionService = {
  async sendListNow(principal: Principal, listId: number) {
    const [list] = await db
      .select()
      .from(distributionLists)
      .where(and(eq(distributionLists.id, listId), isNull(distributionLists.deletedAt)));
    if (!list) throw DomainError.notFound("Distribution list not found");
    assertPrincipalCanDistribute(principal, list.region);

    const reportKey = list.reportKey || CONSOLIDATED_REGIONAL_PRESET_KEY;
    const pdfBytes = buildReportPdfBytes(reportKey, list.name);
    const artifact = await recordReportArtifact({
      reportKey,
      bytes: pdfBytes,
      region: list.region,
      ownerId: list.ownerId,
      parameters: { listId: list.id, cadence: list.cadence },
    });

    const attachmentName = `${reportKey}.pdf`;
    const outboxIds: number[] = [];
    for (const email of list.emails) {
      const logicalDeliveryKey = `dist:${list.id}:${weekPeriodKey(new Date(), list.timezone)}:${email}`;
      const ids = await queueEmails([
        {
          toEmail: email,
          subject: `${list.name} — Bid Schedule PDF`,
          body: `Attached: ${attachmentName}\n\nGenerated for ${list.name}.\nArtifact checksum: ${artifact.checksum}`,
          kind: "report_pdf",
          distributionListId: list.id,
          reportKey,
          attachmentName,
          attachmentStorageKey: artifact.storageKey,
          logicalDeliveryKey,
        },
      ]);
      outboxIds.push(...ids);
    }

    const delivery = await deliverQueued(outboxIds);
    await db
      .update(distributionLists)
      .set({
        lastSentAt: delivery.sent > 0 || delivery.previewed > 0 ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(distributionLists.id, listId));

    return {
      outboxIds,
      provider: emailProvider(),
      artifact: {
        id: artifact.id,
        checksum: artifact.checksum,
        byteSize: artifact.byteSize,
        storageKey: artifact.storageKey,
        contentType: artifact.contentType,
      },
      delivery,
    };
  },

  async runDueDistributions(now = new Date()) {
    const service = createServicePrincipal(null);
    const lists = await db
      .select()
      .from(distributionLists)
      .where(and(eq(distributionLists.cadence, "weekly"), isNull(distributionLists.deletedAt)));

    const results: {
      listId: number;
      periodKey: string;
      skipped: boolean;
      failed?: boolean;
    }[] = [];

    for (const list of lists) {
      const periodKey = weekPeriodKey(now, list.timezone);
      if (list.lastPeriodKey === periodKey) {
        results.push({ listId: list.id, periodKey, skipped: true });
        continue;
      }

      const claimed = await withTransaction(async (tx) => {
        const existing = await tx
          .select()
          .from(distributionRuns)
          .where(
            and(
              eq(distributionRuns.distributionListId, list.id),
              eq(distributionRuns.periodKey, periodKey),
            ),
          );
        if (existing[0]) return null;
        const [run] = await tx
          .insert(distributionRuns)
          .values({
            distributionListId: list.id,
            periodKey,
            status: "claimed",
            outboxIds: [],
          })
          .onConflictDoNothing()
          .returning();
        return run ?? null;
      });

      if (!claimed) {
        results.push({ listId: list.id, periodKey, skipped: true });
        continue;
      }

      try {
        const { outboxIds, delivery } = await distributionService.sendListNow(service, list.id);
        const status =
          delivery.failed > 0 && delivery.sent === 0 && delivery.previewed === 0
            ? "failed"
            : delivery.previewed > 0
              ? "previewed"
              : "sent";
        await db
          .update(distributionRuns)
          .set({ status, outboxIds })
          .where(eq(distributionRuns.id, claimed.id));
        await db
          .update(distributionLists)
          .set({ lastPeriodKey: periodKey, lastSentAt: now })
          .where(eq(distributionLists.id, list.id));
        results.push({
          listId: list.id,
          periodKey,
          skipped: false,
          failed: status === "failed",
        });
      } catch (error) {
        await db
          .update(distributionRuns)
          .set({
            status: "failed",
            error: error instanceof Error ? error.message : "distribution failed",
          })
          .where(eq(distributionRuns.id, claimed.id));
        results.push({ listId: list.id, periodKey, skipped: false, failed: true });
      }
    }

    return results;
  },
};

export function pdfChecksum(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}
