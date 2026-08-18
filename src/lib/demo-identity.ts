/** Default demo identity — Central RPD, spelling used in the leadership room. */
export const DEFAULT_DEMO_RPD = {
  name: "Brian Meyers",
  title: "Regional Preconstruction Director",
  email: "bmeyers@brasfieldgorrie.com",
  role: "rpd" as const,
  region: "Central",
};

export function pickDefaultDemoUser<T extends { name: string; role: string }>(
  roster: T[]
): T {
  if (roster.length === 0) {
    throw new Error("No users seeded — run `npm run db:seed` first.");
  }
  const named = roster.find((u) => u.name === DEFAULT_DEMO_RPD.name);
  if (named) return named;
  const rpd = roster.find((u) => u.role === "rpd");
  return rpd ?? roster[0];
}
