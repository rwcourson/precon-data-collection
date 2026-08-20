/* Seed script: realistic demo dataset. Run with `pnpm run db:seed` (server stopped). */

import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import { LATEST_NOTE_KEY } from "@/lib/latest-note";
import { REGION_DEPARTMENTS } from "@/lib/region-departments";
import { assertDemoSeedAllowed } from "@/lib/runtime-config";
import { allStandardDashboardDefs } from "@/lib/standard-dashboards";
import { DEFAULT_DEMO_RPD } from "../lib/demo-identity";
import { REFERENCE_LISTS } from "../lib/reference-data";
import {
  consolidatedRegionalReportInsert,
  upcomingBidScheduleReportInsert,
} from "../lib/report-presets";
import { db } from "./index";
import type { RoundStatus } from "./schema";
import {
  approvalRequests,
  auditLog,
  customColumns,
  customColumnValues,
  dashboards,
  dashboardWidgets,
  distributionLists,
  distributionRuns,
  emailOutbox,
  estimateRounds,
  groupEditPolicies,
  integrationImportBatches,
  jobGroupMemberships,
  jobRegionVisibility,
  jobRelationships,
  jobs,
  jobUserVisibility,
  notifications,
  organizationGroups,
  productEvents,
  publicationOutbox,
  referenceLists,
  referenceListValues,
  reportTemplates,
  roundFieldExceptions,
  roundLockRevisions,
  roundMultiValues,
  roundNoteAttachments,
  roundNoteMentions,
  roundNotes,
  roundStaffAssignments,
  salesforceJobs,
  savedReports,
  sourceProvenance,
  statusTransitions,
  userGroupMemberships,
  userRoundWatermarks,
  users,
} from "./schema";

// Deterministic RNG so the demo dataset is stable across reseeds
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260806);
const pick = <T>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];
const pickN = <T>(arr: T[], n: number): T[] => {
  const copy = [...arr];
  const out: T[] = [];
  for (let i = 0; i < Math.min(n, copy.length); i++) {
    out.push(copy.splice(Math.floor(rand() * copy.length), 1)[0]);
  }
  return out;
};
const between = (lo: number, hi: number) => lo + rand() * (hi - lo);
const round = (v: number, nearest = 1000) => Math.round(v / nearest) * nearest;

const REGION_CITIES: Record<string, [string, string][]> = {
  Carolinas: [
    ["Charlotte", "NC"],
    ["Raleigh", "NC"],
    ["Greenville", "SC"],
    ["Columbia", "SC"],
  ],
  Central: [
    ["Birmingham", "AL"],
    ["Nashville", "TN"],
    ["Huntsville", "AL"],
    ["Memphis", "TN"],
    ["Louisville", "KY"],
  ],
  Florida: [
    ["Orlando", "FL"],
    ["Tampa", "FL"],
    ["Jacksonville", "FL"],
    ["Miami", "FL"],
  ],
  Georgia: [
    ["Atlanta", "GA"],
    ["Savannah", "GA"],
    ["Augusta", "GA"],
    ["Columbus", "GA"],
  ],
  Texas: [
    ["Dallas", "TX"],
    ["Austin", "TX"],
    ["Houston", "TX"],
    ["San Antonio", "TX"],
  ],
};

