"use server";

import { revalidatePath } from "next/cache";
import { getWebPrincipal } from "@/lib/authorization/web-principal";
import type { OutcomeValue } from "@/lib/outcome";
import { finalizeRound } from "@/services/finalize-round";
import {
  pursuitService,
  type SavePostBidInput,
} from "@/services/pursuit-service";

export type SaveInput = SavePostBidInput;

export async function savePostBidData(input: SaveInput) {
  const principal = await getWebPrincipal();
  const result = await pursuitService.savePostBidData(principal, input);
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
  value: string
) {
  const principal = await getWebPrincipal();
  const result = await pursuitService.updateRoundCell(
    principal,
    roundId,
    key,
    value
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
