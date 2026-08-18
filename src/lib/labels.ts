import type { Role, RoundStatus } from "@/db/schema";

/** Display labels — not authorization. */
export const ROLE_LABELS: Record<Role, string> = {
  pcm: "PCM (Preconstruction Manager)",
  estimate_lead: "Estimate Lead",
  admin_jsa: "Admin / JSA",
  /** Bryan: RPD and SPD are synonymous for approval / post-lock corrections. */
  rpd: "RPD / SPD",
  leadership: "Division / Region Leadership",
  corporate_admin: "Corporate Precon Admin",
};

export const STATUS_LABELS: Record<RoundStatus, string> = {
  active: "Active",
  upcoming: "Upcoming",
  outstanding: "Outstanding",
  submitted: "Submitted",
  post_bid: "Post-Bid Data Entry",
  locked: "RPD / SPD Approved / Locked",
};

export const STATUS_ORDER: RoundStatus[] = [
  "active",
  "upcoming",
  "outstanding",
  "submitted",
  "post_bid",
  "locked",
];
