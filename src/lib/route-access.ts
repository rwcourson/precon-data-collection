import type { Role } from "@/db/schema";

const PIPELINE = [
  /^\/$/,
  /^\/bid-schedule(?:\/|$|\?)/,
  /^\/post-bid(?:\/|$|\?)/,
  /^\/jobs(?:\/|$)/,
  /^\/rounds(?:\/|$)/,
  /^\/settings(?:\/|$)/,
];

const LEADERSHIP_TOOLS = [/^\/dashboards(?:\/|$|\?)/, /^\/reports(?:\/|$|\?)/];
const PCM_V1_MORE = [
  /^\/dashboards(?:\/|$|\?)/,
  /^\/reports(?:\/|$|\?)/,
  /^\/sheets(?:\/|$)/,
  /^\/copilot(?:\/|$)/,
];

function matches(pathname: string, patterns: RegExp[]): boolean {
  const path = pathname.split("?")[0] ?? pathname;
  return patterns.some((pattern) => pattern.test(path));
}

/** PCM/lead cannot open /copilot, /dashboards, /reports, /admin, /sheets, /trash. */
export function roleMayAccessPath(
  role: Role,
  pathname: string,
  options: { roleChrome?: boolean } = {}
): boolean {
  const path = pathname.split("?")[0] || "/";
  const roleChrome = options.roleChrome !== false;
  if (path.startsWith("/api/") || path.startsWith("/sign-in")) return true;
  if (role === "pcm" || role === "estimate_lead") {
    return matches(path, roleChrome ? PIPELINE : [...PIPELINE, ...PCM_V1_MORE]);
  }
  if (role === "leadership") {
    return matches(path, [...PIPELINE, ...LEADERSHIP_TOOLS]);
  }
  return true;
}