const SECTOR_NAMES: [string, string[], [number, number]][] = [
  // Labels must match REFERENCE_LISTS.marketSector so a full-form save can lock and correct.
  [
    "Healthcare – Hospital",
    [
      "{city} Regional Medical Center Tower",
      "{city} Children's Hospital Expansion",
      "St. Vincent's {city} Bed Tower",
    ],
    [80, 420],
  ],
  [
    "Healthcare – Outpatient Facilities",
    ["{city} Medical Office Building", "{city} Outpatient Pavilion"],
    [18, 90],
  ],
  [
    "Mission Critical – Greenfield Data Center",
    [
      "Project Falcon Data Center",
      "Project Granite Hyperscale Campus",
      "{city} Colocation Facility Phase II",
    ],
    [120, 900],
  ],
  [
    "Commercial – Office",
    ["{city} Gateway Office Tower", "Midtown {city} Mixed-Use Office"],
    [40, 260],
  ],
  [
    "Commercial – Other",
    ["{city} Riverfront District", "The Foundry at {city}"],
    [60, 350],
  ],
  [
    "Education – Higher Education",
    ["{city} University Science Hall", "{city} State Engineering Complex"],
    [30, 180],
  ],
  [
    "Government – Military",
    ["Fort {city} Barracks Complex", "{city} AFB Maintenance Hangar"],
    [45, 240],
  ],
  [
    "Industrial – Manufacturing",
    ["{city} EV Battery Plant", "{city} Assembly Plant Expansion"],
    [150, 800],
  ],
  [
    "Industrial – Food and Beverage",
    ["{city} Beverage Production Facility", "{city} Cold Storage Distribution"],
    [35, 160],
  ],
  [
    "Infrastructure – Roads & Bridges",
    ["I-65 {city} Bridge Replacement", "SR-280 {city} Interchange"],
    [25, 190],
  ],
  [
    "Water – Wastewater",
    ["{city} Water Treatment Plant Upgrade", "{city} WWTP Expansion"],
    [40, 220],
  ],
  [
    "Hospitality – Hotel",
    ["{city} Convention Hotel", "The Grand {city} Hotel & Spa"],
    [55, 280],
  ],
  [
    "Multi-Family – Apartment",
    ["{city} Commons Apartments", "Parkline {city} Residences"],
    [30, 140],
  ],
  [
    "Sports & Entertainment – Stadium/Athletic Facility",
    ["{city} Stadium Renovation", "{city} Arena District"],
    [90, 500],
  ],
  [
    "Science & Tech – Research Institutions",
    ["{city} Biotech Research Center", "{city} Innovation Labs"],
    [50, 270],
  ],
];

const ESTIMATE_LEAD_NAMES = [
  "Marcus Webb",
  "Jenna Kowalski",
  "David Tran",
  "Alicia Romero",
  "Chris Bagwell",
  "Priya Natarajan",
  "Sam Whitfield",
  "Erica Dunn",
  "Jordan Blake",
  "Miguel Santos",
];

const PHASE_SEQUENCES: string[][] = [
  ["Budget – Concept", "Budget – SD", "Budget – DD", "GMP"],
  ["Budget – Quick ROM", "Budget – Concept", "GMP"],
  ["Budget – SD", "Budget – DD", "Budget – Early Release", "GMP"],
  ["Hard Bid/Firm Fixed"],
  ["Budget – Concept", "Hard Bid/Firm Fixed"],
  ["Budget – DD", "GMP"],
  ["Budget – Quick ROM"],
  ["Rates Only"],
  ["Budget – Concept", "Budget – SD", "Budget – DD"],
];

