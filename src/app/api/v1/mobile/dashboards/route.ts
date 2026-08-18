import {
  cloneDashboard,
  createDashboard,
  deleteDashboard,
} from "@/actions/dashboards";
import {
  listDashboardsForPrincipal,
  listRoundsWithJobsForPrincipal,
} from "@/lib/authorization/loaders";
import { METRIC_DEFS } from "@/lib/metrics";
import {
  groupVolumeChartSubtitle,
  groupVolumeChartTitle,
  groupVolumeForLevel,
  parseDashboardLevel,
  scopeRoundsForLevel,
  statusSeriesFromRounds,
} from "@/lib/mobile-dashboard-scope";
import { jsonError, jsonOk, mapError, withMobileAuth } from "@/lib/mobile-http";

export async function GET(req: Request) {
  return withMobileAuth(
    req,
    { scopes: "read:dashboards" },
    async (principal) => {
      const url = new URL(req.url);
      const level = parseDashboardLevel(url.searchParams.get("level"));
      const user = principal.user;
      const allRows = await listRoundsWithJobsForPrincipal(
        principal.authorization
      );

      // Web: corporate = all workspace; region/division filter to focus region
      // (workspace.region if set, else user's region for cross-region viewers)
      const focusRegion =
        principal.authorization.workspace.region ??
        (url.searchParams.get("region") || user.region || null);

      const rounds = allRows.map((r) => ({
        region: r.round.region,
        preconDepartment: r.round.preconDepartment,
        marketSector: r.round.marketSector,
        estimateValue: r.round.estimateValue,
        status: r.round.status,
        round: r.round,
      }));

      const scoped = scopeRoundsForLevel(rounds, level, focusRegion);

      const locked = scoped.filter((r) => r.status === "locked");
      const won = locked.filter((r) => r.round.outcome === "successful");
      const totalValue = scoped.reduce((s, r) => s + (r.estimateValue ?? 0), 0);
      const winRate = locked.length ? won.length / locked.length : null;

      const statusSeries = statusSeriesFromRounds(scoped);
      const groupVolume = groupVolumeForLevel(scoped, level, { max: 8 });

      // Back-compat alias: regionVolume always = primary group volume for this level
      const regionVolume = groupVolume;

      const kpis = [
        {
          key: "pipeline",
          label: "Pipeline value",
          value: totalValue,
          format: "dollars",
        },
        {
          key: "rounds",
          label: "Open rounds",
          value: scoped.length,
          format: "number",
        },
        {
          key: "locked",
          label: "Locked",
          value: locked.length,
          format: "number",
        },
        {
          key: "winRate",
          label: "Win rate",
          value: winRate,
          format: "percent",
        },
      ];

      const headlineMetrics = METRIC_DEFS.filter((m) => m.headline)
        .slice(0, 6)
        .map((m) => {
          const values = scoped
            .map((r) => m.calc(r.round))
            .filter((v): v is number => v != null);
          const avg =
            values.length === 0
              ? null
              : values.reduce((a, b) => a + b, 0) / values.length;
          return {
            key: m.key,
            label: m.label,
            value: avg,
            format: m.format,
            group: m.group,
          };
        });

      const studio = (
        await listDashboardsForPrincipal(principal.authorization)
      ).sort((a, b) => a.name.localeCompare(b.name));

      return jsonOk({
        level,
        focusRegion,
        groupBy:
          level === "corporate"
            ? "region"
            : level === "region"
              ? "preconDepartment"
              : "marketSector",
        groupVolumeTitle: groupVolumeChartTitle(level),
        groupVolumeSubtitle: groupVolumeChartSubtitle(level),
        kpis,
        headlineMetrics,
        statusSeries,
        groupVolume,
        /** @deprecated use groupVolume — kept for older clients */
        regionVolume,
        empty: scoped.length === 0,
        emptyLabel:
          scoped.length === 0
            ? level === "corporate"
              ? "No rounds in this workspace"
              : `No rounds for ${focusRegion ?? "this region"} at ${level} level`
            : undefined,
        studio: studio.map((d) => ({
          id: d.id,
          name: d.name,
          scope: d.scope,
          region: d.region,
          published: d.published,
        })),
      });
    }
  );
}

export async function POST(req: Request) {
  return withMobileAuth(req, { scopes: "write:dashboards" }, async () => {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonError("Invalid JSON", 400);
    }
    try {
      const id = await createDashboard(body);
      return jsonOk({ id }, { status: 201 });
    } catch (err) {
      return mapError(err);
    }
  });
}

export async function PATCH(req: Request) {
  return withMobileAuth(req, { scopes: "write:dashboards" }, async () => {
    let body: { action?: string; id?: number };
    try {
      body = await req.json();
    } catch {
      return jsonError("Invalid JSON", 400);
    }
    try {
      if (body.action === "clone" && body.id) {
        const id = await cloneDashboard(body.id);
        return jsonOk({ id });
      }
      if (body.action === "delete" && body.id) {
        await deleteDashboard(body.id);
        return jsonOk({ ok: true });
      }
      return jsonError("Unknown action", 400);
    } catch (err) {
      return mapError(err);
    }
  });
}
