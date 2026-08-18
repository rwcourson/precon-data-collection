import "server-only";
import type { Principal } from "@/lib/authorization/types";
import { pursuitService } from "@/services/pursuit-service";

/**
 * Seam for Wednesday's post-bid flip decision (ADR 002).
 *
 * Default: lock-passthrough — same as today's RPD Approve & Lock. Callers that
 * will become the flip (web approve button, mobile approve-lock) go through
 * this function so the destination can change without hunting call sites.
 */
export async function finalizeRound(roundId: number, principal: Principal) {
  return pursuitService.approveAndLock(principal, roundId);
}
