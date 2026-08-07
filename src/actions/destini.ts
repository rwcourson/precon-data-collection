"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { auditLog, estimateRounds, jobs } from "@/db/schema";
import { getCurrentUser } from "@/lib/current-user";
import {
  DESTINI_WRITABLE_KEYS,
  filterWritableValues,
  mapDestiniSheet,
  parseDestiniCsv,
  parseDestiniWorkbook,
  type DestiniMappedRow,
  type DestiniWritableKey,
} from "@/lib/destini-import";
import { FIELD_MAP } from "@/lib/fields";
import { appendEntityVersion } from "@/lib/recovery";
import { assertCanWriteField } from "@/lib/policy";

const ALLOWED_ROLES = ["admin_jsa", "rpd", "estimate_lead", "corporate_admin"] as const;

function assertImporter() {
  return getCurrentUser().then((user) => {
    if (!ALLOWED_ROLES.includes(user.role as (typeof ALLOWED_ROLES)[number])) {
      throw new Error("Permission denied.");
    }
    return user;
  });
}

export type DestiniFieldDiff = {
  key: DestiniWritableKey;
  label: string;
  current: number | string | null;
  incoming: number | string | null;
  changed: boolean;
};

export type DestiniRoundCandidate = {
  id: number;
  estimatePhase: string | null;
  roundNumber: number;
  status: string;
  estimateValue: number | null;
  /** Current Destini-writable field values for diffing in the UI. */
  current: Partial<Record<DestiniWritableKey, number | string | null>>;
};

export type DestiniPreviewRow = {
  index: number;
  jobNumber: string | null;
  jobName: string | null;
  estimatePhase: string | null;
  jobId: number | null;
  matchedJobName: string | null;
  rounds: DestiniRoundCandidate[];
  suggestedRoundId: number | null;
  values: Partial<Record<DestiniWritableKey, number | string | null>>;
  diffs: DestiniFieldDiff[];
  unmappedHeaders: string[];
  skippedEmpty: string[];
  error: string | null;
};

export type DestiniPreviewResult = {
  format: "vertical" | "tabular";
  sheetName: string;
  rows: DestiniPreviewRow[];
};

async function buildPreview(mapped: DestiniMappedRow[]): Promise<DestiniPreviewRow[]> {
  const out: DestiniPreviewRow[] = [];

  for (let index = 0; index < mapped.length; index++) {
    const row = mapped[index]!;
    const base: DestiniPreviewRow = {
      index,
      jobNumber: row.jobNumber,
      jobName: row.jobName,
      estimatePhase: row.estimatePhase,
      jobId: null,
      matchedJobName: null,
      rounds: [],
      suggestedRoundId: null,
      values: row.values,
      diffs: [],
      unmappedHeaders: row.unmappedHeaders,
      skippedEmpty: row.skippedEmpty,
      error: null,
    };

    if (!row.jobNumber) {
      base.error = "Missing Job Number — cannot match a pursuit.";
      out.push(base);
      continue;
    }

    const [job] = await db
      .select()
      .from(jobs)
      .where(and(eq(jobs.jobNumber, row.jobNumber), isNull(jobs.deletedAt)));

    if (!job) {
      base.error = `No job found for Job Number ${row.jobNumber}.`;
      out.push(base);
      continue;
    }

    base.jobId = job.id;
    base.matchedJobName = job.jobName;

    const rounds = await db
      .select()
      .from(estimateRounds)
      .where(and(eq(estimateRounds.jobId, job.id), isNull(estimateRounds.deletedAt)));

    const sorted = [...rounds].sort((a, b) => b.roundNumber - a.roundNumber);
    base.rounds = sorted.map((r) => {
      const current: Partial<Record<DestiniWritableKey, number | string | null>> = {};
      for (const key of DESTINI_WRITABLE_KEYS) {
        current[key] = (r as Record<string, unknown>)[key] as number | string | null;
      }
      return {
        id: r.id,
        estimatePhase: r.estimatePhase,
        roundNumber: r.roundNumber,
        status: r.status,
        estimateValue: r.estimateValue,
        current,
      };
    });

    if (sorted.length === 0) {
      base.error = "Job has no estimate rounds.";
      out.push(base);
      continue;
    }

    const phaseMatch = row.estimatePhase
      ? sorted.find((r) => r.estimatePhase === row.estimatePhase)
      : null;
    const suggested = phaseMatch ?? (sorted.length === 1 ? sorted[0]! : null);
    base.suggestedRoundId = suggested?.id ?? null;

    if (!suggested && sorted.length > 1) {
      base.error = "Multiple rounds — pick which estimate phase to update.";
    }

    const target = base.rounds.find((r) => r.id === base.suggestedRoundId);
    if (target) {
      base.diffs = DESTINI_WRITABLE_KEYS.filter((key) => key in row.values).map((key) => {
        const current = target.current[key] ?? null;
        const incoming = row.values[key] ?? null;
        return {
          key,
          label: FIELD_MAP[key]?.label ?? key,
          current,
          incoming,
          changed: String(current ?? "") !== String(incoming ?? ""),
        };
      });
    }

    out.push(base);
  }

  return out;
}

