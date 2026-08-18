import "server-only";
import { DomainError } from "@/domain/errors";
import {
  loadDashboardForPrincipal,
  loadJobForPrincipal,
  loadReportForPrincipal,
  loadRoundForPrincipal,
  loadSheetForPrincipal,
} from "@/lib/authorization/loaders";
import type { Principal } from "@/lib/authorization/types";

export type DomainResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: ReturnType<DomainError["toJSON"]> };

async function asResult<T>(
  loaded: Promise<{ value: T } | null>,
  label: string
): Promise<DomainResult<T>> {
  const resource = await loaded;
  if (resource) return { ok: true, value: resource.value };
  return {
    ok: false,
    error: DomainError.notFound(`${label} not found`).toJSON(),
  };
}

/** Transport-neutral services: the caller must supply a complete principal. */
export const authorizationService = {
  readJob(principal: Principal, id: number) {
    return asResult(loadJobForPrincipal(principal, id), "Job");
  },
  readRound(principal: Principal, id: number) {
    return asResult(loadRoundForPrincipal(principal, id), "Round");
  },
  readSheet(principal: Principal, id: number) {
    return asResult(loadSheetForPrincipal(principal, id), "Sheet");
  },
  readDashboard(principal: Principal, id: number) {
    return asResult(loadDashboardForPrincipal(principal, id), "Dashboard");
  },
  readReport(principal: Principal, id: number) {
    return asResult(loadReportForPrincipal(principal, id), "Report");
  },
  async requireRoundFieldWrite(
    principal: Principal,
    id: number,
    fieldKey: string
  ) {
    const loaded = await loadRoundForPrincipal(principal, id, {
      capability: "edit",
      fieldKey,
    });
    if (!loaded) throw DomainError.notFound("Round not found");
    return loaded.value;
  },
};
