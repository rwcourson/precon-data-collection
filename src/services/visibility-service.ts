import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  auditLog,
  jobRegionVisibility,
  jobs,
  jobUserVisibility,
  users,
} from "@/db/schema";
import { DomainError } from "@/domain/errors";
import { loadJobForPrincipal } from "@/lib/authorization/loaders";
import type { Principal } from "@/lib/authorization/types";
import { requireAuthorized } from "@/services/mutation-policy";

async function loadJobRow(jobId: number) {
  const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);
  if (!job || job.deletedAt) throw DomainError.notFound("Job not found");
  return job;
}

function jobDescriptor(job: typeof jobs.$inferSelect, region: string | null) {
  return {
    type: "job" as const,
    id: job.id,
    region,
    ownerId: job.createdById,
    published: true,
    deleted: false,
  };
}

/** Insert the home-region visibility row (idempotent). Used by create + seed. */
export async function recordHomeRegionVisibility(
  tx: Pick<typeof db, "insert">,
  job: { id: number; region: string; createdById: number | null }
): Promise<void> {
  await tx
    .insert(jobRegionVisibility)
    .values({
      jobId: job.id,
      region: job.region,
      addedById: job.createdById,
    })
    .onConflictDoNothing();
}

/** Transport-neutral visibility mutations — caller supplies an explicit Principal. */
export const visibilityService = {
  async listForJob(principal: Principal, jobId: number) {
    const loaded = await loadJobForPrincipal(principal, jobId, "read");
    if (!loaded) throw DomainError.notFound("Job not found");
    const job = loaded.value;
    const [regions, pins] = await Promise.all([
      db
        .select()
        .from(jobRegionVisibility)
        .where(eq(jobRegionVisibility.jobId, jobId)),
      db
        .select({
          userId: jobUserVisibility.userId,
          addedAt: jobUserVisibility.addedAt,
          name: users.name,
          title: users.title,
          region: users.region,
        })
        .from(jobUserVisibility)
        .innerJoin(users, eq(jobUserVisibility.userId, users.id))
        .where(eq(jobUserVisibility.jobId, jobId)),
    ]);
    return { job, homeRegion: job.region, regions, pins };
  },

  async addRegion(principal: Principal, jobId: number, region: string) {
    const job = await loadJobRow(jobId);
    const target = region.trim();
    if (!target) throw DomainError.badRequest("Region is required");
    requireAuthorized(
      principal,
      "visibility.manage-region",
      jobDescriptor(job, target),
      "Job visibility"
    );
    const [row] = await db
      .insert(jobRegionVisibility)
      .values({
        jobId: job.id,
        region: target,
        addedById: principal.user.id,
      })
      .onConflictDoNothing()
      .returning();
    if (row) {
      await db.insert(auditLog).values({
        entity: "job",
        entityId: job.id,
        action: "visibility.add_region",
        field: "region",
        oldValue: null,
        newValue: target,
        userId: principal.user.id,
      });
    }
    return { added: Boolean(row), region: target };
  },

  async removeRegion(principal: Principal, jobId: number, region: string) {
    const job = await loadJobRow(jobId);
    const target = region.trim();
    if (target === job.region) {
      throw DomainError.badRequest("Cannot remove the home region");
    }
    requireAuthorized(
      principal,
      "visibility.manage-region",
      jobDescriptor(job, target),
      "Job visibility"
    );
    const deleted = await db
      .delete(jobRegionVisibility)
      .where(
        and(
          eq(jobRegionVisibility.jobId, job.id),
          eq(jobRegionVisibility.region, target)
        )
      )
      .returning({ id: jobRegionVisibility.id });
    if (deleted.length > 0) {
      await db.insert(auditLog).values({
        entity: "job",
        entityId: job.id,
        action: "visibility.remove_region",
        field: "region",
        oldValue: target,
        newValue: null,
        userId: principal.user.id,
      });
    }
    return { removed: deleted.length > 0, region: target };
  },

  async addUser(principal: Principal, jobId: number, userId: number) {
    const job = await loadJobRow(jobId);
    requireAuthorized(
      principal,
      "visibility.assign-user",
      jobDescriptor(job, job.region),
      "Job visibility"
    );
    const [targetUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!targetUser) throw DomainError.notFound("User not found");
    const [row] = await db
      .insert(jobUserVisibility)
      .values({
        jobId: job.id,
        userId,
        addedById: principal.user.id,
      })
      .onConflictDoNothing()
      .returning();
    if (row) {
      await db.insert(auditLog).values({
        entity: "job",
        entityId: job.id,
        action: "visibility.add_user",
        field: "user",
        oldValue: null,
        newValue: String(userId),
        userId: principal.user.id,
      });
    }
    return { added: Boolean(row), userId };
  },

  async removeUser(principal: Principal, jobId: number, userId: number) {
    const job = await loadJobRow(jobId);
    requireAuthorized(
      principal,
      "visibility.assign-user",
      jobDescriptor(job, job.region),
      "Job visibility"
    );
    const deleted = await db
      .delete(jobUserVisibility)
      .where(
        and(
          eq(jobUserVisibility.jobId, job.id),
          eq(jobUserVisibility.userId, userId)
        )
      )
      .returning({ id: jobUserVisibility.id });
    if (deleted.length > 0) {
      await db.insert(auditLog).values({
        entity: "job",
        entityId: job.id,
        action: "visibility.remove_user",
        field: "user",
        oldValue: String(userId),
        newValue: null,
        userId: principal.user.id,
      });
    }
    return { removed: deleted.length > 0, userId };
  },
};
