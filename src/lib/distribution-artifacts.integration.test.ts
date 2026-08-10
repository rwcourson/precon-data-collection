import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, ensureDbReady } from "@/db";
import { distributionLists, distributionRuns, emailOutbox, users } from "@/db/schema";
import { createPrincipal } from "@/lib/authorization/principal";
import {
  buildReportPdfBytes,
  createServicePrincipal,
  distributionService,
  pdfChecksum,
} from "@/services/distribution-service";
import { deliverQueued, emailProvider, queueEmails } from "@/lib/email";

let rpd: typeof users.$inferSelect;

beforeAll(async () => {
  await ensureDbReady();
  [rpd] = await db.select().from(users).where(eq(users.role, "rpd")).limit(1);
  if (!rpd) throw new Error("rpd seed missing");
});

describe("distribution artifacts and outbox", () => {
  it("generates a real PDF artifact and never marks stub delivery as sent", async () => {
    expect(emailProvider()).toBe("stub");
    const pdf = buildReportPdfBytes("bid-schedule", "Weekly");
    expect(pdf.byteLength).toBeGreaterThan(50);
    expect(pdfChecksum(pdf)).toHaveLength(64);

    const [list] = await db
      .insert(distributionLists)
      .values({
        name: `Artifact list ${Date.now()}`,
        region: rpd.region,
        emails: ["preview@example.com"],
        cadence: "manual",
        reportKey: "bid-schedule",
        timezone: "America/Chicago",
        ownerId: rpd.id,
      })
      .returning();

    const principal = createPrincipal({
      user: rpd,
      authSource: "demo_session",
      workspaceRegion: rpd.region,
    });
    const result = await distributionService.sendListNow(principal, list.id);
    expect(result.artifact.checksum).toHaveLength(64);
    expect(result.artifact.byteSize).toBeGreaterThan(50);
    expect(result.artifact.contentType).toBe("application/pdf");
    expect(result.delivery.previewed).toBeGreaterThan(0);
    expect(result.delivery.sent).toBe(0);

    for (const id of result.outboxIds) {
      const [row] = await db.select().from(emailOutbox).where(eq(emailOutbox.id, id));
      expect(row?.status).toBe("previewed");
      expect(row?.sentAt).toBeNull();
      expect(row?.attachmentStorageKey).toBeTruthy();
    }

    await db.delete(emailOutbox).where(eq(emailOutbox.distributionListId, list.id));
    await db.delete(distributionLists).where(eq(distributionLists.id, list.id));
  });

  it("runs scheduled distribution through a service principal without cookies", async () => {
    const service = createServicePrincipal(null);
    expect(service.authSource).toBe("service");
    expect(service.user.role).toBe("corporate_admin");

    const [list] = await db
      .insert(distributionLists)
      .values({
        name: `Cron list ${Date.now()}`,
        region: rpd.region,
        emails: ["cron@example.com"],
        cadence: "weekly",
        reportKey: "bid-schedule",
        timezone: "America/Chicago",
        ownerId: rpd.id,
      })
      .returning();

    const first = await distributionService.runDueDistributions(new Date("2026-08-10T15:00:00Z"));
    const mine = first.find((row) => row.listId === list.id);
    expect(mine?.skipped).toBe(false);

    const second = await distributionService.runDueDistributions(new Date("2026-08-10T16:00:00Z"));
    const again = second.find((row) => row.listId === list.id);
    expect(again?.skipped).toBe(true);

    await db.delete(emailOutbox).where(eq(emailOutbox.distributionListId, list.id));
    await db.delete(distributionRuns).where(eq(distributionRuns.distributionListId, list.id));
    await db.delete(distributionLists).where(eq(distributionLists.id, list.id));
  });

  it("records failed deliveries as failed not sent", async () => {
    const ids = await queueEmails([
      {
        toEmail: "fail@example.com",
        subject: "x",
        body: "y",
        kind: "report_pdf",
      },
    ]);
    const delivery = await deliverQueued(ids);
    expect(delivery.previewed).toBe(1);
    expect(delivery.sent).toBe(0);
    const [row] = await db.select().from(emailOutbox).where(eq(emailOutbox.id, ids[0]!));
    expect(row?.status).toBe("previewed");
    expect(row?.sentAt).toBeNull();
    await db.delete(emailOutbox).where(eq(emailOutbox.id, ids[0]!));
  });
});