export async function seedDemoData() {
  assertDemoSeedAllowed();
  console.log("Clearing existing data…");
  await db.delete(publicationOutbox);
  await db.delete(roundLockRevisions);
  await db.delete(roundFieldExceptions);
  await db.delete(userRoundWatermarks);
  await db.delete(roundStaffAssignments);
  await db.delete(approvalRequests);
  await db.delete(sourceProvenance);
  await db.delete(integrationImportBatches);
  await db.delete(productEvents);
  await db.delete(groupEditPolicies);
  await db.delete(userGroupMemberships);
  await db.delete(jobGroupMemberships);
  await db.delete(jobRelationships);
  await db.delete(customColumnValues);
  await db.delete(customColumns);
  await db.delete(roundMultiValues);
  await db.delete(statusTransitions);
  await db.delete(auditLog);
  await db.delete(notifications);
  await db.delete(reportTemplates);
  await db.delete(emailOutbox);
  await db.delete(distributionRuns);
  await db.delete(distributionLists);
  await db.delete(dashboardWidgets);
  await db.delete(dashboards);
  await db.delete(savedReports);
  await db.delete(jobUserVisibility);
  await db.delete(jobRegionVisibility);
  await db.delete(roundNoteAttachments);
  await db.delete(roundNoteMentions);
  await db.delete(roundNotes);
  await db.delete(estimateRounds);
  await db.delete(jobs);
  await db.delete(salesforceJobs);
  await db.delete(referenceListValues);
  await db.delete(referenceLists);
  await db.delete(organizationGroups);
  await db.delete(users);

  console.log("Seeding reference lists…");
  for (const [key, list] of Object.entries(REFERENCE_LISTS)) {
    await db.insert(referenceLists).values({ key, label: list.label });
    await db
      .insert(referenceListValues)
      .values(
        list.values.map((value, i) => ({ listKey: key, value, sortOrder: i }))
      );
  }
  await db.insert(organizationGroups).values(
    Object.entries(REGION_DEPARTMENTS).flatMap(([region, departments]) =>
      departments.map((department) => ({
        key: `department:${department
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "")}`,
        name: department,
        kind: "precon_department",
        region,
      }))
    )
  );

  console.log("Seeding users…");
  const userRows = await db
    .insert(users)
    .values([
      {
        name: DEFAULT_DEMO_RPD.name,
        title: DEFAULT_DEMO_RPD.title,
        role: "rpd",
        region: "Central",
        preconDepartment: "Central Building Group",
        email: DEFAULT_DEMO_RPD.email,
      },
      {
        name: "Sarah Chen",
        title: "Preconstruction Manager",
        role: "pcm",
        region: "Central",
        preconDepartment: "Central Heavy Civil",
        email: "schen@brasfieldgorrie.com",
      },
      {
        name: "Marcus Webb",
        title: "Senior Estimate Lead",
        role: "estimate_lead",
        region: "Central",
        preconDepartment: "Central Heavy Civil",
        email: "mwebb@brasfieldgorrie.com",
      },
      {
        name: "Dana Ortiz",
        title: "Job Site Administrator",
        role: "admin_jsa",
        region: "Central",
        preconDepartment: "Central Building Group",
        email: "dortiz@brasfieldgorrie.com",
      },
      {
        name: "Patricia Lawson",
        title: "Division President",
        role: "leadership",
        region: "Central",
        preconDepartment: null,
        email: "plawson@brasfieldgorrie.com",
      },
      {
        name: "Tom Reeves",
        title: "Corporate Precon Admin",
        role: "corporate_admin",
        region: null,
        preconDepartment: null,
        email: "treeves@brasfieldgorrie.com",
      },
    ])
    .returning();
  const rpd = userRows.find((u) => u.role === "rpd")!;
  const estimateLead = userRows.find((u) => u.role === "estimate_lead")!;
  const pcm = userRows.find((u) => u.role === "pcm")!;
  const corpAdmin = userRows.find((u) => u.role === "corporate_admin")!;

  console.log("Seeding jobs, Salesforce mock data, and estimate rounds…");
  const regions = Object.keys(REGION_DEPARTMENTS);
  let jobNumberCounter = 24101;
  let sfCounter = 7001;
  let tbdCounter = 1042;

  const now = new Date("2026-08-06T12:00:00");
  const notificationRows: (typeof notifications.$inferInsert)[] = [];
  const centralRoundIds: number[] = [];
  let totalRounds = 0;

  for (let j = 0; j < 42; j++) {
    // Weight Central so the default demo persona has a rich view
    const region = j % 3 === 0 ? "Central" : regions[j % regions.length];
    const dept = pick([...(REGION_DEPARTMENTS[region] ?? [])]);
    const [city, state] = pick(REGION_CITIES[region]);
    const [sector, templates, [loM, hiM]] = pick(SECTOR_NAMES);
    const jobName = pick(templates).replace("{city}", city);
    const mlt = sector.startsWith("Healthcare")
      ? "Healthcare"
      : sector.startsWith("Mission Critical")
        ? "Mission Critical"
        : sector.startsWith("Industrial") || sector.startsWith("Science")
          ? "Industrial"
          : sector.startsWith("Infrastructure") || sector.startsWith("Water")
            ? "Heavy Civil"
            : sector.startsWith("Government")
              ? "Federal"
              : "Commercial";

    // ~10% of jobs are manual/unlinked (Quick ROMs before a Salesforce job exists)
    const isManual = j % 10 === 7;
    const jobNumber = isManual
      ? `TBD-${tbdCounter++}`
      : String(jobNumberCounter++);
    const sfId = `SF-${sfCounter++}`;

    if (!isManual) {
      await db.insert(salesforceJobs).values({
        sfId,
        jobNumber,
        jobName,
        region,
        marketSector: sector,
        city,
        state,
        createdDate: `202${4 + (j % 3)}-0${1 + (j % 9)}-15`,
      });
    } else {
      // Candidate SF job that appeared later — for the match-and-merge demo
      await db.insert(salesforceJobs).values({
        sfId: `SF-${sfCounter++}`,
        jobNumber: String(jobNumberCounter++),
        jobName: jobName.replace("Phase II", "Ph 2"),
        region,
        marketSector: sector,
        city,
        state,
        createdDate: "2026-07-20",
      });
    }

    const [job] = await db
      .insert(jobs)
      .values({
        jobNumber,
        jobName,
        region,
        preconDepartment: dept,
        salesforceId: isManual ? null : sfId,
        isLinked: !isManual,
        createdById: pcm.id,
      })
      .returning();

    const phases = pick(PHASE_SEQUENCES);
    const baseValueM = between(loM, hiM);
    const startYear = 2024 + (j % 3);
    const leadName =
      region === "Central" && j % 2 === 0
        ? estimateLead.name
        : pick(ESTIMATE_LEAD_NAMES);
    const isBuilding =
      !sector.startsWith("Infrastructure") && !sector.startsWith("Water");

    for (let p = 0; p < phases.length; p++) {
      const phase = phases[p];
      const bidYear = Math.min(startYear + Math.floor(p / 2), 2026);
      // Value drifts round to round as design develops
      const ev = round(baseValueM * 1_000_000 * between(0.9, 1.15), 100_000);

      // Status distribution by bid year
      let status: RoundStatus;
      if (bidYear <= 2024) status = "locked";
      else if (bidYear === 2025) status = rand() < 0.8 ? "locked" : "post_bid";
      else {
        const roll = rand();
        status =
          roll < 0.22
            ? "active"
            : roll < 0.42
              ? "upcoming"
              : roll < 0.58
                ? "outstanding"
                : roll < 0.72
                  ? "submitted"
                  : roll < 0.88
                    ? "post_bid"
                    : "locked";
      }
      const isPostBid = ["submitted", "post_bid", "locked"].includes(status);
      const isComplete =
        status === "locked" || (status === "post_bid" && rand() < 0.6);

      const feePct = between(0.032, 0.065);
      const contingencyPct = between(0.008, 0.03);
      const laborPct = between(0.07, 0.18);
      const laborTotal = ev * laborPct;
      const duration = Math.round(between(10, 40));
      const pmMonths = Math.round(duration * between(1.5, 3.5));
      const fsMonths = Math.round(duration * between(1.2, 3));
      const spPct = rand() < 0.7 ? between(0.03, 0.25) : 0;
      const gsf = isBuilding ? round(ev / between(350, 900), 1000) : null;

      const month = 1 + Math.floor(rand() * 11);
      const bidDue = `${bidYear}-${String(month).padStart(2, "0")}-${String(1 + Math.floor(rand() * 27)).padStart(2, "0")}`;
      const startDate = `${bidYear}-${String(Math.min(month + 1, 12)).padStart(2, "0")}-01`;

      const full = isPostBid; // post-bid fields present once submitted (partially) / complete when locked
      const partial =
        status === "submitted" || (status === "post_bid" && !isComplete);

      const values: typeof estimateRounds.$inferInsert = {
        jobId: job.id,
        roundNumber: p + 1,
        status,
        outcome:
          status === "locked"
            ? bidYear >= 2026 && rand() < 0.4
              ? "pending"
              : rand() < 0.38
                ? "successful"
                : "unsuccessful"
            : "pending",
        region,
        preconDepartment: dept,
        estimatePhase: phase,
        bidYear,
        bidDueDate: bidDue,
        drawingsDueDate: `${bidYear}-${String(Math.max(1, month - 1)).padStart(2, "0")}-15`,
        bidReviewDate: `${bidYear}-${String(month).padStart(2, "0")}-01`,
        projectStartDate: startDate,
        projectStartMonth: startDate.slice(0, 7),
        owner: pick([
          "HCA Healthcare",
          "Auburn University",
          "AdventHealth",
          "Vanderbilt",
          "USACE",
          "Private Owner",
        ]),
        city,
        state,
        estimateLeadId:
          isComplete || leadName === estimateLead.name ? estimateLead.id : null,
        mlt,
        marketSector: sector,
        contractType: pick(REFERENCE_LISTS.contractType.values),
        procurement: pick(REFERENCE_LISTS.procurement.values),
        designContract: pick(REFERENCE_LISTS.designContract.values),
        statusAtPricing: pick(REFERENCE_LISTS.statusAtPricing.values),
        internalJointVenture: full
          ? rand() < 0.12
            ? pick(["IJV – Cross Division", "IJV – Cross Region"])
            : "None"
          : null,
        awardability: full
          ? phase.includes("GMP")
            ? "Work Under Contract – GMP"
            : phase.includes("Hard Bid")
              ? "Work Under Contract – Hard Bid"
              : phase.includes("Early Release")
                ? "Work Under Contract – Early Release"
                : "Not Work Under Contract – Budget"
          : null,
        businessStrategyValues: full
          ? pick(REFERENCE_LISTS.businessStrategyValues.values)
          : null,
        estimateValue: full ? ev : null,
        feeBackPage:
          full && !partial ? round(ev * feePct * between(0.75, 0.95)) : null,
        feeExpected: full ? round(ev * feePct) : null,
        contingencyTotal: full && !partial ? round(ev * contingencyPct) : null,
        craftLaborBase: full && !partial ? round(laborTotal * 0.72) : null,
        craftLaborBurden: full && !partial ? round(laborTotal * 0.28) : null,
        craftLaborManHours:
          full && !partial ? Math.round(laborTotal / between(52, 68)) : null,
        gcBgSort: full && !partial ? round(ev * between(0.04, 0.08)) : null,
        grBgSort: full && !partial ? round(ev * between(0.015, 0.04)) : null,
        gcProposedOwnerSov:
          full && !partial ? round(ev * between(0.035, 0.075)) : null,
        grProposedOwnerSov:
          full && !partial ? round(ev * between(0.012, 0.038)) : null,
        pmMonths: full && !partial ? pmMonths : null,
        fieldSupervisionMonths: full && !partial ? fsMonths : null,
        preconCost: full && !partial ? round(ev * between(0.001, 0.005)) : null,
        designCost:
          full && !partial
            ? rand() < 0.5
              ? round(ev * between(0.005, 0.02))
              : 0
            : null,
        selfPerformPriced: full && !partial ? round(ev * spPct) : null,
        selfPerformProposed:
          full && !partial ? round(ev * spPct * between(0.5, 1)) : null,
        projectScheduleDuration: full && !partial ? duration : null,
        projectPlanningPreconEngagement:
          full && !partial
            ? pick(REFERENCE_LISTS.projectPlanningPreconEngagement.values)
            : null,
        gsf: full && !partial && gsf ? gsf : null,
        hotelKeysUnits:
          full && !partial && sector.startsWith("Hospitality")
            ? Math.round(between(150, 600))
            : null,
        materials:
          full && !partial && rand() < 0.6
            ? round(ev * between(0.05, 0.2))
            : null,
        supplies: full && !partial ? 0 : null,
        equipment:
          full && !partial && rand() < 0.5
            ? round(ev * between(0.01, 0.06))
            : null,
        equipmentOperation: full && !partial ? 0 : null,
        subcontracted: full && !partial ? round(ev * between(0.5, 0.82)) : null,
        marketOrStrategicRates:
          full && !partial && rand() < 0.5
            ? pick(REFERENCE_LISTS.equipmentRates.values)
            : null,
        subQuotesReceived:
          full && !partial && rand() < 0.7
            ? Math.round(between(20, 220))
            : null,
        mwdbeSubQuotesReceived:
          full && !partial && rand() < 0.5 ? Math.round(between(2, 40)) : null,
        mwdbeSubsPlugged:
          full && !partial && rand() < 0.5
            ? round(ev * between(0.01, 0.12))
            : null,
        costOfWorkBasis:
          phase === "Rates Only" && full ? round(ev * between(0.9, 1.2)) : null,
        afmMonths:
          full && !partial && rand() < 0.4
            ? Math.round(duration * between(0.5, 1.5))
            : null,
        peakManpowerHeadcount:
          full && !partial && rand() < 0.5
            ? Math.round(between(80, 900))
            : null,
        submittedAt: isPostBid ? new Date(`${bidDue}T15:00:00`) : null,
        lockedAt: status === "locked" ? new Date(`${bidDue}T15:00:00`) : null,
        createdById: pcm.id,
        createdAt: new Date(`${bidYear}-01-10T09:00:00`),
        updatedAt: now,
      };

      const [inserted] = await db
        .insert(estimateRounds)
        .values(values)
        .returning();
      totalRounds++;
      if (region === "Central") centralRoundIds.push(inserted.id);

      // Multi-value fields
      if (full && !partial) {
        const types = pickN(
          REFERENCE_LISTS.selfPerformWorkType.values,
          spPct > 0 ? 1 + Math.floor(rand() * 3) : 1
        );
        await db.insert(roundMultiValues).values(
          types.map((v) => ({
            roundId: inserted.id,
            field: "selfPerformWorkType",
            value: v,
          }))
        );
      }
      if (full && !partial) {
        const services = pickN(
          REFERENCE_LISTS.supportGroups.values,
          1 + Math.floor(rand() * 4)
        );
        await db.insert(roundMultiValues).values(
          services.map((v) => ({
            roundId: inserted.id,
            field: "utilizedSupportServices",
            value: v,
          }))
        );
      }

      // Status transition history
      const history: RoundStatus[] = (() => {
        switch (status) {
          case "active":
            return ["upcoming", "active"];
          case "upcoming":
            return ["upcoming"];
          case "outstanding":
            return ["upcoming", "active", "outstanding"];
          case "submitted":
            return ["upcoming", "active", "outstanding", "submitted"];
          case "post_bid":
            return [
              "upcoming",
              "active",
              "outstanding",
              "submitted",
              "post_bid",
            ];
          case "locked":
            return [
              "upcoming",
              "active",
              "outstanding",
              "submitted",
              "post_bid",
              "locked",
            ];
        }
      })();
      let prev: string | null = null;
      let ts = new Date(`${bidYear}-01-10T09:00:00`).getTime();
      for (const s of history) {
        ts += between(5, 30) * 86400_000;
        await db.insert(statusTransitions).values({
          roundId: inserted.id,
          fromStatus: prev,
          toStatus: s,
          userId:
            s === "locked"
              ? rpd.id
              : s === "submitted"
                ? estimateLead.id
                : pcm.id,
          createdAt: new Date(Math.min(ts, now.getTime())),
        });
        prev = s;
      }

      // Submitted reminder notification for our Estimate Lead persona
      if (status === "submitted" && values.estimateLeadId === estimateLead.id) {
        notificationRows.push({
          userId: estimateLead.id,
          title: `Post-bid data needed: ${jobName}`,
          body: `${phase} (Bid Year ${bidYear}) moved to Submitted. Complete the remaining post-bid fields.`,
          roundId: inserted.id,
          createdAt: values.submittedAt ?? now,
        });
      }
    }
  }

  if (notificationRows.length > 0) {
    await db.insert(notifications).values(notificationRows);
  }

  console.log("Seeding custom columns (Section 11 demo)…");
  const [riverMile] = await db
    .insert(customColumns)
    .values({
      scope: "region",
      region: "Central",
      preconDepartment: "Central Heavy Civil",
      key: "riverMileMarker",
      label: "River Mile Marker (demo)",
      type: "text",
      createdById: rpd.id,
    })
    .returning();
  const centralIndustrial = await db
    .insert(customColumns)
    .values([
      {
        scope: "region",
        region: "Central",
        preconDepartment: "Central Heavy Civil",
        key: "spoilDisposalSite",
        label: "Spoil Disposal Site (demo)",
        type: "text",
        createdById: rpd.id,
      },
      {
        scope: "region",
        region: "Central",
        preconDepartment: "Central Heavy Civil",
        key: "bargeAccess",
        label: "Barge Access (demo)",
        type: "dropdown",
        options: ["Yes", "No", "Seasonal"],
        createdById: rpd.id,
      },
      {
        scope: "region",
        region: "Central",
        preconDepartment: "Central Heavy Civil",
        key: "cofferdamRequired",
        label: "Cofferdam Required (demo)",
        type: "dropdown",
        options: ["Yes", "No", "TBD"],
        createdById: rpd.id,
      },
    ])
    .returning();
  const [cleanRoom] = await db
    .insert(customColumns)
    .values({
      scope: "region",
      region: "Georgia",
      preconDepartment: "Georgia – Mission Critical & Industrial",
      key: "cleanRoomClass",
      label: "Clean Room Class",
      type: "dropdown",
      options: ["ISO 5", "ISO 6", "ISO 7", "ISO 8", "N/A"],
      createdById: rpd.id,
    })
    .returning();
  await db.insert(auditLog).values([
    {
      entity: "schema",
      entityId: riverMile.id,
      action: "column_added",
      field: "River Mile Marker (demo)",
      newValue: "region:Central",
      userId: rpd.id,
    },
    ...centralIndustrial.map((col) => ({
      entity: "schema" as const,
      entityId: col.id,
      action: "column_added",
      field: col.label,
      newValue: "region:Central",
      userId: rpd.id,
    })),
    {
      entity: "schema",
      entityId: cleanRoom.id,
      action: "column_added",
      field: "Clean Room Class",
      newValue: "region:Georgia",
      userId: rpd.id,
    },
  ]);

  // Values for a few Central Heavy Civil rounds
  const chcRounds = await db.query.estimateRounds.findMany({
    where: (r, { and, eq }) =>
      and(eq(r.preconDepartment, "Central Heavy Civil")),
    limit: 6,
  });
  for (const r of chcRounds) {
    await db.insert(customColumnValues).values({
      columnId: riverMile.id,
      roundId: r.id,
      value: `RM ${Math.round(between(10, 400))}`,
    });
  }

  const [noteRound] = await db.query.estimateRounds.findMany({
    where: (r, { and, eq, inArray, isNull }) =>
      and(
        eq(r.preconDepartment, "Central Heavy Civil"),
        inArray(r.status, ["active", "upcoming", "outstanding"]),
        isNull(r.deletedAt)
      ),
    limit: 1,
  });
  if (noteRound) {
    const insertedNotes = await db
      .insert(roundNotes)
      .values([
        {
          roundId: noteRound.id,
          authorUserId: pcm.id,
          body: `@[${corpAdmin.id}] Updated drawing due date after talking to this DM on 8/12.`,
        },
        {
          roundId: noteRound.id,
          authorUserId: estimateLead.id,
          body: "ROM package dropped in Destini. Fee still TBD pending scope.",
        },
      ])
      .returning();
    const firstNote = insertedNotes[0];
    if (firstNote) {
      const png = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
        "base64"
      );
      const key = `notes/${firstNote.roundId}/${firstNote.id}/${randomUUID()}-drawing-markups.png`;
      const root = path.join(process.cwd(), ".data", "artifacts");
      await mkdir(path.dirname(path.join(root, key)), { recursive: true });
      await writeFile(path.join(root, key), png);
      await db.insert(roundNoteAttachments).values({
        noteId: firstNote.id,
        storageKey: key,
        filename: "drawing-markups.png",
        contentType: "image/png",
        sizeBytes: png.byteLength,
        uploadedById: pcm.id,
      });
      await db.insert(roundNoteMentions).values({
        noteId: firstNote.id,
        mentionedUserId: corpAdmin.id,
      });
      const [noteJob] = await db
        .select({ jobName: jobs.jobName })
        .from(jobs)
        .where(eq(jobs.id, noteRound.jobId));
      await db.insert(notifications).values({
        userId: corpAdmin.id,
        title: `${pcm.name} mentioned you on ${noteJob?.jobName ?? "an effort"} — R${noteRound.roundNumber}`,
        body: "Updated drawing due date after talking to this DM on 8/12.",
        roundId: noteRound.id,
        noteId: firstNote.id,
      });
    }
  }

  console.log("Seeding report templates and saved reports…");
  await db.insert(reportTemplates).values({
    name: "Weekly Region Bid Schedule",
    ownerId: pcm.id,
    config: {
      columns: [
        "jobNumber",
        "jobName",
        "estimatePhase",
        "bidYear",
        "bidDueDate",
        "estimateLead",
        "marketSector",
        "contractType",
        LATEST_NOTE_KEY,
      ],
      groupBy: ["preconDepartment"],
      sortBy: [{ field: "bidDueDate", dir: "asc" }],
      header: "Central Region — Weekly Bid Schedule",
      footer: "Brasfield & Gorrie Preconstruction — Confidential",
    },
  });
  await db.insert(savedReports).values({
    name: "Fee % by Region (Locked Rounds)",
    ownerId: corpAdmin.id,
    config: {
      fields: ["region", "metric:feeExpectedPct", "estimateValue"],
      filters: [{ field: "status", op: "contains", value: "Locked" }],
      groupBy: ["region"],
      aggregations: [
        { field: "estimateValue", fn: "sum" },
        { field: "metric:feeExpectedPct", fn: "avg" },
        { field: "id", fn: "count" },
      ],
      sortBy: [{ field: "region", dir: "asc" }],
    },
    sharedWithRegions: ["Central"],
  });
  await db
    .insert(savedReports)
    .values(consolidatedRegionalReportInsert(rpd.id));
  await db.insert(savedReports).values(upcomingBidScheduleReportInsert(rpd.id));
  for (const def of allStandardDashboardDefs()) {
    const [dash] = await db
      .insert(dashboards)
      .values({
        name: def.name,
        description: def.description,
        scope: def.scope,
        region: def.region,
        ownerId: corpAdmin.id,
        published: true,
        isStandard: true,
      })
      .returning();
    if (def.widgets.length) {
      await db.insert(dashboardWidgets).values(
        def.widgets.map((config, i) => ({
          dashboardId: dash.id,
          sortOrder: i,
          config,
        }))
      );
    }
  }

  const [seededJobs, seededGroups] = await Promise.all([
    db.select().from(jobs),
    db.select().from(organizationGroups),
  ]);
  const groupByName = new Map(
    seededGroups.map((group) => [group.name, group.id])
  );
  const membershipValues = seededJobs.flatMap((job) => {
    const groupId = groupByName.get(job.preconDepartment);
    return groupId
      ? [
          {
            jobId: job.id,
            groupId,
            participationRole: "lead",
          },
        ]
      : [];
  });
  if (membershipValues.length) {
    await db.insert(jobGroupMemberships).values(membershipValues);
  }

  console.log(`Done. Seeded ${totalRounds} estimate rounds across 42 jobs.`);
}

const isCli =
  typeof process !== "undefined" &&
  process.argv[1] &&
  /seed\.(ts|js|mjs|cjs)$/.test(process.argv[1]);

if (isCli) {
  seedDemoData()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
