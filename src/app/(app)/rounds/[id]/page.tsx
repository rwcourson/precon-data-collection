import { desc, eq } from "drizzle-orm";
import { AlertTriangle, ArrowLeft, History, Lock } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusMenu } from "@/components/bid-schedule/status-menu";
import { TeamAssignedButton } from "@/components/bid-schedule/team-assigned-button";
import { NotesThread } from "@/components/notes/notes-thread";
import { ApproveLockButton } from "@/components/rounds/approve-lock-button";
import { DestiniRoundImport } from "@/components/rounds/destini-round-import";
import { EntryForm } from "@/components/rounds/entry-form";
import { OutcomeSelect } from "@/components/rounds/outcome-select";
import { RegionCustomTab } from "@/components/rounds/region-custom-tab";
import { StaffingCard } from "@/components/rounds/staffing-card";
import { UnlockRoundButton } from "@/components/rounds/unlock-round-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FieldHelp } from "@/components/ui/field-help";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { db } from "@/db";
import { auditLog, roundLockRevisions, statusTransitions } from "@/db/schema";
import {
  principalCanApproveLock,
  principalCanAssignJobUser,
  principalCanEnterPostBid,
  principalCanMarkStaffing,
} from "@/lib/authorization/decisions";
import { allowedTransitions } from "@/lib/authorization/lifecycle";
import {
  conditionContextFrom,
  FIELD_DEFS,
  MULTI_FIELD_KEYS,
  ROUND_COLUMN_KEYS,
  requiredFieldKeysFor,
} from "@/lib/fields";
import { STATUS_LABELS } from "@/lib/labels";
import {
  getCustomValuesForRounds,
  getMultiValues,
  getReferenceValues,
} from "@/lib/queries";

const FIELD_LABELS: Record<string, string> = Object.fromEntries(
  FIELD_DEFS.map((f) => [f.key, f.label])
);

import {
  listCustomColumnsForPrincipal,
  listDirectoryUsersForPrincipal,
  loadRoundForPrincipal,
} from "@/lib/authorization/loaders";
import { getWebPrincipal } from "@/lib/authorization/web-principal";
import { fmtDateTime } from "@/lib/format";
import { lockRevisionFieldDiffs } from "@/lib/lock-revisions";
import {
  calcMetric,
  formatMetricValue,
  METRIC_DEFS,
  METRIC_GROUPS,
} from "@/lib/metrics";
import { regionCustomTabForRound } from "@/lib/region-custom-columns";
import {
  applicableRequiredKeys,
  missingRequiredFields,
} from "@/lib/validation";
import { explainWhoCanEdit } from "@/lib/who-can-edit";
import { approvalService } from "@/services/approval-service";
import { loadFieldExceptions } from "@/services/field-exceptions-service";
import { notesService } from "@/services/notes-service";
import { roundtableFeaturesFor } from "@/services/rollout-service";
import { listRoundStaffAssignments } from "@/services/round-staffing-service";

