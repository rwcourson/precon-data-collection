import "server-only";
import fs from "fs";
import path from "path";
import {
  getCurrentUser as getSmartsheetUser,
  getSheet,
  listSheets,
  smartsheetConfig,
  type SheetListItem,
} from "./client";

const DATA_DIR = path.join(process.cwd(), "data/smartsheet/json");

/** Match precon workspace sheets we already mirror locally. */
const PRECON_NAME_RE =
  /(precon|bid schedule|post.?bid|estimate metrics|estimate summary|cost tracking|self.?perform|dashboard)/i;

export type SmartsheetPullSummary = {
  configured: boolean;
  userEmail: string | null;
  listed: number;
  matched: number;
  downloaded: number;
  writtenTo: string;
  sheets: { id: number; name: string; rows?: number; columns?: number }[];
  error?: string;
};

function safeFileName(name: string, id: number): string {
  const base = name
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 120);
  return `${base}__${id}.json`;
}

/** Lists precon-matching sheets the token can see (read-only). */
export async function listPreconSheets(): Promise<{
  configured: boolean;
  userEmail: string | null;
  sheets: SheetListItem[];
  error?: string;
}> {
  const cfg = smartsheetConfig();
  if (!cfg) return { configured: false, userEmail: null, sheets: [] };
  try {
    const me = await getSmartsheetUser(cfg.token);
    const all = await listSheets(cfg.token);
    const sheets = all.filter((s) => PRECON_NAME_RE.test(s.name));
    return { configured: true, userEmail: me.email ?? null, sheets };
  } catch (e) {
    return {
      configured: true,
      userEmail: null,
      sheets: [],
      error: e instanceof Error ? e.message : "list failed",
    };
  }
}

/**
 * Pull matched sheets via GET /sheets/{id} and write JSON under data/smartsheet/json.
 * Never mutates Smartsheet. Safe to re-run (overwrites local files).
 */
export async function pullSmartsheetExports(opts?: {
  /** Cap downloads (default 60). */
  limit?: number;
  /** If set, only these sheet ids. */
  sheetIds?: number[];
}): Promise<SmartsheetPullSummary> {
  const cfg = smartsheetConfig();
  const writtenTo = DATA_DIR;
  if (!cfg) {
    return {
      configured: false,
      userEmail: null,
      listed: 0,
      matched: 0,
      downloaded: 0,
      writtenTo,
      sheets: [],
      error: "SMARTSHEET_ACCESS_TOKEN is not set",
    };
  }

  try {
    // File pull is for local/ops machines. On Vercel the filesystem is ephemeral —
    // use listPreconSheets + `npm run smartsheet:pull` + `db:import-smartsheet` instead.
    if (process.env.VERCEL) {
      return {
        configured: true,
        userEmail: null,
        listed: 0,
        matched: 0,
        downloaded: 0,
        writtenTo,
        sheets: [],
        error:
          "File pull is disabled on Vercel. Run `npm run smartsheet:pull` locally, then `npm run db:import-smartsheet` against Neon.",
      };
    }

    const me = await getSmartsheetUser(cfg.token);
    const all = await listSheets(cfg.token);
    const matched = opts?.sheetIds?.length
      ? all.filter((s) => opts.sheetIds!.includes(s.id))
      : all.filter((s) => PRECON_NAME_RE.test(s.name));

    const limit = opts?.limit ?? 60;
    const slice = matched.slice(0, limit);
    fs.mkdirSync(DATA_DIR, { recursive: true });

    const sheets: SmartsheetPullSummary["sheets"] = [];
    for (const item of slice) {
      const payload = (await getSheet(cfg.token, item.id)) as {
        id?: number;
        name?: string;
        rows?: unknown[];
        columns?: unknown[];
      };
      const file = path.join(DATA_DIR, safeFileName(item.name, item.id));
      fs.writeFileSync(file, JSON.stringify(payload));
      sheets.push({
        id: item.id,
        name: item.name,
        rows: payload.rows?.length,
        columns: payload.columns?.length,
      });
    }

    // Refresh manifest for migration UI / ops.
    const manifestPath = path.join(process.cwd(), "data/smartsheet/manifest.json");
    fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
    fs.writeFileSync(
      manifestPath,
      JSON.stringify(
        sheets.map((s) => ({
          id: s.id,
          name: s.name,
          rows: s.rows ?? 0,
          columns: s.columns ?? 0,
          pulledAt: new Date().toISOString(),
        })),
        null,
        2,
      ),
    );

    return {
      configured: true,
      userEmail: me.email ?? null,
      listed: all.length,
      matched: matched.length,
      downloaded: sheets.length,
      writtenTo,
      sheets,
    };
  } catch (e) {
    return {
      configured: true,
      userEmail: null,
      listed: 0,
      matched: 0,
      downloaded: 0,
      writtenTo,
      sheets: [],
      error: e instanceof Error ? e.message : "pull failed",
    };
  }
}