/** Preview a CSV paste or tabular headers/rows (no write). */
export async function previewDestiniRows(input: {
  headers: string[];
  rows: unknown[][];
}): Promise<DestiniPreviewResult> {
  await assertImporter();
  const mapped = mapDestiniSheet(input.headers, input.rows);
  return {
    format: "tabular",
    sheetName: "csv",
    rows: await buildPreview(mapped),
  };
}

/** Preview CSV text (vertical or tabular). */
export async function previewDestiniCsvText(text: string): Promise<DestiniPreviewResult> {
  await assertImporter();
  const parsed = parseDestiniCsv(text);
  return {
    format: parsed.format,
    sheetName: parsed.sheetName,
    rows: await buildPreview(parsed.rows),
  };
}

/** Preview an uploaded .xlsx / .csv file. */
export async function previewDestiniFile(formData: FormData): Promise<DestiniPreviewResult> {
  await assertImporter();
  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("No file uploaded.");
  const name = file.name.toLowerCase();
  const buf = Buffer.from(await file.arrayBuffer());

  if (name.endsWith(".csv") || name.endsWith(".txt")) {
    const parsed = parseDestiniCsv(buf.toString("utf8"));
    return {
      format: parsed.format,
      sheetName: parsed.sheetName || file.name,
      rows: await buildPreview(parsed.rows),
    };
  }

  if (name.endsWith(".xlsx") || name.endsWith(".xlsm")) {
    const parsed = await parseDestiniWorkbook(buf);
    return {
      format: parsed.format,
      sheetName: parsed.sheetName || file.name,
      rows: await buildPreview(parsed.rows),
    };
  }

  throw new Error("Upload a .xlsx or .csv Destini export.");
}

/** Write Destini-sourced fields onto one matched round. */
export async function confirmDestiniImport(input: {
  roundId: number;
  values: Record<string, number | string | null>;
}) {
  const user = await assertImporter();
  const values = filterWritableValues(input.values);
  const keys = Object.keys(values) as DestiniWritableKey[];
  if (keys.length === 0) throw new Error("No Destini fields to import.");

  const [round] = await db
    .select()
    .from(estimateRounds)
    .where(and(eq(estimateRounds.id, input.roundId), isNull(estimateRounds.deletedAt)));
  if (!round) throw new Error("Round not found.");

  for (const key of keys) {
    assertCanWriteField(user, key, round);
  }

  const numericPatch: Record<string, number | null> = {};
  for (const key of keys) {
    const v = values[key];
    if (v == null || v === "") {
      numericPatch[key] = null;
    } else if (typeof v === "number") {
      numericPatch[key] = v;
    } else {
      const n = Number(String(v).replace(/[$,]/g, ""));
      numericPatch[key] = Number.isFinite(n) ? n : null;
    }
  }

  await appendEntityVersion("round", round.id, { ...round }, user.id);
  await db
    .update(estimateRounds)
    .set({
      ...numericPatch,
      updatedAt: new Date(),
    })
    .where(eq(estimateRounds.id, round.id));
  await db.insert(auditLog).values({
    entity: "round",
    entityId: round.id,
    roundId: round.id,
    action: "destini_import",
    userId: user.id,
    newValue: JSON.stringify({ keys, values }),
  });

  revalidatePath("/post-bid");
  revalidatePath(`/rounds/${round.id}`);
  revalidatePath("/admin");
  revalidatePath("/admin/destini");
  return { ok: true as const, roundId: round.id, fields: keys.length };
}

/**
 * Legacy batch path — kept for callers that paste CSV and want immediate apply.
 * Prefer preview + confirm for XLSX.
 */
export async function importDestiniRows(input: {
  headers: string[];
  rows: unknown[][];
}) {
  const preview = await previewDestiniRows(input);
  let updated = 0;
  let unmatched = 0;

  for (const row of preview.rows) {
    if (!row.suggestedRoundId || row.error) {
      unmatched++;
      continue;
    }
    await confirmDestiniImport({
      roundId: row.suggestedRoundId,
      values: row.values as Record<string, number | string | null>,
    });
    updated++;
  }

  return { updated, unmatched, total: preview.rows.length };
}
