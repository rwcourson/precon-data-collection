"use server";

import { revalidatePath } from "next/cache";
import { DomainError } from "@/domain/errors";
import { getWebPrincipal } from "@/lib/authorization/web-principal";
import type { OutcomeValue } from "@/lib/outcome";
import { approvalService } from "@/services/approval-service";
import { finalizeRound } from "@/services/finalize-round";
import {
  pursuitService,
  type SavePostBidInput,
} from "@/services/pursuit-service";
import { roundtableFeatureEnabled } from "@/services/rollout-service";

export type SaveInput = SavePostBidInput;

export async function savePostBidData(input: SaveInput) {
  const principal = await getWebPrincipal();
  const approvalEnabled = await roundtableFeatureEnabled(
    principal,
    "approvalWorkflow"
  );
  const mode = approvalEnabled
    ? await approvalService.writeModeForRound(principal, input.roundId)
    : "direct";
  if (mode === "read") {
    throw DomainError.forbidden("This role cannot edit published rounds.");
  }
  const result =
    mode === "propose"
      ? {
          changed: 0,
          audited: 0,
          pendingApproval: true as const,
          requestId: (await approvalService.requestEdit(principal, input)).id,
        }
      : await pursuitService.savePostBidData(principal, input);
  revalidatePath(`/rounds/${input.roundId}`);
  revalidatePath("/post-bid");
  revalidatePath("/bid-schedule");
  return result;
}

/**
 * Single-cell edit from a sheet grid. Delegates to the same service path as the
 * full post-bid form so sheet cells are not a different rulebook.
 */
export async function updateRoundCell(
  roundId: number,
  key: string,
  value: string,
  expectedUpdatedAt?: string | Date | null
) {
  const principal = await getWebPrincipal();
  const approvalEnabled = await roundtableFeatureEnabled(
    principal,
    "approvalWorkflow"
  );
  const mode = approvalEnabled
    ? await approvalService.writeModeForRound(principal, roundId)
    : "direct";
  if (mode === "read") {
    throw DomainError.forbidden("This role cannot edit published rounds.");
  }
  const result =
    mode === "propose"
      ? {
          changed: 0,
          audited: 0,
          pendingApproval: true as const,
          requestId: (
            await approvalService.requestEdit(principal, {
              roundId,
              values: { [key]: value },
              multiValues: {},
              customValues: {},
              expectedUpdatedAt,
            })
          ).id,
        }
      : await pursuitService.updateRoundCell(
          principal,
          roundId,
          key,
          value,
          expectedUpdatedAt
        );
  revalidatePath(`/rounds/${roundId}`);
  revalidatePath("/post-bid");
  revalidatePath("/bid-schedule");
  return result;
}

/** RPD approval: validates required completeness, then locks via the finalize seam. */
export async function approveAndLock(roundId: number) {
  const principal = await getWebPrincipal();
  const result = await finalizeRound(roundId, principal);
  revalidatePath(`/rounds/${roundId}`);
  revalidatePath("/post-bid");
  return result;
}

/** Record the pursuit outcome (Successful / Pending / Unsuccessful). */
export async function setOutcome(roundId: number, outcome: OutcomeValue) {
  const principal = await getWebPrincipal();
  await pursuitService.setOutcome(principal, roundId, outcome);
  revalidatePath(`/rounds/${roundId}`);
}
