import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { auditLog, jobs } from "@/db/schema";
import { DomainError } from "@/domain/errors";
import { loadJobForPrincipal } from "@/lib/authorization/loaders";
import type { Principal } from "@/lib/authorization/types";

export async function setJobReportingFlags(
  principal: Principal,
  input: {
    jobId: number;
    hppFlag?: "hpp" | "not_hpp" | null;
    goNoGoFlag?: "go" | "no_go" | "pending" | null;
    ijvBoardFlag?: "ijv" | "not_ijv" | null;
  }
) {
  const loaded = await loadJobForPrincipal(principal, input.jobId, "edit");
  if (!loaded) throw DomainError.notFound("Job not found");
  const patch = {
    ...(input.hppFlag !== undefined ? { hppFlag: input.hppFlag } : {}),
    ...(input.goNoGoFlag !== undefined ? { goNoGoFlag: input.goNoGoFlag } : {}),
    ...(input.ijvBoardFlag !== undefined
      ? { ijvBoardFlag: input.ijvBoardFlag }
      : {}),
  };
  await db.update(jobs).set(patch).where(eq(jobs.id, input.jobId));
  await db.insert(auditLog).values({
    entity: "job",
    entityId: input.jobId,
    action: "reporting_flags_updated",
    field: "hpp/go-no-go/ijv",
    oldValue: `${loaded.value.hppFlag ?? ""}/${loaded.value.goNoGoFlag ?? ""}/${loaded.value.ijvBoardFlag ?? ""}`,
    newValue: `${input.hppFlag ?? loaded.value.hppFlag ?? ""}/${input.goNoGoFlag ?? loaded.value.goNoGoFlag ?? ""}/${input.ijvBoardFlag ?? loaded.value.ijvBoardFlag ?? ""}`,
    userId: principal.user.id,
  });
}
