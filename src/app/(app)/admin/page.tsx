import { asc, desc, eq, isNull } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { listPeople } from "@/actions/people";
import { AccessSettingsPanel } from "@/components/admin/access-settings";
import { AdminTabs } from "@/components/admin/admin-tabs";
import { ApiTokensPanel } from "@/components/admin/api-tokens-panel";
import { ColumnsManager } from "@/components/admin/columns-manager";
import { DestiniImport } from "@/components/admin/destini-import";
import { DistributionListsPanel } from "@/components/admin/distribution-lists-panel";
import { FieldPromotionsPanel } from "@/components/admin/field-promotions";
import { GroupEditPoliciesPanel } from "@/components/admin/group-edit-policies";
import { McpAccessPanel } from "@/components/admin/mcp-access-panel";
import { MigrationPanel } from "@/components/admin/migration-panel";
import { NeedsReview } from "@/components/admin/needs-review";
import { NotificationSettingsPanel } from "@/components/admin/notification-settings";
import { PeoplePanel } from "@/components/admin/people-panel";
import { ReferenceListsManager } from "@/components/admin/reference-lists";
import { RolloutSettingsPanel } from "@/components/admin/rollout-settings";
import { SalesforceInbox } from "@/components/admin/salesforce-inbox";
import { SourceProbes } from "@/components/admin/source-probes";
import { WarehouseFeed } from "@/components/admin/warehouse-feed";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TabsContent } from "@/components/ui/tabs";
import { db } from "@/db";
import {
  apiTokens,
  auditLog,
  customColumns,
  dataQualityFlags,
  distributionLists,
  emailOutbox,
  fieldPromotions,
  jobs,
  referenceLists,
  referenceListValues,
  salesforceMatchCandidates,
  salesforceSyncRuns,
  users,
} from "@/db/schema";
import { authMode, getAccessSettings, SSO_HEADERS } from "@/lib/auth";
import {
  principalCanManageCompanyColumns,
  principalCanManagePeople,
  principalCanManageReferenceLists,
  principalCanManageRegionColumns,
  principalCanViewAudit,
} from "@/lib/authorization/decisions";
import {
  type AdminSection,
  listAdminSectionsForPrincipal,
  listRoundsWithJobsForPrincipal,
} from "@/lib/authorization/loaders";
import { MCP_ROLES } from "@/lib/authorization/mcp-policy";
import {
  listMcpUserOverrides,
  loadMcpAdminConfig,
} from "@/lib/authorization/mcp-settings";
import { getWebPrincipal } from "@/lib/authorization/web-principal";
import { type FlagKind, fieldLabel } from "@/lib/data-quality";
import { emailProvider } from "@/lib/email";
import { fmtDateTime } from "@/lib/format";
import { connectMode } from "@/lib/integrations/connect";
import { databricksConfig } from "@/lib/integrations/databricks/client";
import { getFeedState } from "@/lib/integrations/databricks/feed";
import { databricksWritesAllowed } from "@/lib/integrations/databricks/read";
import { smartsheetConfig } from "@/lib/integrations/smartsheet/client";
import { ROLE_LABELS } from "@/lib/labels";
import { listMcpConnections } from "@/lib/mcp/connections";
import {
  buildMigrationReport,
  cutoverChecklist,
  getImportSource,
} from "@/lib/migration";
import { findReminderTargets, getNotificationSettings } from "@/lib/reminders";
import { isSuperAdmin } from "@/lib/super-admin";
import { getWorkspace } from "@/lib/workspace-server";
import {
  listGroupEditPolicies,
  listOrganizationGroups,
} from "@/services/organization-service";
import { loadRolloutSettings } from "@/services/rollout-service";