export default async function RoundPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | undefined>>;
}) {
  const { id } = await params;
  const query = (await searchParams) ?? {};
  const principal = await getWebPrincipal();
  const loaded = await loadRoundForPrincipal(principal, Number(id));
  if (!loaded) notFound();
  const { round, job, estimateLeadName } = loaded.value;

  const [
    multi,
    lists,
    allUsers,
    customColsAll,
    transitions,
    audits,
    threadNotes,
    exceptions,
    staffAssignments,
    features,
    lockRevisionRows,
  ] = await Promise.all([
    getMultiValues(round.id),
    getReferenceValues(),
    listDirectoryUsersForPrincipal(principal),
    listCustomColumnsForPrincipal(principal),
    db
      .select()
      .from(statusTransitions)
      .where(eq(statusTransitions.roundId, round.id))
      .orderBy(desc(statusTransitions.createdAt)),
    db
      .select()
      .from(auditLog)
      .where(eq(auditLog.roundId, round.id))
      .orderBy(desc(auditLog.createdAt)),
    notesService.list(principal, round.id),
    loadFieldExceptions(round.id),
    listRoundStaffAssignments(round.id),
    roundtableFeaturesFor(principal),
    db
      .select()
      .from(roundLockRevisions)
      .where(eq(roundLockRevisions.roundId, round.id))
      .orderBy(desc(roundLockRevisions.revision)),
  ]);
  const lockRevisionsEnabled = features.lockRevisions;
  const writeMode = features.approvalWorkflow
    ? await approvalService.writeModeForRound(principal, round.id)
    : "direct";
  const locked = round.status === "locked";
  const canEdit =
    writeMode !== "read" &&
    !(locked && lockRevisionsEnabled) &&
    (principalCanEnterPostBid(principal, round) ||
      ["active", "upcoming", "outstanding"].includes(round.status));
  const customCols = customColsAll.filter(
    (c) => c.scope === "company" || c.region === round.region
  );
  const regionTab = regionCustomTabForRound(customCols, round);
  const customValues =
    (await getCustomValuesForRounds([round.id])).get(round.id) ?? {};

  const missing = missingRequiredFields(
    round,
    multi,
    {
      jobNumber: job.jobNumber,
      jobName: job.jobName,
      estimateLeadName,
    },
    exceptions,
    { fieldPolicy: features.fieldPolicy }
  );
  const missingKeys = applicableRequiredKeys(round, {
    fieldPolicy: features.fieldPolicy,
  }).filter((k) => missing.includes(FIELD_LABELS[k]));
  const entryMode =
    features.phaseAwareForm &&
    ["active", "upcoming", "outstanding"].includes(round.status)
      ? "schedule"
      : "postBid";
  const requirementContext = conditionContextFrom(
    round as unknown as Record<string, unknown>
  );
  const requiredKeys = requiredFieldKeysFor(requirementContext, {
    fieldPolicy: features.fieldPolicy,
  });

  const initialValues: Record<string, string> = {};
  for (const key of ROUND_COLUMN_KEYS) {
    const v = (round as unknown as Record<string, unknown>)[key];
    initialValues[key] = v == null ? "" : String(v);
  }
  const initialMulti: Record<string, string[]> = {};
  for (const key of MULTI_FIELD_KEYS) initialMulti[key] = multi[key] ?? [];

  const userMap = new Map(allUsers.map((u) => [u.id, u.name]));
  const notApplicable = exceptions.notApplicable ?? new Set();
  const headlineMetrics = METRIC_DEFS.filter((m) => m.headline).map((m) => ({
    label: m.label,
    value: formatMetricValue(calcMetric(m, round, notApplicable), m.format),
  }));
  const metricGroups = METRIC_GROUPS.map((group) => ({
    group,
    metrics: METRIC_DEFS.filter((m) => m.group === group).map((m) => ({
      label: m.label,
      value: formatMetricValue(calcMetric(m, round, notApplicable), m.format),
      note: m.note,
    })),
  }));

  return (
    <div className="space-y-4">
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2.5 gap-1.5 px-2.5 text-muted-foreground"
        nativeButton={false}
        render={
          <Link
            href={
              locked ||
              round.status === "post_bid" ||
              round.status === "submitted"
                ? "/post-bid"
                : "/bid-schedule"
            }
          />
        }
      >
        <ArrowLeft className="size-4" /> Back
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-medium">{job.jobName}</h1>
            <StatusMenu
              roundId={round.id}
              status={round.status}
              allowed={allowedTransitions(principal, round)}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            Job #{job.jobNumber} · Round {round.roundNumber} —{" "}
            {round.estimatePhase} · Bid Year {round.bidYear} · {round.region} /{" "}
            {round.preconDepartment}
          </p>
        </div>
        <div className="flex flex-col items-stretch gap-2 sm:items-end">
          <div className="flex flex-wrap items-center justify-end gap-2">
            <FieldHelp label="who can edit this effort">
              {explainWhoCanEdit({
                principal,
                writeMode,
                locked,
                lockImmutable: lockRevisionsEnabled,
                scheduleMode: entryMode === "schedule",
                roundId: round.id,
                region: round.region,
                status: round.status,
              })}
            </FieldHelp>
            <OutcomeSelect
              roundId={round.id}
              outcome={round.outcome}
              disabled={locked}
            />
            {round.status === "post_bid" &&
              principalCanApproveLock(principal, round) && (
                <ApproveLockButton roundId={round.id} />
              )}
            {locked &&
              lockRevisionsEnabled &&
              ["rpd", "corporate_admin"].includes(principal.user.role) && (
                <UnlockRoundButton roundId={round.id} />
              )}
            {principalCanMarkStaffing(principal, round) && (
              <TeamAssignedButton
                roundId={round.id}
                assigned={round.teamAssignedAt != null}
              />
            )}
          </div>
          {(round.teamAssignedAt || locked) && (
            <div className="max-w-sm space-y-1 text-left text-sm leading-5 text-muted-foreground">
              {round.teamAssignedAt ? (
                <p>
                  Team assigned {fmtDateTime(round.teamAssignedAt)}
                  {round.teamAssignedById
                    ? ` by ${userMap.get(round.teamAssignedById) ?? "a teammate"}`
                    : ""}
                </p>
              ) : null}
              {round.teamAssignedAt ? <p>Separate from Estimate Lead</p> : null}
              {locked ? (
                <p>
                  {lockRevisionsEnabled
                    ? "Unlocking is required before any correction; every revision remains in History."
                    : "RPD corrections stay on this locked record until lock revisions are enabled."}
                </p>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {locked && (
        <Alert variant="success">
          <Lock className="size-4" />
          <AlertTitle>
            RPD / SPD Approved / Locked{" "}
            {round.lockedAt ? `— ${fmtDateTime(round.lockedAt)}` : ""}
          </AlertTitle>
          <AlertDescription>
            This revision is immutable and included in locked reporting. An
            RPD/SPD can send it back to edit with a reason, then review and lock
            a new revision.
          </AlertDescription>
        </Alert>
      )}

      {!locked &&
        missing.length > 0 &&
        ["submitted", "post_bid"].includes(round.status) && (
          <Alert variant="warning">
            <AlertTriangle className="size-4" />
            <AlertTitle>
              {missing.length} required field{missing.length === 1 ? "" : "s"}{" "}
              remaining
            </AlertTitle>
            <AlertDescription>
              Blank and silent zero values do not satisfy the lock gate. Use the
              explicit N/A election where offered, or acknowledge a valid
              out-of-range value. Remaining: {missing.slice(0, 6).join(", ")}
              {missing.length > 6 ? ` and ${missing.length - 6} more` : ""}.
            </AlertDescription>
          </Alert>
        )}

      <div className="grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-3 lg:grid-cols-5">
        {headlineMetrics.map((m) => (
          <div key={m.label} className="bg-card px-3 py-2.5">
            <p className="text-2xs text-muted-foreground">{m.label}</p>
            <p className="font-mono text-base font-medium tabular-nums">
              {m.value}
            </p>
          </div>
        ))}
      </div>

      {features.organizationGroups ? (
        <StaffingCard
          roundId={round.id}
          assignments={staffAssignments}
          users={allUsers.map((user) => ({ id: user.id, name: user.name }))}
          canEdit={!locked && principalCanMarkStaffing(principal, round)}
        />
      ) : null}

      {entryMode === "schedule" && !round.bidDueDate ? (
        <Alert>
          <AlertTriangle className="size-4" />
          <AlertTitle>Bid date unclear</AlertTitle>
          <AlertDescription>
            This effort stays on the board. Set a bid due date when it is known
            — status does not move automatically.
          </AlertDescription>
        </Alert>
      ) : null}

      <Tabs
        defaultValue={
          query.tab === "notes"
            ? "notes"
            : query.tab === "region" && regionTab
              ? "region"
              : "data"
        }
      >
        <TabsList>
          <TabsTrigger value="data">Estimate Data</TabsTrigger>
          {regionTab && (
            <TabsTrigger value="region">{regionTab.title}</TabsTrigger>
          )}
          <TabsTrigger value="metrics">
            Calculated Metrics
            <Badge variant="secondary" size="sm" className="ml-1.5">
              {METRIC_DEFS.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="notes">
            Notes
            <Badge variant="secondary" size="sm" className="ml-1.5">
              {threadNotes.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="history">
            History &amp; Audit
            <Badge variant="secondary" size="sm" className="ml-1.5">
              {transitions.length + audits.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="data" className="pt-2">
          <EntryForm
            roundId={round.id}
            jobNumber={job.jobNumber}
            jobName={job.jobName}
            jobLinked={job.isLinked}
            initialValues={initialValues}
            initialMulti={initialMulti}
            initialCustom={customValues as Record<number, string>}
            estimateLeadId={round.estimateLeadId}
            users={allUsers.map((u) => ({
              id: u.id,
              name: u.name,
              role: u.role,
            }))}
            lists={lists}
            customCols={customCols}
            canEdit={canEdit}
            locked={locked}
            missingKeys={missingKeys}
            requiredKeys={requiredKeys}
            mode={entryMode}
            hideIjvDropdown={features.organizationGroups}
            fieldPolicy={features.fieldPolicy}
            jobId={job.id}
            notApplicableKeys={[...(exceptions.notApplicable ?? [])]}
            rangeAcknowledgedKeys={[...(exceptions.rangeAcknowledged ?? [])]}
            updatedAt={round.updatedAt.toISOString()}
          />
          {entryMode === "postBid" && features.sourceIngestion && (
            <div className="mt-4">
              <DestiniRoundImport roundId={round.id} canEdit={canEdit} />
            </div>
          )}
        </TabsContent>

        {regionTab && (
          <TabsContent value="region" className="pt-2">
            <RegionCustomTab
              roundId={round.id}
              title={regionTab.title}
              columns={regionTab.columns}
              initialCustom={customValues as Record<number, string>}
              canEdit={canEdit}
              locked={locked}
            />
          </TabsContent>
        )}

        <TabsContent value="metrics" className="pt-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Server-side calculated metrics
              </CardTitle>
              <CardDescription>
                The Project Estimate Summary formula set — always derived from
                the underlying fields, never entered separately, so they
                reconcile with source values. Blank inputs yield “—” rather than
                a misleading zero.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {metricGroups.map((g) => (
                <section key={g.group}>
                  <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {g.group}
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {g.metrics.map((m) => (
                      <div key={m.label} className="rounded-lg border p-3">
                        <p className="text-xs text-muted-foreground">
                          {m.label}
                        </p>
                        <p className="mt-0.5 text-lg font-semibold tabular-nums">
                          {m.value}
                        </p>
                        {m.note && (
                          <p className="text-2xs text-muted-foreground">
                            {m.note}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notes" className="pt-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Effort notes</CardTitle>
              <CardDescription>
                Chat-shaped history on this pricing effort — visible to anyone
                who can see the round. Not private, not project-level.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <NotesThread
                roundId={round.id}
                currentUserId={principal.user.id}
                canModerate={["corporate_admin", "rpd", "admin_jsa"].includes(
                  principal.user.role
                )}
                initialNotes={threadNotes}
                directory={allUsers.map((user) => ({
                  id: user.id,
                  name: user.name,
                  title: user.title,
                  region: user.region,
                }))}
                jobId={job.id}
                canAssignUsers={principalCanAssignJobUser(principal)}
                highlightNoteId={
                  query.note && Number.isInteger(Number(query.note))
                    ? Number(query.note)
                    : null
                }
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4 pt-2">
          {lockRevisionsEnabled && lockRevisionRows.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Lock className="size-4" /> Lock revisions
                </CardTitle>
                <CardDescription>
                  Each lock stores an immutable snapshot. Re-lock after an
                  unlock creates the next revision; existing locked rows stay
                  valid without fabricated history.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {lockRevisionRows.map((revision, index) => {
                  const previous = lockRevisionRows[index + 1];
                  const diffs = lockRevisionFieldDiffs(
                    previous?.snapshot ?? null,
                    revision.snapshot
                  );
                  return (
                    <div
                      key={revision.id}
                      className="rounded-md border bg-muted/30 p-3 text-sm"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium">
                          Revision {revision.revision}
                          {revision.unlockedAt ? " · unlocked" : " · current"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {userMap.get(revision.lockedById) ?? "System"} ·{" "}
                          {fmtDateTime(revision.lockedAt)}
                        </span>
                      </div>
                      {revision.unlockReason ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Unlock: {revision.unlockReason}
                        </p>
                      ) : null}
                      {diffs.length > 0 ? (
                        <ul className="mt-2 space-y-1 text-xs">
                          {diffs.slice(0, 12).map((diff) => (
                            <li key={diff.field}>
                              <span className="font-medium">
                                {FIELD_LABELS[diff.field] ?? diff.field}
                              </span>
                              : {diff.from} → {diff.to}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Snapshot captured at lock.
                        </p>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
          {audits.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Lock className="size-4" /> Locked history
                </CardTitle>
                <CardDescription>
                  Who changed what field, old value, new value, and when.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {audits.map((a) => (
                  <div
                    key={a.id}
                    className="rounded-md border bg-muted/30 p-3 text-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">
                        {FIELD_LABELS[a.field ?? ""] ?? a.field}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {userMap.get(a.userId ?? -1) ?? "System"} ·{" "}
                        {fmtDateTime(a.createdAt)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs">
                      <span className="tone-danger rounded px-1.5 py-0.5 line-through">
                        {a.oldValue || "—"}
                      </span>{" "}
                      →{" "}
                      <span className="tone-success rounded px-1.5 py-0.5">
                        {a.newValue || "—"}
                      </span>
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <History className="size-4" /> Status lifecycle history
              </CardTitle>
              <CardDescription>
                Every transition is validated against the state machine and
                logged.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-0">
                {transitions.map((t, i) => (
                  <div key={t.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span className="mt-1.5 size-2 rounded-full bg-primary" />
                      {i < transitions.length - 1 && (
                        <span className="w-px flex-1 bg-border" />
                      )}
                    </div>
                    <div className="pb-4">
                      <p className="text-sm">
                        {t.fromStatus ? (
                          <>
                            <span className="text-muted-foreground">
                              {STATUS_LABELS[
                                t.fromStatus as keyof typeof STATUS_LABELS
                              ] ?? t.fromStatus}
                            </span>{" "}
                            →{" "}
                          </>
                        ) : (
                          <span className="text-muted-foreground">
                            Created as{" "}
                          </span>
                        )}
                        <span className="font-medium">
                          {STATUS_LABELS[
                            t.toStatus as keyof typeof STATUS_LABELS
                          ] ?? t.toStatus}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {userMap.get(t.userId ?? -1) ?? "System"} ·{" "}
                        {fmtDateTime(t.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
