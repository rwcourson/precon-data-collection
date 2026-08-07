/**
 * Dropdown values from Destini markup "Data Validation" sheet
 * (Post Bid Data Collection - Destini Report Markup 2025.12.20).
 */

export const DESTINI_VALIDATION_LISTS: Record<string, string[]> = {
  region: ["Carolinas", "Central", "Florida", "Georgia", "Texas"],
  preconDepartment: [
    "Carolinas",
    "Central Building Group",
    "Central Federal",
    "Central Heavy Civil",
    "Central Nashville", // markup typo "Cental" normalized
    "Florida",
    "Georgia - Commercial",
    "Georgia - Healthcare",
    "Georgia - Mission Critical & Industrial",
    "Texas",
  ],
  estimatePhase: [
    "Budget - Quick ROM",
    "Budget - Concept",
    "Budget - SD",
    "Budget - DD",
    "Budget - Early Release",
    "Early Release",
    "GMP",
    "Value Engineering",
    "Reconciliation",
    "Hard Bid/Firm Fixed",
    "Rates Only",
    "Qualifications Only",
  ],
  contractType: [
    "GC - Cost Plus",
    "GC - Cost Plus w/GMP",
    "GC - Lump Sum",
    "DB - Cost Plus",
    "DB - Cost Plus w/GMP",
    "DB - Lump Sum",
    "Unit Price",
    "CM - Agent",
    "CM - At Risk",
    "Program Manager",
    "IPD/Multi-Party",
    "ECI",
    "Other",
  ],
  mlt: [
    "Commercial",
    "Federal",
    "Healthcare",
    "Heavy Civil",
    "Industrial",
    "Mission Critical",
  ],
  marketSector: [
    "Aerospace - Aviation",
    "Aerospace - Aviation Other",
    "Aerospace - Defense",
    "Aerospace - Space",
    "Commercial - Club House",
    "Commercial - Other",
    "Commercial - Interiors & Tenant Work",
    "Commercial - Office",
    "Commercial - Parking Deck",
    "Education - Higher Education",
    "Education - Other",
    "Education - K-12",
    "Education - Library",
    "Education - Parking Deck",
    "Education - Research",
    "Education - Stadium/Athletic Facility",
    "Education - Student Housing",
    "Energy - Other",
    "Energy - Fossil",
    "Energy - Hydropower",
    "Energy - Nuclear",
    "Energy - Oil and Gas",
    "Energy - Renewable/Alt Energy",
    "Energy - Transmission/Distribution",
    "Government - Critical Facility",
    "Government - Health",
    "Government - Homeland Security",
    "Government - Justice",
    "Government - Military",
    "Government - Office",
    "Government - Special Purpose",
    "Healthcare - Other",
    "Healthcare - Hospital",
    "Healthcare - Outpatient Facilities",
    "Healthcare - Parking Deck",
    "Hospitality - Convention Space",
    "Hospitality - Hotel",
    "Industrial - Distribution",
    "Industrial - Food and Beverage",
    "Industrial - Other",
    "Industrial - Manufacturing",
    "Industrial - Mining",
    "Infrastructure - Facilities",
    "Infrastructure - Federal",
    "Infrastructure - Marine/Port Facility",
    "Infrastructure - Rail",
    "Infrastructure - Roads & Bridges",
    "Infrastructure - Site/Civil",
    "Mission Critical - Call Center",
    "Mission Critical - Control Center",
    "Mission Critical - Greenfield Data Center",
    "Mission Critical - Live Environment Data Center",
    "Mission Critical - Specialized Critical Facility",
    "Multi-Family - Apartment",
    "Multi-Family - Condominium",
    "Multi-Family - Mixed Use",
    "Science & Tech - Life Sciences",
    "Science & Tech - Medical Laboratory",
    "Science & Tech - Research Institutions",
    "Senior Living",
    "Sports & Entertainment - Amusement",
    "Sports & Entertainment - Convention Space",
    "Sports & Entertainment - Museum",
    "Sports & Entertainment - Parks & Recreation",
    "Sports & Entertainment - Performing Arts Center",
    "Sports & Entertainment - Other",
    "Sports & Entertainment - Stadium/Athletic Facility",
    "Water - Industrial Water Treatment",
    "Water - Linear Water Work",
    "Water - Wastewater",
    "Water - Water Treatment",
  ],
  procurement: ["RFP/RFQ", "Bid - Closed", "Bid - Open", "Bid - Best Value", "Negotiated"],
  designContract: ["Bid-Build", "Design Build", "Hybrid DB"],
  selfPerformWorkType: [
    "Erosion Control",
    "Structure Demolition",
    "Interior Demolition",
    "Mass Grading",
    "Drainage",
    "Wet Utilities",
    "Dry Utilities",
    "Structured Excavation/Shoring",
    "Pile Driving",
    "Sheeting & Cofferdams",
    "Site Concrete",
    "SOG/SOD Concrete",
    "High FF/FL SOG",
    "Vertical Concrete Frame",
    "Vertical Concrete Frame (Design-Build)",
    "Mass Concrete",
    "Heavy Foundation Concrete",
    "Heavy Civil Concrete",
    "Concrete Paving",
    "Tilt Wall Concrete",
    "Masonry",
    "Room Pod Erection",
    "Modular Skin Erection",
    "Building Steel Erection",
    "Heavy Structure Erection",
    "Bridge Girder Erection",
    "Radial Gate Erection",
    "Obermeyer Gate Erection",
    "Rough Carpentry",
    "Finish Carpentry",
    "Drywall",
    "Doors & Hardware",
    "Marine Construction",
    "Process Piping",
    "Process Equipment",
  ],
  equipmentRates: ["Market", "BGES Strategic", "R5 Strategic", "Bluebook"],
  supportGroups: [
    "VDC",
    "Design Management",
    "Scheduling",
    "Construction Engineering",
    "Self Perform Support",
    "Supplier Opportunity",
    "MLT Support",
    "Procurement",
    "MEP",
    "Safety",
  ],
  bidYear: [
    "2024",
    "2025",
    "2026",
    "2027",
    "2028",
    "2029",
    "2030",
    "2031",
    "2032",
    "2033",
    "2034",
  ],
};