const VALID_TABS = new Set([
  "columns",
  "promotions",
  "lists",
  "review",
  "notifications",
  "distribution",
  "salesforce",
  "tokens",
  "mcp",
  "people",
  "access",
  "audit",
  "integrations",
  "migration",
]);

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const principal = await getWebPrincipal();
  const allowedSections = new Set(
    await listAdminSectionsForPrincipal(principal)
  );
  if (allowedSections.size === 0) notFound();
  const workspace = await getWorkspace();
  const user = principal.user;
  const [
    lists,
    listValues,
    cols,
    allUsers,
    audits,
    flags,
    rounds,
    settings,
    outbox,
    promotions,
    distLists,
    matchCandidates,
    syncRuns,
    tokens,
    allJobs,
  ] = await Promise.all([
    allowedSections.has("lists")
      ? db.select().from(referenceLists).orderBy(asc(referenceLists.key))
      : Promise.resolve([]),
    allowedSections.has("lists")
      ? db
          .select()
          .from(referenceListValues)
          .orderBy(asc(referenceListValues.sortOrder))
      : Promise.resolve([]),
    allowedSections.has("columns") || allowedSections.has("promotions")
      ? db.select().from(customColumns).orderBy(asc(customColumns.id))
      : Promise.resolve([]),
    db.select().from(users).orderBy(asc(users.id)),
    allowedSections.has("audit")
      ? db.select().from(auditLog).orderBy(desc(auditLog.createdAt)).limit(100)
      : Promise.resolve([]),
    allowedSections.has("review")
      ? db
          .select()
          .from(dataQualityFlags)
          .orderBy(desc(dataQualityFlags.firstSeenAt))
      : Promise.resolve([]),
    allowedSections.has("review")
      ? listRoundsWithJobsForPrincipal(principal)
      : Promise.resolve([]),
    getNotificationSettings(),
    allowedSections.has("notifications")
      ? db
          .select()
          .from(emailOutbox)
          .orderBy(desc(emailOutbox.createdAt))
          .limit(25)
      : Promise.resolve([]),
    allowedSections.has("promotions")
      ? db
          .select()
          .from(fieldPromotions)
          .orderBy(desc(fieldPromotions.proposedAt))
      : Promise.resolve([]),
    allowedSections.has("distribution")
      ? db
          .select()
          .from(distributionLists)
          .where(isNull(distributionLists.deletedAt))
          .orderBy(asc(distributionLists.name))
      : Promise.resolve([]),
    allowedSections.has("salesforce")
      ? db
          .select()
          .from(salesforceMatchCandidates)
          .where(eq(salesforceMatchCandidates.status, "pending"))
          .orderBy(desc(salesforceMatchCandidates.score))
      : Promise.resolve([]),
    allowedSections.has("salesforce")
      ? db
          .select()
          .from(salesforceSyncRuns)
          .orderBy(desc(salesforceSyncRuns.startedAt))
          .limit(1)
      : Promise.resolve([]),
    allowedSections.has("tokens")
      ? db.select().from(apiTokens).orderBy(desc(apiTokens.createdAt))
      : Promise.resolve([]),
    allowedSections.has("salesforce")
      ? db.select().from(jobs)
      : Promise.resolve([]),
  ]);
  const [orgGroups, groupPolicies, rollout] = allowedSections.has("access")
    ? await Promise.all([
        listOrganizationGroups(),
        listGroupEditPolicies(),
        loadRolloutSettings(),
      ])
    : [[], [], { version: 1 as const, features: {} }];

  const showAudit = principalCanViewAudit(principal);
  const managePeople = principalCanManagePeople(principal);
  const people =
    managePeople && allowedSections.has("people") ? await listPeople() : [];
  const mcpConfig = allowedSections.has("mcp")
    ? await loadMcpAdminConfig()
    : null;
  const mcpOverrides = allowedSections.has("mcp")
    ? await listMcpUserOverrides()
    : [];
  const mcpConnections = allowedSections.has("mcp")
    ? await listMcpConnections()
    : [];
  let tab = VALID_TABS.has(params.tab ?? "")
    ? (params.tab as string)
    : "columns";
  if (
    !allowedSections.has(tab as AdminSection) ||
    (tab === "audit" && !showAudit)
  ) {
    tab = allowedSections.has("columns") ? "columns" : [...allowedSections][0]!;
  }

  const userMap = new Map(allUsers.map((u) => [u.id, u.name]));
  const colMap = new Map(cols.map((c) => [c.id, c]));
  const jobMap = new Map(allJobs.map((j) => [j.id, j]));

  // ---- Needs Review queue, scoped to the active Region workspace ----
  const roundIndex = new Map(rounds.map((r) => [r.round.id, r]));
  const canTriage = ["rpd", "corporate_admin", "admin_jsa"].includes(user.role);
  const scopedFlags = flags.filter((f) => roundIndex.has(f.roundId));

  const reviewFilter = ["open", "resolved", "all"].includes(params.review ?? "")
    ? (params.review as string)
    : "open";
  const kindFilter = params.kind && params.kind !== "all" ? params.kind : "all";
  const openFlags = scopedFlags.filter((f) => f.resolvedAt == null);

  const kindCounts = openFlags.reduce<Record<string, number>>((acc, f) => {
    acc[f.kind] = (acc[f.kind] ?? 0) + 1;
    return acc;
  }, {});

  // Top repeat offenders, so a migrated column can be cleared in one decision.
  const groupMap = new Map<
    string,
    { field: string; kind: FlagKind; count: number; samples: Set<string> }
  >();
  for (const f of openFlags) {
    const key = `${f.field}\u241F${f.kind}`;
    const g = groupMap.get(key) ?? {
      field: f.field,
      kind: f.kind as FlagKind,
      count: 0,
      samples: new Set<string>(),
    };
    g.count++;
    if (f.value && g.samples.size < 3) g.samples.add(f.value);
    groupMap.set(key, g);
  }
  const reviewGroups = [...groupMap.values()]
    .filter((g) => g.count > 1)
    .sort((a, b) => b.count - a.count)
    .slice(0, 6)
    .map((g) => ({
      field: g.field,
      fieldLabel: fieldLabel(g.field),
      kind: g.kind,
      count: g.count,
      samples: [...g.samples],
    }));

  const matchingFlags = scopedFlags
    .filter((f) =>
      reviewFilter === "open"
        ? f.resolvedAt == null
        : reviewFilter === "resolved"
          ? f.resolvedAt != null
          : true
    )
    .filter((f) => kindFilter === "all" || f.kind === kindFilter).length;

  const reviewRows = scopedFlags
    .filter((f) =>
      reviewFilter === "open"
        ? f.resolvedAt == null
        : reviewFilter === "resolved"
          ? f.resolvedAt != null
          : true
    )
    .filter((f) => kindFilter === "all" || f.kind === kindFilter)
    .slice(0, 200)
    .map((f) => {
      const row = roundIndex.get(f.roundId)!;
      return {
        id: f.id,
        roundId: f.roundId,
        jobNumber: row.job.jobNumber,
        jobName: row.job.jobName,
        region: row.round.region,
        bidYear: row.round.bidYear,
        field: f.field,
        fieldLabel: fieldLabel(f.field),
        kind: f.kind as FlagKind,
        value: f.value,
        resolvedAt: f.resolvedAt ? fmtDateTime(f.resolvedAt) : null,
        resolvedByName: userMap.get(f.resolvedById ?? -1) ?? null,
        resolutionNote: f.resolutionNote,
      };
    });

  const [reminderTargets, access, feedState, migration, importSource] =
    await Promise.all([
      findReminderTargets(settings),
      getAccessSettings(),
      getFeedState(),
      buildMigrationReport(workspace),
      getImportSource(),
    ]);

  const dbCfg = databricksConfig();
  const checklist = cutoverChecklist(migration, {
    authMode: authMode(),
    connectMode: connectMode(),
    warehouseConfigured: Boolean(dbCfg),
    emailProvider: emailProvider(),
  });

  const listData = lists.map((l) => ({
    key: l.key,
    label: l.label,
    values: listValues
      .filter((v) => v.listKey === l.key)
      .map((v) => ({ id: v.id, value: v.value, retired: v.retired })),
  }));

  const regionValues =
    listData
      .find((l) => l.key === "region")
      ?.values.filter((v) => !v.retired)
      .map((v) => v.value) ?? [];
  const deptValues =
    listData
      .find((l) => l.key === "preconDepartment")
      ?.values.filter((v) => !v.retired)
      .map((v) => v.value) ?? [];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Administration & Governance"
        description={`Two-tier governance: the Corporate Precon Admin owns company-wide columns and reference lists; RPDs independently manage their own Region's columns. You are signed in as ${ROLE_LABELS[user.role]}${user.region ? ` (${user.region})` : ""}.`}
      />

      <AdminTabs
        value={tab}
        showAudit={showAudit}
        reviewCount={openFlags.length}
      >
        <TabsContent value="columns" className="pt-3">
          <ColumnsManager
            columns={cols.map((c) => ({
              id: c.id,
              scope: c.scope,
              region: c.region,
              preconDepartment: c.preconDepartment,
              label: c.label,
              type: c.type,
              options: c.options,
              createdByName: userMap.get(c.createdById ?? -1) ?? "—",
            }))}
            role={user.role}
            userRegion={user.region}
            regions={regionValues}
            departments={deptValues}
            canCompany={principalCanManageCompanyColumns(principal)}
            canRegion={principalCanManageRegionColumns(principal)}
          />
        </TabsContent>

        <TabsContent value="promotions" className="pt-3">
          <FieldPromotionsPanel
            promotions={promotions.map((p) => {
              const col = colMap.get(p.customColumnId);
              return {
                id: p.id,
                status: p.status,
                columnLabel: col?.label ?? `Column #${p.customColumnId}`,
                columnKey: col?.key ?? "",
                region: col?.region ?? null,
                conflictSummary: p.conflictSummary,
                proposedByName: userMap.get(p.proposedById) ?? "—",
              };
            })}
          />
        </TabsContent>

        <TabsContent value="distribution" className="pt-3">
          <DistributionListsPanel
            lists={distLists.map((l) => ({
              id: l.id,
              name: l.name,
              region: l.region,
              emails: l.emails ?? [],
              cadence: (l.cadence === "weekly" ? "weekly" : "manual") as
                | "manual"
                | "weekly",
              reportKey: l.reportKey,
              timezone: l.timezone,
              lastSentAt: l.lastSentAt ? fmtDateTime(l.lastSentAt) : null,
            }))}
          />
        </TabsContent>

        <TabsContent value="salesforce" className="pt-3">
          <SalesforceInbox
            lastRun={
              syncRuns[0]
                ? {
                    id: syncRuns[0].id,
                    status: syncRuns[0].status,
                    opportunitiesSeen: syncRuns[0].opportunitiesSeen,
                    candidatesCreated: syncRuns[0].candidatesCreated,
                    startedAt: fmtDateTime(syncRuns[0].startedAt),
                    finishedAt: syncRuns[0].finishedAt
                      ? fmtDateTime(syncRuns[0].finishedAt)
                      : null,
                    error: syncRuns[0].error,
                  }
                : null
            }
            candidates={matchCandidates.map((c) => {
              const job = c.jobId ? jobMap.get(c.jobId) : undefined;
              return {
                id: c.id,
                jobNumber: job?.jobNumber ?? null,
                jobName: job?.jobName ?? null,
                sfId: c.sfId,
                proposedJobName: c.proposedJobName,
                proposedJobNumber: c.proposedJobNumber,
                proposedRegion: c.proposedRegion,
                score: c.score,
                signals: c.signals ?? {},
                discrepancy: c.discrepancy,
                status: c.status,
              };
            })}
          />
        </TabsContent>

        <TabsContent value="tokens" className="pt-3">
          {user.role === "corporate_admin" ? (
            <ApiTokensPanel
              tokens={tokens.map((t) => ({
                id: t.id,
                name: t.name,
                tokenPrefix: t.tokenPrefix,
                scopes: t.scopes ?? [],
                expiresAt: t.expiresAt ? fmtDateTime(t.expiresAt) : null,
                revokedAt: t.revokedAt ? fmtDateTime(t.revokedAt) : null,
                lastUsedAt: t.lastUsedAt ? fmtDateTime(t.lastUsedAt) : null,
              }))}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              Permission denied: API tokens require Corporate Precon Admin.
            </p>
          )}
        </TabsContent>

        <TabsContent value="mcp" className="pt-3">
          {user.role === "corporate_admin" && mcpConfig ? (
            <McpAccessPanel
              config={mcpConfig}
              roles={MCP_ROLES}
              people={allUsers.map((row) => ({
                id: row.id,
                name: row.name,
                email: row.email,
                role: row.role,
              }))}
              overrides={mcpOverrides.map((row) => ({
                userId: row.userId,
                enabled: row.enabled,
                scopeCeiling: row.scopeCeiling,
              }))}
              connections={mcpConnections.map((row) => ({
                consentId: row.consentId,
                clientName: row.clientName,
                userEmail: row.userEmail,
                scopes: row.scopes,
                createdAtLabel: fmtDateTime(row.createdAt),
                lastUsedAtLabel: row.lastUsedAt
                  ? fmtDateTime(row.lastUsedAt)
                  : "never",
              }))}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              Permission denied: MCP access requires Corporate Precon Admin.
            </p>
          )}
        </TabsContent>

        <TabsContent value="lists" className="pt-3">
          <ReferenceListsManager
            lists={listData}
            canEdit={principalCanManageReferenceLists(principal)}
          />
        </TabsContent>

        <TabsContent value="review" className="pt-3">
          <NeedsReview
            rows={reviewRows}
            groups={reviewGroups}
            counts={kindCounts as Record<FlagKind, number>}
            totalOpen={openFlags.length}
            matching={matchingFlags}
            filter={reviewFilter}
            kind={kindFilter}
            canTriage={canTriage}
            neverScanned={flags.length === 0}
          />
        </TabsContent>

        <TabsContent value="notifications" className="pt-3">
          <NotificationSettingsPanel
            settings={settings}
            provider={emailProvider()}
            pendingCount={reminderTargets.length}
            outbox={outbox.map((m) => ({
              id: m.id,
              toEmail: m.toEmail,
              subject: m.subject,
              kind: m.kind,
              status: m.status,
              provider: m.provider,
              createdAt: fmtDateTime(m.createdAt),
            }))}
            canEdit={["corporate_admin", "rpd"].includes(user.role)}
          />
        </TabsContent>

        <TabsContent value="people" className="pt-3">
          {managePeople ? (
            <PeoplePanel
              people={people}
              roleLabels={ROLE_LABELS}
              regions={regionValues}
              canEdit={managePeople}
              canGrantCorporateAdmin={isSuperAdmin(user)}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              Permission denied: managing people requires Corporate Precon
              Admin.
            </p>
          )}
        </TabsContent>

        <TabsContent value="access" className="space-y-4 pt-3">
          <AccessSettingsPanel
            settings={access}
            mode={authMode()}
            headers={SSO_HEADERS}
            roleLabels={ROLE_LABELS}
            regions={regionValues}
            canEdit={user.role === "corporate_admin"}
          />
          <GroupEditPoliciesPanel
            groups={orgGroups.map((group) => ({
              id: group.id,
              name: group.name,
              region: group.region,
            }))}
            policies={groupPolicies}
            canEdit={user.role === "corporate_admin"}
          />
          <RolloutSettingsPanel
            settings={rollout}
            canEdit={user.role === "corporate_admin"}
          />
        </TabsContent>

        <TabsContent value="migration" className="pt-3">
          <MigrationPanel
            report={migration}
            checklist={checklist}
            source={importSource}
            importedAtLabel={
              importSource
                ? fmtDateTime(new Date(importSource.importedAt))
                : null
            }
          />
        </TabsContent>

        {showAudit && (
          <TabsContent value="audit" className="pt-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">
                  Audit log (latest 100)
                </CardTitle>
                <CardDescription>
                  Post-lock edits, schema/column changes, reference list
                  changes, and Salesforce match confirmations — user, timestamp,
                  old and new value.
                </CardDescription>
              </CardHeader>
              <CardContent className="px-0 pb-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-6">When</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Field</TableHead>
                      <TableHead>Change</TableHead>
                      <TableHead>By</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {audits.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="whitespace-nowrap pl-6 text-xs">
                          {fmtDateTime(a.createdAt)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" size="sm">
                            {a.entity.replace("_", " ")}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">
                          {a.action.replaceAll("_", " ")}
                        </TableCell>
                        <TableCell className="text-xs font-medium">
                          {a.roundId ? (
                            <Link
                              href={`/rounds/${a.roundId}`}
                              className="hover:underline"
                            >
                              {a.field}
                            </Link>
                          ) : (
                            a.field
                          )}
                        </TableCell>
                        <TableCell className="max-w-64 truncate text-xs">
                          {a.oldValue && (
                            <span className="text-muted-foreground line-through">
                              {a.oldValue}
                            </span>
                          )}
                          {a.oldValue && a.newValue && " → "}
                          {a.newValue}
                        </TableCell>
                        <TableCell className="text-xs">
                          {userMap.get(a.userId ?? -1) ?? "System"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        <TabsContent value="integrations" className="space-y-4 pt-3">
          <SourceProbes
            databricksConfigured={Boolean(dbCfg)}
            smartsheetConfigured={Boolean(smartsheetConfig())}
            writesAllowed={databricksWritesAllowed()}
            canRun={user.role === "corporate_admin"}
          />
          <WarehouseFeed
            state={feedState}
            configured={Boolean(dbCfg)}
            table={dbCfg?.table ?? "domain.preconstruction.precon_data_rounds"}
            connectMode={connectMode()}
            lastRunLabel={
              feedState.lastRunAt
                ? fmtDateTime(new Date(feedState.lastRunAt))
                : null
            }
            canRun={user.role === "corporate_admin"}
            writesAllowed={databricksWritesAllowed()}
          />
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Destini post-bid import</CardTitle>
              <CardDescription>
                Upload a Destini XLSX/CSV report with preview before write. Also
                at{" "}
                <Link href="/admin/destini" className="underline">
                  /admin/destini
                </Link>
                .
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DestiniImport />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">
                Integration status (Databricks probe)
              </CardTitle>
              <CardDescription>
                Probed against B&amp;G Unity Catalog via the Pre-Con Time Tool
                SQL warehouse. Destini + Build are live-capable today;
                Connect/Salesforce pursuit tables were not found in this
                catalog.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">System</TableHead>
                    <TableHead>Phase 1 (Launch)</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[
                    [
                      "B&G Connect / Salesforce",
                      "Not in UC yet",
                      "No Opportunity / Connect pursuit tables found in this warehouse. Keep mocked lookup until a curated SF view lands.",
                      false,
                    ],
                    [
                      "Destini (via Databricks)",
                      "Live-capable",
                      "~10.6k estimates in domain.preconstruction.destiniestimates — GrandTotalCost, StatedFee, contingencies, GC/GR, labor, GSF, PM months. Join on ParentJobNumber.",
                      true,
                    ],
                    [
                      "Build / E1 project master",
                      "Live-capable",
                      "domain.general.buildprojectdetails (~36k) supplies Job #, Region, Division, Market Sector, City/State, procurement, contract type, IJV.",
                      true,
                    ],
                    [
                      "Project team (Estimate Lead)",
                      "Live-capable",
                      "domain.general.buildprojectteam — Lead/Chief/Team Precon Manager roles for Estimate Lead.",
                      true,
                    ],
                    [
                      "BuildingConnected",
                      "Live-capable",
                      "standardized.buildingconnected.projects (~6.3k) for bid due dates / BC metadata; opportunity_project_pairs is nearly empty.",
                      true,
                    ],
                    [
                      "Databricks calculated metrics",
                      "Live-capable",
                      "destinicalculatedmetrics mirrors fee %, contingency %, $/SF, fee/PM-month — can replace several app-side formulas.",
                      true,
                    ],
                    [
                      "InEight / Sage Estimating",
                      "Legacy mirror",
                      "standardized.sageestimates present (~52k estimates) if older pursuits need backfill.",
                      false,
                    ],
                    [
                      "Potential awards",
                      "Partial",
                      "production.curated_tables.potential_awards (~1.8k) for award/bid signals — not a clean win/loss enum.",
                      false,
                    ],
                  ].map(([name, phase, note, live]) => (
                    <TableRow key={name as string}>
                      <TableCell className="pl-6 text-sm font-medium">
                        {name}
                      </TableCell>
                      <TableCell>
                        <Badge variant={live ? "success" : "secondary"}>
                          {phase}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {note}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </AdminTabs>
    </div>
  );
}
