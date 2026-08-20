"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getWebPrincipal } from "@/lib/authorization/web-principal";
import { setJobReportingFlags } from "@/services/job-flags-service";

const schema = z.object({
  jobId: z.number().int().positive(),
  hppFlag: z.enum(["hpp", "not_hpp"]).nullable().optional(),
  goNoGoFlag: z.enum(["go", "no_go", "pending"]).nullable().optional(),
  ijvBoardFlag: z.enum(["ijv", "not_ijv"]).nullable().optional(),
});

export async function updateJobFlags(raw: unknown) {
  const input = schema.parse(raw);
  const principal = await getWebPrincipal();
  await setJobReportingFlags(principal, input);
  revalidatePath(`/jobs/${input.jobId}`);
  revalidatePath("/bid-schedule");
}