/** Map Destini list keys → our REFERENCE_LISTS keys (same for most). */
const LIST_KEY_MAP: Record<string, string> = {
  region: "region",
  preconDepartment: "preconDepartment",
  estimatePhase: "estimatePhase",
  contractType: "contractType",
  mlt: "mlt",
  marketSector: "marketSector",
  procurement: "procurement",
  designContract: "designContract",
  selfPerformWorkType: "selfPerformWorkType",
  equipmentRates: "equipmentRates",
  supportGroups: "supportGroups",
  bidYear: "bidYear",
};

function canon(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ");
}

export type DestiniListGap = {
  listKey: string;
  label: string;
  missingInApp: string[];
  extraInApp: string[];
};

/** Compare Destini Data Validation lists to seeded reference lists (dash-insensitive). */
export function compareDestiniLists(
  seeded: Record<string, { label: string; values: string[] }>,
): DestiniListGap[] {
  const gaps: DestiniListGap[] = [];

  for (const [destiniKey, destiniValues] of Object.entries(DESTINI_VALIDATION_LISTS)) {
    const appKey = LIST_KEY_MAP[destiniKey] ?? destiniKey;
    const app = seeded[appKey];
    if (!app) {
      gaps.push({
        listKey: appKey,
        label: destiniKey,
        missingInApp: destiniValues,
        extraInApp: [],
      });
      continue;
    }

    const appCanon = new Map(app.values.map((v) => [canon(v), v]));
    const destCanon = new Map(destiniValues.map((v) => [canon(v), v]));

    const missingInApp = destiniValues.filter((v) => !appCanon.has(canon(v)));
    const extraInApp = app.values.filter((v) => !destCanon.has(canon(v)));

    if (missingInApp.length || extraInApp.length) {
      gaps.push({
        listKey: appKey,
        label: app.label,
        missingInApp,
        extraInApp,
      });
    }
  }

  return gaps;
}
