/**
 * Count isolated live Precon after `pnpm db:bootstrap:smartsheet`.
 * Uses `.pglite/data-full` only. Never reads DATABASE_URL. Never flips SMARTSHEET_MODE.
 *
 * Usage: pnpm smartsheet:live-counts [dump-counts.json] [out.json]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { and, eq, isNull } from "drizzle-orm";
import { applyDemoBootstrapEnv } from "../src/db/demo-env";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

applyDemoBootstrapEnv(process.env);
const fullDir = path.join(root, ".pglite/data-full");
process.env.DATABASE_MODE = "pglite";
process.env.PGLITE_DATA_DIR =
  process.env.PGLITE_FULL_DATA_DIR?.trim() || fullDir;
process.env.APP_ENV = "demo";
process.env.AUTH_MODE = "demo";
delete process.env.DATABASE_URL;
delete process.env.DATABASE_URL_UNPOOLED;
delete process.env.POSTGRES_URL;
delete process.env.POSTGRES_URL_NON_POOLING;
delete process.env.POSTGRES_PRISMA_URL;

if (process.env.DATABASE_URL) {
  process.stderr.write(
    "Refusing live dump counts while DATABASE_URL is set.\n"
  );
  process.exit(2);
}

const dataDir = path.resolve(root, process.env.PGLITE_DATA_DIR);
if (!fs.existsSync(path.join(dataDir, "PG_VERSION"))) {
  process.stderr.write(
    "No isolated import at .pglite/data-full. Run pnpm db:bootstrap:smartsheet first.\n"
  );
  process.exit(2);
}

const dumpPath = path.resolve(
  root,
  process.argv[2] ?? "data/smartsheet/dump-counts.json"
);
const outPath = path.resolve(
  root,
  process.argv[3] ?? "data/smartsheet/live-counts.json"
);

if (!fs.existsSync(dumpPath)) {
  process.stderr.write(
    `Missing dump counts at ${path.relative(root, dumpPath)}. Run pnpm smartsheet:dump-counts first.\n`
  );
  process.exit(2);
}

const dump = JSON.parse(fs.readFileSync(dumpPath, "utf8")) as {
  checksum: string;
};

async function main() {
  const { getRuntimeConfig } = await import("../src/lib/runtime-config");
  const database = getRuntimeConfig().database;
  if (database.mode !== "pglite" || !database.dataDir.includes("data-full")) {
    throw new Error(
      "Live dump counts only run against isolated PGlite at .pglite/data-full."
    );
  }
  const { closeDatabase, db } = await import("../src/db");
  const { estimateRounds, jobs, users } = await import("../src/db/schema");
  const { countLivePreconDump, liveRoundIdentityKey } = await import(
    "../src/lib/smartsheet-dump"
  );

  try {
    const jobRows = await db
      .select({ jobNumber: jobs.jobNumber })
      .from(jobs)
      .where(isNull(jobs.deletedAt));
    const roundRows = await db
      .select({
        jobId: estimateRounds.jobId,
        roundNumber: estimateRounds.roundNumber,
        status: estimateRounds.status,
        region: estimateRounds.region,
        preconDepartment: estimateRounds.preconDepartment,
        estimatePhase: estimateRounds.estimatePhase,
        bidDueDate: estimateRounds.bidDueDate,
        awardability: estimateRounds.awardability,
        estimateValue: estimateRounds.estimateValue,
        feeBackPage: estimateRounds.feeBackPage,
        feeExpected: estimateRounds.feeExpected,
        estimateLeadName: users.name,
      })
      .from(estimateRounds)
      .innerJoin(jobs, eq(jobs.id, estimateRounds.jobId))
      .leftJoin(users, eq(users.id, estimateRounds.estimateLeadId))
      .where(and(isNull(estimateRounds.deletedAt), isNull(jobs.deletedAt)));

    const live = countLivePreconDump({
      jobNumbers: jobRows.map((row) => row.jobNumber),
      rounds: roundRows.map((row) => ({
        status: row.status,
        region: row.region,
        preconDepartment: row.preconDepartment,
        estimatePhase: row.estimatePhase,
        bidDueDate: row.bidDueDate,
        awardability: row.awardability,
        estimateValue: row.estimateValue,
        feeBackPage: row.feeBackPage,
        feeExpected: row.feeExpected,
        estimateLeadName: row.estimateLeadName,
        identityKey: liveRoundIdentityKey({
          jobId: row.jobId,
          roundNumber: row.roundNumber,
        }),
      })),
      dumpChecksum: dump.checksum,
    });

    const artifact = {
      ...live,
      isolated: true,
      signedOff: process.env.SMARTSHEET_DUMP_SIGNED_OFF === "1",
      note: "Isolated PGlite import only. This script never changes SMARTSHEET_MODE or touches Production.",
    };
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, `${JSON.stringify(artifact, null, 2)}\n`);
    process.stdout.write(
      `${JSON.stringify(
        {
          out: path.relative(root, outPath),
          jobs: live.jobs,
          rounds: live.rounds,
          duplicates: live.duplicates,
          requiredFieldFlags: live.requiredFieldFlags,
          checksum: live.checksum,
          isolated: true,
          signedOff: artifact.signedOff,
          mayDisableReads: false,
        },
        null,
        2
      )}\n`
    );
  } finally {
    await closeDatabase();
  }
}

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : "Live count failed"}\n`
  );
  process.exit(1);
});
