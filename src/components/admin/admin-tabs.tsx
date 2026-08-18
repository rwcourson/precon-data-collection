"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const TABS = [
  { value: "columns", label: "Data Columns" },
  { value: "promotions", label: "Promotions" },
  { value: "lists", label: "Reference Lists" },
  { value: "review", label: "Needs Review" },
  { value: "notifications", label: "Notifications" },
  { value: "distribution", label: "Distribution" },
  { value: "salesforce", label: "Salesforce Inbox" },
  { value: "tokens", label: "API Tokens" },
  { value: "people", label: "People" },
  { value: "access", label: "Access" },
  { value: "integrations", label: "Integrations" },
  { value: "migration", label: "Migration" },
  { value: "audit", label: "Audit Log", auditOnly: true as const },
];

/** Keeps Base UI Tabs in sync when URL `?tab=` changes from sidebar links. */
export function AdminTabs({
  value,
  showAudit,
  reviewCount = 0,
  children,
}: {
  value: string;
  showAudit: boolean;
  /** Open import flags, badged on the Needs Review tab. */
  reviewCount?: number;
  children: ReactNode;
}) {
  const router = useRouter();
  const tabs = TABS.filter(
    (t) => !("auditOnly" in t && t.auditOnly) || showAudit
  );

  return (
    <Tabs
      value={value}
      onValueChange={(next) => router.push(`/admin?tab=${next}`)}
    >
      <TabsList className="h-auto w-full flex-nowrap justify-start overflow-x-auto rounded bg-muted p-0.5">
        {tabs.map((t) => (
          <TabsTrigger
            key={t.value}
            value={t.value}
            className="shrink-0 rounded"
          >
            {t.label}
            {t.value === "review" && reviewCount > 0 && (
              <Badge variant="secondary" size="sm" className="ml-1.5">
                {reviewCount.toLocaleString()}
              </Badge>
            )}
          </TabsTrigger>
        ))}
      </TabsList>
      {children}
    </Tabs>
  );
}
