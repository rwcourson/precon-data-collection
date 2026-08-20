import type { RoundStatus } from "@/db/schema";
import { authorize } from "@/lib/authorization/kernel";
import type { Principal } from "@/lib/authorization/types";

export type WhoCanEditMode = "direct" | "propose" | "read";

export function explainWhoCanEdit(input: {
  principal: Principal;
  writeMode: WhoCanEditMode;
  locked: boolean;
  lockImmutable: boolean;
  scheduleMode: boolean;
  roundId: number;
  region: string;
  status: RoundStatus;
}): string {
  const kernel = authorize(input.principal, "edit", {
    type: "round",
    id: input.roundId,
    region: input.region,
    ownerId: null,
    published: true,
    deleted: false,
    visibilitySatisfied: true,
    round: { status: input.status, region: input.region },
    fieldKey: input.scheduleMode ? "bidDueDate" : "feeBackPage",
    lockImmutable: input.lockImmutable,
  });

  if (input.locked && input.lockImmutable) {
    return "This revision is immutable. An RPD/SPD or corporate admin must send it back before anyone can edit.";
  }
  if (input.locked) {
    return "RPDs can correct locked fields in place until lock revisions are enabled for this cohort.";
  }
  if (
    input.writeMode === "read" ||
    (!kernel.allowed && kernel.reason === "role")
  ) {
    return "Your role can see this effort but cannot edit published schedule or post-bid fields.";
  }
  if (!kernel.allowed) {
    if (kernel.reason === "field-policy") {
      return "Field policy or lock state does not allow this write for your role.";
    }
    if (kernel.reason === "region") {
      return "This effort is outside the regions you can edit.";
    }
    return `Edits are blocked (${kernel.reason}).`;
  }
  if (input.writeMode === "propose") {
    return "Your edits are sent as an approval request. An RPD/SPD or corporate admin publishes them.";
  }
  if (input.scheduleMode) {
    return "PCM, Estimate Lead, Admin/JSA, and RPD roles can update schedule fields for this group.";
  }
  return "Estimate Leads and Admin/JSA can enter post-bid data. Only an RPD/SPD or corporate admin can approve and lock.";
}
