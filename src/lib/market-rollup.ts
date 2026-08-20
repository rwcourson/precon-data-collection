const PREFIX_TO_MLT: Record<string, string> = {
  Aerospace: "Federal",
  Government: "Federal",
  Healthcare: "Healthcare",
  Industrial: "Industrial",
  "Mission Critical": "Mission Critical",
  Infrastructure: "Heavy Civil",
  Water: "Heavy Civil",
  Energy: "Heavy Civil",
  Commercial: "Commercial",
  Education: "Commercial",
  Hospitality: "Commercial",
  "Multi-Family": "Commercial",
  "Science & Tech": "Commercial",
  "Senior Living": "Commercial",
  "Sports & Entertainment": "Commercial",
};

export function deriveMltFromMarketSector(
  marketSector: string | null | undefined
): string | null {
  const value = marketSector?.trim();
  if (!value) return null;
  const prefix = value.split(/\s[-–—]\s/)[0]?.trim() ?? value;
  return PREFIX_TO_MLT[prefix] ?? null;
}
