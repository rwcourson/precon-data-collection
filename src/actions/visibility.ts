"use server";

import { revalidatePath } from "next/cache";
import {
  adoptJobVisibilitySchema,
  jobVisibilityRegionSchema,
  jobVisibilityUserSchema,
} from "@/domain/contracts";
import { getWebPrincipal } from "@/lib/authorization/web-principal";
import {
  principalCanAssignJobUser,
  principalCanManageJobRegion,
} from "@/lib/authorization/decisions";
import { listDirectoryUsersForPrincipal } from "@/lib/authorization/loaders";
import { REFERENCE_LISTS } from "@/lib/reference-data";
import { resolveCreatorHomeRegion } from "@/lib/home-region";
import { visibilityService } from "@/services/visibility-service";

function revalidateJob(jobId: number) {
  revalidatePath("/bid-schedule");
  revalidatePath(`/jobs/${jobId}`);
}

export async function getJobVisibility(jobId: number) {
  const principal = await getWebPrincipal();
  const listed = await visibilityService.listForJob(principal, jobId);
  const directory = principalCanAssignJobUser(principal)
    ? await listDirectoryUsersForPrincipal(principal)
    : [];
  return {
    homeRegion: listed.homeRegion,
    regions: listed.regions.map((row) => row.region),
    pins: listed.pins.map((row) => ({
      userId: row.userId,
      addedAt: row.addedAt.toISOString(),
    })),
    allRegions: REFERENCE_LISTS.region.values,
    ownRegion: principal.workspace.region ?? principal.user.region,
    canAssignUsers: principalCanAssignJobUser(principal),
    manageableRegions: REFERENCE_LISTS.region.values.filter((region) =>
      principalCanManageJobRegion(principal, region),
    ),
    directory: directory.map((user) => ({
      id: user.id,
      name: user.name,
      region: user.region,
      role: user.role,
    })),
  };
}

export async function addJobRegionVisibility(input: { jobId: number; region: string }) {
  const parsed = jobVisibilityRegionSchema.parse(input);
  const principal = await getWebPrincipal();
  const result = await visibilityService.addRegion(principal, parsed.jobId, parsed.region);
  revalidateJob(parsed.jobId);
  return result;
}

export async function removeJobRegionVisibility(input: { jobId: number; region: string }) {
  const parsed = jobVisibilityRegionSchema.parse(input);
  const principal = await getWebPrincipal();
  const result = await visibilityService.removeRegion(principal, parsed.jobId, parsed.region);
  revalidateJob(parsed.jobId);
  return result;
}

export async function addJobUserVisibility(input: { jobId: number; userId: number }) {
  const parsed = jobVisibilityUserSchema.parse(input);
  const principal = await getWebPrincipal();
  const result = await visibilityService.addUser(principal, parsed.jobId, parsed.userId);
  revalidateJob(parsed.jobId);
  return result;
}

export async function removeJobUserVisibility(input: { jobId: number; userId: number }) {
  const parsed = jobVisibilityUserSchema.parse(input);
  const principal = await getWebPrincipal();
  const result = await visibilityService.removeUser(principal, parsed.jobId, parsed.userId);
  revalidateJob(parsed.jobId);
  return result;
}

export async function showJobInMyRegion(input: { jobId: number }) {
  const parsed = adoptJobVisibilitySchema.parse(input);
  const principal = await getWebPrincipal();
  const region = resolveCreatorHomeRegion(principal, principal.user.region);
  const result = await visibilityService.addRegion(principal, parsed.jobId, region);
  revalidateJob(parsed.jobId);
  return { ...result, region };
}
