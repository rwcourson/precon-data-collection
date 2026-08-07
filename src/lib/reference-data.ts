/** Seed values for managed reference lists (BRD Section 10 + Destini Data Validation). */

import { DESTINI_VALIDATION_LISTS } from "@/lib/destini-validation-lists";

/** Prefer Destini wording; use en-dash for display consistency with the rest of the app. */
function enDash(values: string[]): string[] {
  return values.map((v) => v.replace(/ - /g, " – "));
}

export const REFERENCE_LISTS: Record<string, { label: string; values: string[] }> = {
  region: {
    label: "Region",
    values: DESTINI_VALIDATION_LISTS.region!,
  },
  preconDepartment: {
    label: "Precon Department",
    values: enDash(DESTINI_VALIDATION_LISTS.preconDepartment!),
  },
  estimatePhase: {
    label: "Estimate Phase",
    values: enDash(DESTINI_VALIDATION_LISTS.estimatePhase!),
  },
  contractType: {
    label: "Contract Type",
    values: enDash(DESTINI_VALIDATION_LISTS.contractType!),
  },
  mlt: {
    label: "Market Leadership Team (MLT)",
    values: DESTINI_VALIDATION_LISTS.mlt!,
  },
  marketSector: {
    label: "Market Sector",
    values: enDash(DESTINI_VALIDATION_LISTS.marketSector!),
  },
  procurement: {
    label: "Procurement",
    values: enDash(DESTINI_VALIDATION_LISTS.procurement!),
  },
  designContract: {
    label: "Design/Contract",
    values: DESTINI_VALIDATION_LISTS.designContract!,
  },
  internalJointVenture: {
    label: "Internal Joint Venture",
    values: ["None", "IJV – Cross Division", "IJV – Cross Region"],
  },
  awardability: {
    label: "Awardability",
    values: [
      "Work Under Contract – Hard Bid",
      "Work Under Contract – GMP",
      "Work Under Contract – Early Release",
      "Not Work Under Contract – Budget",
      "Not Work Under Contract – Other",
    ],
  },
  statusAtPricing: {
    label: "Status at Pricing",
    values: ["Prospective", "Committed", "Work Under Contract"],
  },
  selfPerformWorkType: {
    label: "Self-Perform Work Type",
    values: DESTINI_VALIDATION_LISTS.selfPerformWorkType!,
  },
  equipmentRates: {
    label: "Equipment Rates",
    values: DESTINI_VALIDATION_LISTS.equipmentRates!,
  },
  supportGroups: {
    label: "Support Groups",
    values: DESTINI_VALIDATION_LISTS.supportGroups!,
  },
  bidYear: {
    label: "Bid Year",
    values: DESTINI_VALIDATION_LISTS.bidYear!,
  },
  projectPlanningPreconEngagement: {
    label: "Project Planning Precon Engagement",
    values: ["Full Precon", "Partial Precon", "Bid Only", "None"],
  },
  businessStrategyValues: {
    label: "Business Strategy Values",
    values: [
      "Core Market Growth",
      "New Market Entry",
      "Key Client Relationship",
      "Self-Perform Leverage",
      "Backlog Fill",
      "Strategic Pursuit",
    ],
  },
};
