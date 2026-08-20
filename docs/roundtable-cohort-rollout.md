# Roundtable cohort rollout

Gates. A failed gate reduces the cohort or disables the flag; it does not waive the gate.

| Gate | When | What must be true |
| --- | --- | --- |
| Chrome / schedule canary | ~26 Aug | Role-aware chrome, one-job projection, table/cards/Gantt, one-click Excel, PCM Copilot denied |
| Room pilot | 2–4 weeks | Approvals, groups, field policy, change highlights for named personas only |
| Schema freeze | before 1 Oct outside-room | No new destructive migrations; additive columns may remain dormant |
| Locked warehouse | November | Outbox MERGE by round + revision, unlocked rows retracted, Power BI parity signed |
| Smartsheet off | after dump reconcile | Historical dump checksums, duplicate/required-field report, rollback rehearsal green |

High-risk flags (`approvalWorkflow`, `lockRevisions`, `fieldPolicy`, `changeAwareness`, `awardableReporting`, `sourceIngestion`, `warehousePublication`, `organizationGroups`) stay **off** until a cohort row in `roundtableRollout` enables them for a user, role, or region.
