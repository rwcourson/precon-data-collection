import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { reportArtifacts } from "@/db/schema";
import { recordReportArtifact } from "@/lib/recovery";
import type { Principal } from "@/lib/authorization/types";

export type ExportJob = {
  id: string;
  status: "queued" | "running" | "completed" | "failed";
  reportKey: string;
  rowEstimate: number;
  artifactId?: number;
  error?: string;
};

const jobs = new Map<string, ExportJob>();

/** Synchronous export threshold — larger jobs must go async. */
export const SYNC_EXPORT_ROW_LIMIT = 2000;
export const SYNC_EXPORT_BYTE_LIMIT = 25 * 1024 * 1024;

export function shouldExportAsync(rowEstimate: number, estimatedBytes: number): boolean {
  return rowEstimate > SYNC_EXPORT_ROW_LIMIT || estimatedBytes > SYNC_EXPORT_BYTE_LIMIT;
}

export async function enqueueExportJob(input: {
  principal: Principal;
  reportKey: string;
  rowEstimate: number;
  build: () => Promise<Uint8Array>;
}): Promise<ExportJob> {
  const id = `export-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const job: ExportJob = {
    id,
    status: "queued",
    reportKey: input.reportKey,
    rowEstimate: input.rowEstimate,
  };
  jobs.set(id, job);

  // Local/demo runner executes immediately; production would claim via worker.
  job.status = "running";
  try {
    const bytes = await input.build();
    const artifact = await recordReportArtifact({
      reportKey: input.reportKey,
      bytes,
      ownerId: input.principal.user.id,
      region: input.principal.workspace.region,
      parameters: { jobId: id, rowEstimate: input.rowEstimate },
    });
    job.status = "completed";
    job.artifactId = artifact.id;
  } catch (error) {
    job.status = "failed";
    job.error = error instanceof Error ? error.message : "export failed";
  }
  jobs.set(id, job);
  return job;
}

export function getExportJob(id: string): ExportJob | null {
  return jobs.get(id) ?? null;
}

export async function getExportArtifact(jobId: string) {
  const job = jobs.get(jobId);
  if (!job?.artifactId) return null;
  const [row] = await db
    .select()
    .from(reportArtifacts)
    .where(eq(reportArtifacts.id, job.artifactId));
  return row ?? null;
}
