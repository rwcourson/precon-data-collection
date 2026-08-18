import type { User } from "@/db/schema";
import { REFERENCE_LISTS } from "./reference-data";

/**
 * Region workspaces mirror the SmartSheet folder structure from the Miro
 * working plan: 00 Corporate plus one folder per Region, each containing its
 * own Bid Schedule, Post-Bid, Estimate Summary, and Reports. Here they are one
 * data set with a scope, so Corporate rollups stay possible.
 *
 * This module stays free of `next/headers` so the workspace switcher (a client
 * component) can share the same types and constants. Cookie resolution lives in
 * `workspace-server.ts`.
 */

export const WORKSPACE_COOKIE = "workspace-region";
export const CORPORATE = "corporate";

/** Region accent hues carried over from the Miro board's colour coding. */
export const REGION_ACCENTS: Record<string, string> = {
  Carolinas: "oklch(0.62 0.13 155)",
  Central: "oklch(0.58 0.14 250)",
  Florida: "oklch(0.66 0.15 25)",
  Georgia: "oklch(0.72 0.13 55)",
  Texas: "oklch(0.70 0.14 85)",
};

export const CORPORATE_ACCENT = "oklch(0.58 0.10 195)";

export type Workspace = {
  /** null means the Corporate workspace (every Region). */
  region: string | null;
  label: string;
  accent: string;
  /** Regions this user is allowed to switch into. */
  available: string[];
  canViewCorporate: boolean;
};

/** Leadership and Corporate Precon Admin see across Regions; everyone else does not. */
export function canViewCorporate(user: User): boolean {
  return (
    user.role === "corporate_admin" ||
    user.role === "leadership" ||
    user.region == null
  );
}

export function accentFor(region: string | null): string {
  return region == null
    ? CORPORATE_ACCENT
    : (REGION_ACCENTS[region] ?? CORPORATE_ACCENT);
}

export function resolveWorkspace(
  user: User,
  cookieValue: string | undefined
): Workspace {
  const allRegions = REFERENCE_LISTS.region.values;
  const corporate = canViewCorporate(user);
  const available = corporate
    ? allRegions
    : allRegions.filter((r) => r === user.region);

  let region: string | null;
  if (cookieValue === CORPORATE) {
    region = corporate ? null : (user.region ?? null);
  } else if (cookieValue && available.includes(cookieValue)) {
    region = cookieValue;
  } else {
    // Default: the user's own Region, or Corporate for cross-Region roles.
    region = user.region ?? (corporate ? null : null);
  }

  return {
    region,
    label: region ?? "Corporate",
    accent: accentFor(region),
    available,
    canViewCorporate: corporate,
  };
}

/**
 * Resolves a `?region=` parameter against the active workspace. A scoped user
 * asking for someone else's Region is refused outright rather than quietly
 * handed an empty export, which would look like a data problem.
 */
export function resolveRegionParam(
  workspace: Workspace,
  requested: string | null
): { region: string | null } | { error: string } {
  const asked = requested && requested !== "all" ? requested : null;
  if (workspace.region == null) return { region: asked };
  if (asked && asked !== workspace.region)
    return { error: `You are scoped to the ${workspace.region} workspace.` };
  return { region: workspace.region };
}

/** Narrows any region-bearing collection to the active workspace. */
export function scopeToWorkspace<T extends { region: string }>(
  rows: T[],
  workspace: Workspace
): T[] {
  if (workspace.region == null) return rows;
  return rows.filter((r) => r.region === workspace.region);
}
