/**
 * Time the canonical schedule projection and latest-note join against the
 * isolated Smartsheet dump database (.pglite/data-full). Never reads Production
 * Neon. Skip when the dump DB is absent (CI).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { applyDemoBootstrapEnv } from "../src/db/demo-env";
import { estimateRounds, jobs, roundNotes } from "../src/db/schema";
import { projectScheduleJobs } from "../src/lib/schedule-projection";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(root, ".pglite/data-full");

async function main() {
  if (!fs.existsSync(dataDir)) {
    process.stdout.write(
      `${JSON.stringify({ skipped: true, reason: "no .pglite/data-full" })}\n`
    );
    return;
  }

  applyDemoBootstrapEnv();
  process.env.PGLITE_DATA_DIR = dataDir;

  const { closeDatabase, db, ensureDbReady } = await import("../src/db/index");

  await ensureDbReady();

  const rows = await db
    .select({
      jobId: jobs.id,
      roundId: estimateRounds.id,
      status: estimateRounds.status,
      bidDueDate: estimateRounds.bidDueDate,
      roundNumber: estimateRounds.roundNumber,
    })
    .from(estimateRounds)
    .innerJoin(jobs, eq(jobs.id, estimateRounds.jobId))
    .where(isNull(estimateRounds.deletedAt));

  const projectedInput = rows.map((row) => ({
    job: { id: row.jobId },
    round: {
      id: row.roundId,
      status: row.status,
      bidDueDate: row.bidDueDate,
      roundNumber: row.roundNumber,
    },
  }));

  const projectStarted = performance.now();
  const projected = projectScheduleJobs(projectedInput);
  const projectMs = performance.now() - projectStarted;

  const focalIds = projected.map((item) => item.focal.round.id);
  const notesStarted = performance.now();
  const noteRows =
    focalIds.length === 0
      ? []
      : await db
          .selectDistinctOn([roundNotes.roundId], {
            roundId: roundNotes.roundId,
          })
          .from(roundNotes)
          .where(
            and(
              inArray(roundNotes.roundId, focalIds),
              isNull(roundNotes.deletedAt)
            )
          )
          .orderBy(roundNotes.roundId, desc(roundNotes.createdAt));
  const notesMs = performance.now() - notesStarted;

  const report = {
    skipped: false,
    jobs: new Set(rows.map((row) => row.jobId)).size,
    rounds: rows.length,
    projectedJobs: projected.length,
    projectMs: Math.round(projectMs * 10) / 10,
    notesMs: Math.round(notesMs * 10) / 10,
    notesFound: noteRows.length,
  };

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);

  if (report.projectedJobs !== report.jobs) {
    process.stderr.write(
      "schedule-full-perf: projection did not keep one row per job\n"
    );
    process.exitCode = 1;
    return;
  }
  if (projectMs > 250) {
    process.stderr.write(
      `schedule-full-perf: projection ${projectMs}ms exceeds 250ms\n`
    );
    process.exitCode = 1;
    return;
  }
  if (notesMs > 4000) {
    process.stderr.write(
      `schedule-full-perf: latest-note join ${notesMs}ms exceeds 4s\n`
    );
    process.exitCode = 1;
  }
  await closeDatabase();
}

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`
  );
  process.exit(1);
});
