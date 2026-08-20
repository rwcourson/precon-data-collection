import type { Role } from "@/db/schema";

export type NavigationIcon =
  | "overview"
  | "schedule"
  | "postBid"
  | "dashboard"
  | "reports"
  | "admin"
  | "sheets"
  | "copilot";

export type NavigationSubItem = {
  href: string;
  label: string;
  countKey?: "active" | "upcoming" | "outstanding";
  match?: (pathname: string, search: string) => boolean;
};

export type NavigationItem = {
  href: string;
  label: string;
  icon: NavigationIcon;
  exact?: boolean;
  children?: NavigationSubItem[];
};

export type NavigationSection = {
  label: string;
  items: NavigationItem[];
};

const PIPELINE: NavigationSection = {
  label: "Pipeline",
  items: [
    { href: "/", label: "Overview", icon: "overview", exact: true },
    {
      href: "/bid-schedule",
      label: "Bid Schedule",
      icon: "schedule",
      children: [
        {
          href: "/bid-schedule?section=pipeline",
          label: "Upcoming + Active",
          match: (_, search) =>
            !search.includes("section=") || search.includes("section=pipeline"),
        },
        {
          href: "/bid-schedule?section=active",
          label: "Active",
          countKey: "active",
          match: (_, search) => search.includes("section=active"),
        },
        {
          href: "/bid-schedule?section=upcoming",
          label: "Upcoming",
          countKey: "upcoming",
          match: (_, search) => search.includes("section=upcoming"),
        },
        {
          href: "/bid-schedule?section=outstanding",
          label: "Outstanding",
          countKey: "outstanding",
          match: (_, search) => search.includes("section=outstanding"),
        },
        {
          href: "/bid-schedule?section=all",
          label: "All",
          match: (_, search) => search.includes("section=all"),
        },
      ],
    },
    { href: "/post-bid", label: "Post-Bid", icon: "postBid" },
  ],
};

const DASHBOARDS: NavigationItem = {
  href: "/dashboards",
  label: "Dashboards",
  icon: "dashboard",
  children: [
    {
      href: "/dashboards?level=corporate",
      label: "Corporate",
      match: (pathname, search) =>
        pathname === "/dashboards" &&
        (!search.includes("level=") || search.includes("level=corporate")),
    },
    {
      href: "/dashboards?level=region",
      label: "Region",
      match: (pathname, search) =>
        pathname === "/dashboards" && search.includes("level=region"),
    },
    {
      href: "/dashboards?level=division",
      label: "Division",
      match: (pathname, search) =>
        pathname === "/dashboards" && search.includes("level=division"),
    },
  ],
};

const REPORTS: NavigationItem = {
  href: "/reports",
  label: "Reports",
  icon: "reports",
  children: [
    {
      href: "/reports",
      label: "Report Builder",
      match: (pathname) => pathname === "/reports",
    },
    {
      href: "/reports/annual",
      label: "Annual Regional Report",
      match: (pathname) => pathname.startsWith("/reports/annual"),
    },
  ],
};

const ADMIN: NavigationItem = {
  href: "/admin",
  label: "Admin",
  icon: "admin",
  children: [
    { href: "/admin?tab=columns", label: "Data Columns" },
    { href: "/admin?tab=lists", label: "Reference Lists" },
    { href: "/admin?tab=audit", label: "Audit Log" },
    { href: "/admin?tab=mcp", label: "MCP Access" },
    { href: "/admin?tab=integrations", label: "Integrations" },
    { href: "/admin?tab=salesforce", label: "Salesforce Inbox" },
    { href: "/admin?tab=distribution", label: "Distribution" },
    { href: "/admin/destini", label: "Destini import" },
    { href: "/trash", label: "Trash" },
  ].map((item) => ({
    ...item,
    match: (pathname: string, search: string) => {
      const [path, query] = item.href.split("?");
      return pathname === path && (!query || search.includes(query));
    },
  })),
};

const MORE: NavigationSection = {
  label: "More",
  items: [
    { href: "/sheets", label: "Sheets", icon: "sheets" },
    { href: "/dashboards/studio", label: "Studio", icon: "dashboard" },
    { href: "/dashboards/forecast", label: "Forecast", icon: "dashboard" },
    {
      href: "/dashboards/reconciliation",
      label: "DMR Reconciliation",
      icon: "dashboard",
    },
    { href: "/copilot", label: "AI Copilot", icon: "copilot" },
  ],
};

/** Navigation is presentation policy. Route/server authorization remains separate. */
export function navigationForRole(
  role: Role,
  options: { roleChrome?: boolean } = {}
): NavigationSection[] {
  const roleChrome = options.roleChrome !== false;
  if (role === "pcm" || role === "estimate_lead") {
    if (roleChrome) return [PIPELINE];
    return [PIPELINE, { label: "Tools", items: [DASHBOARDS, REPORTS] }, MORE];
  }
  if (role === "leadership") {
    return [PIPELINE, { label: "Tools", items: [DASHBOARDS, REPORTS] }];
  }
  return [
    PIPELINE,
    { label: "Tools", items: [DASHBOARDS, REPORTS, ADMIN] },
    MORE,
  ];
}

export function isNavigationItemActive(
  item: NavigationItem,
  pathname: string
): boolean {
  if (item.exact) return pathname === item.href;
  if (item.href === "/") return pathname === "/";
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
