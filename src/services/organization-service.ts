import "server-only";
import { and, asc, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import {
  groupEditPolicies,
  jobGroupMemberships,
  jobRelationships,
  jobs,
  organizationGroups,
  type Role,
} from "@/db/schema";
import { DomainError } from "@/domain/errors";
import { loadJobForPrincipal } from "@/lib/authorization/loaders";
import type { Principal } from "@/lib/authorization/types";
import { parentWouldCycle } from "@/lib/job-parent";
import { withTransaction } from "@/lib/transactions";

export async function listOrganizationGroups() {
  return db
    .select()
    .from(organizationGroups)
    .where(eq(organizationGroups.active, true))
    .orderBy(asc(organizationGroups.region), asc(organizationGroups.name));
}

export async function listJobGroupMemberships(jobId: number) {
  return db
    .select({
      id: jobGroupMemberships.id,
      groupId: organizationGroups.id,
      key: organizationGroups.key,
      name: organizationGroups.name,
      kind: organizationGroups.kind,
      region: organizationGroups.region,
      participationRole: jobGroupMemberships.participationRole,
      discipline: jobGroupMemberships.discipline,
    })
    .from(jobGroupMemberships)
    .innerJoin(
      organizationGroups,
      eq(organizationGroups.id, jobGroupMemberships.groupId)
    )
    .where(eq(jobGroupMemberships.jobId, jobId))
    .orderBy(asc(organizationGroups.name));
}

export async function setJobGroupMembership(
  principal: Principal,
  input: {
    jobId: number;
    groupId: number;
    enabled: boolean;
    participationRole?: "lead" | "partner" | "visibility";
    discipline?: "preconstruction" | "operations";
  }
) {
  const loaded = await loadJobForPrincipal(principal, input.jobId, "edit");
  if (!loaded) throw DomainError.notFound("Job not found");
  const [group] = await db
    .select()
    .from(organizationGroups)
    .where(
      and(
        eq(organizationGroups.id, input.groupId),
        eq(organizationGroups.active, true)
      )
    );
  if (!group) throw DomainError.notFound("Organization group not found");
  await withTransaction(async (tx) => {
    if (!input.enabled) {
      await tx
        .delete(jobGroupMemberships)
        .where(
          and(
            eq(jobGroupMemberships.jobId, input.jobId),
            eq(jobGroupMemberships.groupId, input.groupId)
          )
        );
      const remaining = await tx
        .select({
          id: jobGroupMemberships.id,
          participationRole: jobGroupMemberships.participationRole,
        })
        .from(jobGroupMemberships)
        .where(eq(jobGroupMemberships.jobId, input.jobId));
      if (
        remaining.length > 0 &&
        remaining.every((row) => row.participationRole !== "lead")
      ) {
        await tx
          .update(jobGroupMemberships)
          .set({ participationRole: "lead" })
          .where(eq(jobGroupMemberships.id, remaining[0]!.id));
      }
      return;
    }
    const role = input.participationRole ?? "partner";
    await tx
      .insert(jobGroupMemberships)
      .values({
        jobId: input.jobId,
        groupId: input.groupId,
        participationRole: role,
        discipline: input.discipline ?? "preconstruction",
        addedById: principal.user.id,
      })
      .onConflictDoUpdate({
        target: [jobGroupMemberships.jobId, jobGroupMemberships.groupId],
        set: {
          participationRole: role,
          discipline: input.discipline ?? "preconstruction",
          addedById: principal.user.id,
        },
      });
    if (role === "lead") {
      await tx
        .update(jobGroupMemberships)
        .set({ participationRole: "partner" })
        .where(
          and(
            eq(jobGroupMemberships.jobId, input.jobId),
            ne(jobGroupMemberships.groupId, input.groupId)
          )
        );
    }
  });
}

export async function setParentJob(
  principal: Principal,
  input: {
    childJobId: number;
    parentJobId: number | null;
    kind?: "sub_job" | "tenant_improvement";
  }
) {
  const loaded = await loadJobForPrincipal(principal, input.childJobId, "edit");
  if (!loaded) throw DomainError.notFound("Child job not found");
  await db
    .delete(jobRelationships)
    .where(eq(jobRelationships.childJobId, input.childJobId));
  if (input.parentJobId == null) return;
  if (input.parentJobId === input.childJobId)
    throw DomainError.badRequest("A job cannot be its own parent.");
  const [parent] = await db
    .select({ id: jobs.id })
    .from(jobs)
    .where(eq(jobs.id, input.parentJobId));
  if (!parent) throw DomainError.notFound("Parent job not found");
  const relationships = await db.select().from(jobRelationships);
  const parents = new Map(
    relationships.map((relationship) => [
      relationship.childJobId,
      relationship.parentJobId,
    ])
  );
  if (parentWouldCycle(input.childJobId, input.parentJobId, parents)) {
    throw DomainError.badRequest("That parent would create a job cycle.");
  }
  await db.insert(jobRelationships).values({
    parentJobId: input.parentJobId,
    childJobId: input.childJobId,
    kind: input.kind ?? "sub_job",
    createdById: principal.user.id,
  });
}

export async function listJobRelationship(jobId: number) {
  const [asChild] = await db
    .select()
    .from(jobRelationships)
    .where(eq(jobRelationships.childJobId, jobId));
  const children = await db
    .select()
    .from(jobRelationships)
    .where(eq(jobRelationships.parentJobId, jobId));
  return { parent: asChild ?? null, children };
}

export async function listChildJobIds() {
  const rows = await db
    .select({ childJobId: jobRelationships.childJobId })
    .from(jobRelationships);
  return rows.map((row) => row.childJobId);
}

export async function listGroupEditPolicies() {
  return db
    .select({
      id: groupEditPolicies.id,
      groupId: groupEditPolicies.groupId,
      role: groupEditPolicies.role,
      mode: groupEditPolicies.mode,
      groupName: organizationGroups.name,
      groupRegion: organizationGroups.region,
    })
    .from(groupEditPolicies)
    .innerJoin(
      organizationGroups,
      eq(organizationGroups.id, groupEditPolicies.groupId)
    )
    .orderBy(
      asc(organizationGroups.region),
      asc(organizationGroups.name),
      asc(groupEditPolicies.role)
    );
}

export async function setGroupEditPolicy(
  principal: Principal,
  input: { groupId: number; role: Role; mode: "direct" | "propose" | "read" }
) {
  if (principal.user.role !== "corporate_admin") {
    throw DomainError.forbidden(
      "Only Corporate Precon Admin can set group edit policy."
    );
  }
  const [group] = await db
    .select({ id: organizationGroups.id })
    .from(organizationGroups)
    .where(eq(organizationGroups.id, input.groupId));
  if (!group) throw DomainError.notFound("Organization group not found");
  await db
    .insert(groupEditPolicies)
    .values({
      groupId: input.groupId,
      role: input.role,
      mode: input.mode,
      updatedById: principal.user.id,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [groupEditPolicies.groupId, groupEditPolicies.role],
      set: {
        mode: input.mode,
        updatedById: principal.user.id,
        updatedAt: new Date(),
      },
    });
}
